"""Engine for running multi-asset portfolio simulations."""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import json

from backend.db.session import SessionLocal
from backend.models.asset import Asset
from backend.models.market_data import MarketData
from backend.models.portfolio import Portfolio, PortfolioAsset
from backend.engine.simulation_engine import SimulationEngine, DCAResult
from backend.schemas.portfolio_simulation import PortfolioSimulationCreate, AssetSimulationConfig

class PortfolioSimulationEngine:
    """Engine for simulating multi-asset portfolios with rebalancing support."""

    def __init__(self, portfolio_id: int, start_date: datetime, end_date: datetime):
        self.portfolio_id = portfolio_id
        self.start_date = start_date
        self.end_date = end_date
        self.db = SessionLocal()
        self.portfolio = self._load_portfolio()
        self.asset_engines = self._init_asset_engines()

    def _load_portfolio(self) -> Portfolio:
        """Loads the portfolio and its assets."""
        from sqlalchemy.orm import selectinload
        portfolio = self.db.query(Portfolio).options(
            selectinload(Portfolio.assets).selectinload(PortfolioAsset.asset)
        ).filter(Portfolio.id == self.portfolio_id).first()
        if not portfolio:
            raise ValueError(f"Portfolio with ID {self.portfolio_id} not found.")
        return portfolio

    def _init_asset_engines(self) -> Dict[int, SimulationEngine]:
        """Initializes a SimulationEngine for each asset in the portfolio."""
        engines = {}
        for pa in self.portfolio.assets:
            engines[pa.asset_id] = SimulationEngine(
                asset_id=pa.asset_id,
                start_date=self.start_date,
                end_date=self.end_date
            )
        return engines

    def run_simulation(self, config: PortfolioSimulationCreate) -> Dict[str, Any]:
        """
        Runs a multi-asset simulation with support for periodic and constant rebalancing.
        """
        # 1. Load data and calculate indicators for all assets
        asset_data = {}
        all_dates_set = set()
        
        for pa in self.portfolio.assets:
            engine = self.asset_engines[pa.asset_id]
            a_cfg = config.asset_configs.get(pa.asset_id, AssetSimulationConfig())
            
            df = engine._calculate_indicators(
                indicator_type=a_cfg.smart_indicator,
                rsi_low=a_cfg.rsi_threshold_low,
                rsi_high=a_cfg.rsi_threshold_high,
                ma_short=a_cfg.ma_period_short,
                ma_long=a_cfg.ma_period_long
            )
            
            if df.empty:
                continue # Skip assets with no data in range
            
            asset_data[pa.asset_id] = {
                "ticker": pa.asset.ticker,
                "weight": pa.weight,
                "df": df,
                "config": a_cfg,
                "initial_amount": pa.current_amount or 0.0,
                "history": [] # To track individual asset history
            }
            all_dates_set.update(df.index.tolist())

        if not asset_data:
            raise ValueError("No market data found for any asset in the selected period.")

        all_dates = sorted(list(all_dates_set))

        # Determine baseline investment dates
        template_aid = list(asset_data.keys())[0]
        template_df = asset_data[template_aid]["df"]
        baseline_dates = self._calculate_baseline_dates(template_df, config.frequency)
        
        periodic_amount = float(config.base_amount)
        if config.investment_mode == "annual":
            first_year = template_df.index[0].year
            year_count = len([d for d in baseline_dates if d.year == first_year])
            if year_count > 0:
                periodic_amount = float(config.base_amount / year_count)

        daily_maintenance_factor = (float(config.maintenance_fee_annual_percent) / 100.0) / 252.0 if config.maintenance_fee_annual_percent > 0 else 0

        # --- SIMULATION STATE ---
        b_state = {
            "units": {aid: 0.0 for aid in asset_data},
            "invested": 0.0,
            "fees": 0.0,
            "next_idx": 0
        }
        
        s_state = {
            "units": {aid: 0.0 for aid in asset_data},
            "invested": 0.0,
            "fees": 0.0,
            "pending": {aid: 0.0 for aid in asset_data},
            "next_idx": 0,
            "annual_budget_remaining": {year: {aid: 0.0 for aid in asset_data} for year in set(d.year for d in all_dates)}
        }

        # Initialize annual budgets
        for year in s_state["annual_budget_remaining"]:
            year_dates = [d for d in baseline_dates if d.year == year]
            for aid in asset_data:
                s_state["annual_budget_remaining"][year][aid] = float(len(year_dates) * periodic_amount * asset_data[aid]["weight"])

        initial_cap = float(self.portfolio.initial_capital or 0.0)
        
        # Initial Investment
        if initial_cap > 0:
            for aid, data in asset_data.items():
                price = float(data["df"]["close"].iloc[0])
                a_cap = float(data["initial_amount"]) if data["initial_amount"] > 0 else initial_cap * float(data["weight"])
                if a_cap > 0:
                    fee = max(a_cap * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                    units = (a_cap - fee) / price
                    b_state["units"][aid] += units
                    b_state["invested"] += a_cap
                    b_state["fees"] += fee
                    
                    s_state["units"][aid] += units
                    s_state["invested"] += a_cap
                    s_state["fees"] += fee

        portfolio_history = []
        last_rebalance_date = all_dates[0]

        # --- MAIN LOOP ---
        for idx, date in enumerate(all_dates):
            current_year = date.year
            
            # 1. Update prices
            row_prices = {}
            for aid in asset_data:
                if date in asset_data[aid]["df"].index:
                    row_prices[aid] = float(asset_data[aid]["df"].loc[date, "close"])
                else:
                    prev_df = asset_data[aid]["df"][asset_data[aid]["df"].index < date]
                    row_prices[aid] = float(prev_df["close"].iloc[-1]) if not prev_df.empty else 0.0

            # 2. Maintenance Fees
            if daily_maintenance_factor > 0:
                for aid in asset_data:
                    if b_state["units"][aid] > 0:
                        fee = (b_state["units"][aid] * row_prices[aid]) * daily_maintenance_factor
                        b_state["fees"] += fee
                        b_state["units"][aid] *= (1.0 - daily_maintenance_factor)
                    if s_state["units"][aid] > 0:
                        fee = (s_state["units"][aid] * row_prices[aid]) * daily_maintenance_factor
                        s_state["fees"] += fee
                        s_state["units"][aid] *= (1.0 - daily_maintenance_factor)

            # 3. Periodic Rebalancing
            if config.rebalancing_enabled and config.periodic_rebalancing_enabled:
                months_passed = (date.year - last_rebalance_date.year) * 12 + (date.month - last_rebalance_date.month)
                if months_passed >= config.periodic_rebalancing_interval:
                    total_val = sum(s_state["units"][aid] * row_prices[aid] for aid in s_state["units"])
                    if total_val > 0:
                        for aid in s_state["units"]:
                            target_val = total_val * float(asset_data[aid]["weight"])
                            current_val = s_state["units"][aid] * row_prices[aid]
                            diff = target_val - current_val
                            if abs(diff) > 1.0:
                                sell_buy_val = abs(diff)
                                fee = max(sell_buy_val * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                                if diff < 0: # Sell
                                    s_state["units"][aid] -= sell_buy_val / row_prices[aid]
                                    s_state["fees"] += fee
                                else: # Buy
                                    if sell_buy_val > fee:
                                        s_state["units"][aid] += (sell_buy_val - fee) / row_prices[aid]
                                        s_state["fees"] += fee
                    last_rebalance_date = date

            # 4. Contributions
            is_baseline_day = b_state["next_idx"] < len(baseline_dates) and date >= baseline_dates[b_state["next_idx"]]
            s_contributions_today = {aid: 0.0 for aid in asset_data}
            b_contributions_today = {aid: 0.0 for aid in asset_data}

            if is_baseline_day:
                # 4.1 Baseline
                for aid in asset_data:
                    a_amount = periodic_amount * float(asset_data[aid]["weight"])
                    if row_prices[aid] > 0:
                        fee = max(a_amount * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                        if a_amount > fee:
                            b_state["units"][aid] += (a_amount - fee) / row_prices[aid]
                            b_state["invested"] += a_amount
                            b_state["fees"] += fee
                            b_contributions_today[aid] = a_amount
                b_state["next_idx"] += 1

                # 4.2 Smart
                smart_weights = {aid: float(asset_data[aid]["weight"]) for aid in asset_data}
                if config.rebalancing_enabled and config.constant_rebalancing_enabled:
                    scores = {}
                    for aid in asset_data:
                        indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                        if indicator_row is not None:
                            val = float(indicator_row["indicator_value"]) if pd.notna(indicator_row["indicator_value"]) else 1.0
                            if config.constant_rebalancing_metric == "RSI":
                                scores[aid] = max(0.1, 100.0 - val)
                            else: # MA/EMA
                                scores[aid] = 1.0 / max(0.1, val)
                        else: scores[aid] = 1.0
                    
                    total_score = sum(float(asset_data[aid]["weight"]) * scores[aid] for aid in asset_data)
                    if total_score > 0:
                        for aid in asset_data:
                            smart_weights[aid] = (float(asset_data[aid]["weight"]) * scores[aid]) / total_score

                for aid in asset_data:
                    a_cfg = asset_data[aid]["config"]
                    a_amount = periodic_amount * smart_weights[aid]
                    indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                    signal = int(indicator_row["signal"]) if indicator_row is not None and "signal" in indicator_row else 0
                    
                    actual_buy = 0.0
                    if a_cfg.dynamic_timing_enabled:
                        if signal == 1:
                            buy_floor = a_amount * float(a_cfg.expensive_buy_ratio)
                            actual_buy = buy_floor
                            s_state["pending"][aid] += (a_amount - buy_floor)
                        else:
                            actual_buy = a_amount + s_state["pending"][aid]
                            s_state["pending"][aid] = 0
                    else: actual_buy = a_amount

                    if a_cfg.dynamic_sizing_enabled:
                        if signal == -1: actual_buy *= float(a_cfg.sizing_multiplier)
                        elif signal == 1: actual_buy *= float(a_cfg.expensive_buy_ratio)
                        
                        max_allowed = s_state["annual_budget_remaining"][current_year][aid]
                        is_last_day_of_year = (s_state["next_idx"] == len(baseline_dates) - 1 or (s_state["next_idx"] < len(baseline_dates) and baseline_dates[s_state["next_idx"]+1].year > current_year))
                        if is_last_day_of_year:
                            actual_buy = max_allowed
                        else:
                            actual_buy = min(actual_buy, max_allowed * 0.8)

                    actual_buy = min(actual_buy, s_state["annual_budget_remaining"][current_year][aid])
                    if actual_buy > 0 and row_prices[aid] > 0:
                        fee = max(actual_buy * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                        if actual_buy > fee:
                            s_state["units"][aid] += (actual_buy - fee) / row_prices[aid]
                            s_state["invested"] += actual_buy
                            s_state["fees"] += fee
                            s_state["annual_budget_remaining"][current_year][aid] -= actual_buy
                            s_contributions_today[aid] = actual_buy
                s_state["next_idx"] += 1

            # 5. End of year cleanup
            is_end_of_year = (idx == len(all_dates) - 1 or all_dates[idx+1].year > current_year)
            if is_end_of_year:
                for aid in asset_data:
                    rem = s_state["annual_budget_remaining"][current_year][aid]
                    if rem > 1.0 and row_prices[aid] > 0:
                        fee = max(rem * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                        if rem > fee:
                            s_state["units"][aid] += (rem - fee) / row_prices[aid]
                            s_state["invested"] += rem
                            s_state["fees"] += fee
                            s_contributions_today[aid] += rem
                            s_state["annual_budget_remaining"][current_year][aid] = 0

            # 6. Record history
            b_val = sum(b_state["units"][aid] * row_prices[aid] for aid in asset_data)
            s_val = sum(s_state["units"][aid] * row_prices[aid] for aid in asset_data)
            avg_p = sum(float(asset_data[aid]["weight"]) * row_prices[aid] for aid in asset_data)

            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "invested": float(round(float(s_state["invested"]), 2)),
                "baseline_value": float(round(float(b_val), 2)),
                "smart_value": float(round(float(s_val), 2)),
                "cumulative_fees": float(round(float(s_state["fees"]), 2)),
                "b_contribution": float(round(sum(b_contributions_today.values()), 2)),
                "s_contribution": float(round(sum(s_contributions_today.values()), 2)),
                "price": float(round(float(avg_p), 2))
            })

            for aid in asset_data:
                indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                asset_data[aid]["history"].append({
                    "date": date.strftime("%Y-%m-%d"),
                    "price": float(round(float(row_prices[aid]), 2)),
                    "indicator_value": float(round(float(indicator_row["indicator_value"]), 4)) if indicator_row is not None and pd.notna(indicator_row["indicator_value"]) else None,
                    "ma_short": float(round(float(indicator_row["ma_short_val"]), 2)) if indicator_row is not None and pd.notna(indicator_row.get("ma_short_val")) else None,
                    "ma_long": float(round(float(indicator_row["ma_long_val"]), 2)) if indicator_row is not None and pd.notna(indicator_row.get("ma_long_val")) else None,
                    "s_contribution": float(round(float(s_contributions_today[aid]), 2)),
                    "b_contribution": float(round(float(b_contributions_today[aid]), 2))
                })

        # --- FINAL AGGREGATION ---
        formatted_asset_results = []
        for aid, data in asset_data.items():
            final_p = row_prices[aid]
            s_units = s_state["units"][aid]
            total_inv_asset = initial_cap * float(data["weight"]) + (len(baseline_dates) * periodic_amount * float(data["weight"]))
            final_val_asset = s_units * final_p
            roi = ((final_val_asset - total_inv_asset) / total_inv_asset * 100) if total_inv_asset > 0 else 0
            formatted_asset_results.append({
                "asset_id": aid, "ticker": data["ticker"], "final_value": float(round(float(final_val_asset), 2)),
                "total_invested": float(round(float(total_inv_asset), 2)), "total_return_percent": float(round(float(roi), 2)),
                "assets_accumulated": float(s_units), "avg_price": float(round(float(total_inv_asset / s_units), 2)) if s_units > 0 else 0.0,
                "portfolio_history": data["history"]
            })

        total_inv = float(s_state["invested"])
        f_val = sum(s_state["units"][aid] * row_prices[aid] for aid in asset_data)
        b_f_val = sum(b_state["units"][aid] * row_prices[aid] for aid in asset_data)
        t_ret = ((f_val - total_inv) / total_inv * 100) if total_inv > 0 else 0
        b_ret = ((b_f_val - total_inv) / total_inv * 100) if total_inv > 0 else 0

        # Risk metrics
        smart_vals = np.array([p["smart_value"] for p in portfolio_history])
        vol = 0.0
        if len(smart_vals) > 1:
            rets = np.diff(smart_vals) / [v if v > 0 else 1 for v in smart_vals[:-1]]
            vol = float(np.std(rets) * 100)
        mdd = 0.0
        if len(smart_vals) > 0:
            pks = np.maximum.accumulate(smart_vals)
            dds = (smart_vals - pks) / [p if p > 0 else 1 for p in pks]
            if len(dds) > 0: mdd = float(np.min(dds) * 100)

        return {
            "final_value": float(round(f_val, 2)), "total_invested": float(round(total_inv, 2)), "total_return_percent": float(round(t_ret, 2)),
            "baseline_final_value": float(round(b_f_val, 2)), "baseline_return_percent": float(round(b_ret, 2)),
            "total_fees": float(round(float(s_state["fees"]), 2)), "fees_percentage": float(round(float((s_state["fees"] / total_inv * 100)), 2)) if total_inv > 0 else 0,
            "volatility": float(round(vol, 2)), "max_drawdown": float(round(mdd, 2)),
            "portfolio_history": self._aggregate_history_weekly(portfolio_history),
            "asset_results": formatted_asset_results
        }

    def _calculate_baseline_dates(self, df: pd.DataFrame, frequency: str) -> List[pd.Timestamp]:
        baseline_dates = []
        if frequency == 'daily': baseline_dates = df.index.tolist()
        else:
            grouped = df.groupby([df.index.year, df.index.month])
            for _, group in grouped:
                if frequency == 'weekly':
                    weeks = group.index.to_series().dt.isocalendar().week.unique()
                    for week in weeks: baseline_dates.append(group[group.index.to_series().dt.isocalendar().week == week].index[0])
                elif frequency == 'bi-monthly':
                    baseline_dates.append(group.index[0])
                    m = group[group.index.day >= 15]
                    if not m.empty: baseline_dates.append(m.index[0])
                elif frequency == 'monthly': baseline_dates.append(group.index[0])
        return sorted(list(set(baseline_dates)))

    def _aggregate_history_weekly(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not history: return []
        df = pd.DataFrame(history)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        c_cols = ["invested", "baseline_value", "smart_value", "cumulative_fees", "price"]
        w_c = df[c_cols].resample('W').last().ffill()
        cont_cols = ["b_contribution", "s_contribution"]
        w_cont = df[cont_cols].resample('W').sum()
        w = pd.concat([w_c, w_cont], axis=1)
        f_idx = df.index[0]
        if f_idx not in w.index:
            f = df.loc[f_idx:f_idx].copy()
            w = pd.concat([f, w]).sort_index()
        res = []
        for date, row in w.iterrows():
            p = row.to_dict()
            p['date'] = date.strftime("%Y-%m-%d")
            for col in c_cols + cont_cols: p[col] = float(round(float(p[col]), 2))
            res.append(p)
        return res

    def __del__(self):
        try:
            self.db.close()
        except:
            pass
