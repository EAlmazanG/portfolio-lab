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

    def _clean_val(self, val: Any, default: Any = 0.0) -> Any:
        """Helper to handle NaNs and Infs for JSON serialization."""
        try:
            if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
                return default
            return float(val)
        except:
            return default

    def run_simulation(self, config: PortfolioSimulationCreate) -> Dict[str, Any]:
        """
        Runs a multi-asset simulation with support for periodic rebalancing.
        """
        import sys
        print(f"DEBUG_SIM: Starting simulation with {len(config.asset_configs)} asset configs", file=sys.stderr)
        for aid, cfg in config.asset_configs.items():
            print(f"DEBUG_SIM: Asset {aid} (type={type(aid).__name__}): timing={cfg.dynamic_timing_enabled}, sizing={cfg.dynamic_sizing_enabled}, multiplier={cfg.sizing_multiplier}", file=sys.stderr)
        
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
        
        # Create per-asset annual budget structure for complete isolation
        years = set(d.year for d in all_dates)
        annual_budget_per_asset = {}
        for year in years:
            year_dates = [d for d in baseline_dates if d.year == year]
            year_total = float(len(year_dates) * periodic_amount)
            annual_budget_per_asset[year] = {
                aid: year_total * float(asset_data[aid]["weight"]) 
                for aid in asset_data
            }
        
        s_state = {
            "units": {aid: 0.0 for aid in asset_data},
            "invested": 0.0,
            "invested_per_asset": {aid: 0.0 for aid in asset_data},
            "fees": 0.0,
            "pending_per_asset": {aid: 0.0 for aid in asset_data},  # Per-asset pending for timing logic (isolation)
            "next_idx": 0,
            "annual_budget_per_asset": annual_budget_per_asset  # Per-asset budget for complete isolation
        }

        initial_cap = float(self.portfolio.initial_capital or 0.0)
        
        # Initial Investment
        if initial_cap > 0:
            for aid, data in asset_data.items():
                price = float(data["df"]["close"].iloc[0])
                a_cap = data["initial_amount"] if data["initial_amount"] > 0 else initial_cap * float(data["weight"])
                if a_cap > 0:
                    fee = max(a_cap * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                    units = (a_cap - fee) / price
                    b_state["units"][aid] += units
                    b_state["invested"] += a_cap
                    b_state["fees"] += fee
                    
                    s_state["units"][aid] += units
                    s_state["invested"] += a_cap
                    s_state["invested_per_asset"][aid] += a_cap
                    s_state["fees"] += fee

        portfolio_history = []
        
        # Add Initial Investment Point at start_date if it's before the first market data point
        # This prevents the chart from starting at 0 and showing a "spike"
        if all_dates:
            first_market_date = all_dates[0]
            if self.start_date < first_market_date:
                # Calculate initial values using the first available market price
                first_prices = {}
                for aid in asset_data:
                    valid_prices = asset_data[aid]["df"][asset_data[aid]["df"]["close"] > 0]["close"]
                    first_prices[aid] = float(valid_prices.iloc[0]) if not valid_prices.empty else float(asset_data[aid]["df"]["close"].iloc[0])
                
                b_val_init = sum(b_state["units"][aid] * first_prices[aid] for aid in asset_data)
                s_val_init = sum(s_state["units"][aid] * first_prices[aid] for aid in asset_data)
                avg_p_init = sum(float(asset_data[aid]["weight"]) * first_prices[aid] for aid in asset_data)
                
                asset_distribution_init = {f"asset_{aid}_val": float(s_state["units"][aid] * first_prices[aid]) for aid in asset_data}

                # Check if we already have an entry for this date to avoid duplicates
                if not portfolio_history or portfolio_history[0]["date"] != self.start_date.strftime("%Y-%m-%d"):
                    portfolio_history.append({
                        "date": self.start_date.strftime("%Y-%m-%d"),
                        "invested": float(s_state["invested"]),
                        "baseline_value": float(b_val_init),
                        "smart_value": float(s_val_init),
                        "cumulative_fees": float(s_state["fees"]),
                        "b_contribution": 0.0,
                        "s_contribution": 0.0,
                        "price": float(avg_p_init),
                        "is_rebalanced": False,
                        **asset_distribution_init
                    })
                    # Also add to individual asset history
                    for aid in asset_data:
                        asset_data[aid]["history"].append({
                            "date": self.start_date.strftime("%Y-%m-%d"),
                            "price": first_prices[aid],
                            "indicator_value": None,
                            "ma_short": None,
                            "ma_long": None,
                            "s_contribution": 0.0,
                            "b_contribution": 0.0
                        })
                else:
                    # If we already have the first day, ensure it doesn't have 0 values
                    if portfolio_history[0]["price"] <= 0:
                        portfolio_history[0]["price"] = float(avg_p_init)
                        portfolio_history[0]["baseline_value"] = float(b_val_init)
                        portfolio_history[0]["smart_value"] = float(s_val_init)
                        for aid in asset_distribution_init:
                            portfolio_history[0][aid] = asset_distribution_init[aid]
                        
                        # Also fix individual asset history if needed
                        for aid in asset_data:
                            if asset_data[aid]["history"] and asset_data[aid]["history"][0]["price"] <= 0:
                                asset_data[aid]["history"][0]["price"] = first_prices[aid]

        last_rebalance_date = all_dates[0]

        # --- MAIN LOOP ---
        for idx, date in enumerate(all_dates):
            current_year = date.year
            
            # 1. Update prices
            row_prices = {}
            for aid in asset_data:
                if date in asset_data[aid]["df"].index:
                    price = float(asset_data[aid]["df"].loc[date, "close"])
                    # If price is 0, try to use the previous price from history
                    if price <= 0 and len(asset_data[aid]["history"]) > 0:
                        price = asset_data[aid]["history"][-1]["price"]
                    # If still 0, try to look ahead for the first valid price
                    if price <= 0:
                        valid_prices = asset_data[aid]["df"][asset_data[aid]["df"]["close"] > 0]["close"]
                        if not valid_prices.empty:
                            price = float(valid_prices.iloc[0])
                        else:
                            # If NO valid price in the entire dataset, use a safe default
                            price = 0.01 
                    row_prices[aid] = price
                else:
                    prev_df = asset_data[aid]["df"][asset_data[aid]["df"].index < date]
                    if not prev_df.empty:
                        row_prices[aid] = float(prev_df["close"].iloc[-1])
                    else:
                        # Look ahead
                        valid_prices = asset_data[aid]["df"][asset_data[aid]["df"]["close"] > 0]["close"]
                        row_prices[aid] = float(valid_prices.iloc[0]) if not valid_prices.empty else 0.01

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
            is_rebalanced = False
            if config.rebalancing_enabled:
                # Calculate months passed more precisely
                months_passed = (date.year - last_rebalance_date.year) * 12 + (date.month - last_rebalance_date.month)
                
                # Trigger rebalance if interval reached
                if months_passed >= config.periodic_rebalancing_interval and idx > 0:
                    total_val = sum(s_state["units"][aid] * row_prices[aid] for aid in s_state["units"])
                    if total_val > 0:
                        is_rebalanced = True
                        for aid in s_state["units"]:
                            target_val = total_val * float(asset_data[aid]["weight"])
                            current_val = s_state["units"][aid] * row_prices[aid]
                            diff = target_val - current_val
                            
                            # Only execute if difference is significant (> $1)
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
                        
                        # Crucial: Reset the reference date to the exact date of rebalance
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

                # 4.2 Smart - Each asset is processed independently to ensure isolation
                smart_weights = {aid: float(asset_data[aid]["weight"]) for aid in asset_data}
                
                # Process each asset independently - no cross-contamination
                assets_to_buy = []
                for aid in asset_data:
                    a_cfg = asset_data[aid]["config"]
                    indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                    signal = int(indicator_row["signal"]) if indicator_row is not None and "signal" in indicator_row else 0
                    
                    # Base amount for this asset this period = its weight * periodic_amount
                    a_base_amount = periodic_amount * smart_weights[aid]
                    
                    # Get any pending from previous deferrals (timing)
                    a_pending = s_state["pending_per_asset"][aid]
                    s_state["pending_per_asset"][aid] = 0.0  # Reset pending
                    
                    if a_cfg.dynamic_timing_enabled and signal == 1:
                        # Overbought: defer this period's base contribution
                        buy_floor = a_base_amount * float(a_cfg.expensive_buy_ratio)
                        deferred = a_base_amount - buy_floor
                        
                        # Store deferred amount for later (when conditions improve)
                        s_state["pending_per_asset"][aid] = deferred + a_pending
                        
                        # Buy only the floor now (pending will be bought when oversold/neutral)
                        assets_to_buy.append((aid, buy_floor))
                    else:
                        # Neutral/Oversold or timing disabled: buy base amount + any accumulated pending
                        assets_to_buy.append((aid, a_base_amount + a_pending))
                
                for aid, amount in assets_to_buy:
                    a_cfg = asset_data[aid]["config"]
                    actual_buy = amount
                    if a_cfg.dynamic_sizing_enabled:
                        indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                        signal = int(indicator_row["signal"]) if indicator_row is not None and "signal" in indicator_row else 0
                        if signal == -1: actual_buy *= float(a_cfg.sizing_multiplier)
                        elif signal == 1: actual_buy *= float(a_cfg.expensive_buy_ratio)
                    
                    # Cap to this asset's own annual budget (isolation)
                    actual_buy = min(actual_buy, s_state["annual_budget_per_asset"][current_year][aid])
                    
                    if actual_buy > 0 and row_prices[aid] > 0:
                        fee = max(actual_buy * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                        if actual_buy > fee:
                            s_state["units"][aid] += (actual_buy - fee) / row_prices[aid]
                            s_state["invested"] += actual_buy
                            s_state["invested_per_asset"][aid] += actual_buy
                            s_state["fees"] += fee
                            s_state["annual_budget_per_asset"][current_year][aid] -= actual_buy
                            s_contributions_today[aid] = actual_buy
                s_state["next_idx"] += 1

            # 5. End of year cleanup - invest any remaining annual budget
            # NOTE: The annual budget represents the TOTAL that should be invested this year.
            # Pending is a subset of the budget that timing deferred - it's NOT additional money.
            # At year end, we invest whatever budget remains (which includes any pending amounts).
            is_end_of_year = (idx == len(all_dates) - 1 or all_dates[idx+1].year > current_year)
            if is_end_of_year:
                for aid in asset_data:
                    # Remaining budget = total that should have been invested but wasn't yet
                    # This already accounts for pending (pending is just "waiting" budget)
                    a_rem = s_state["annual_budget_per_asset"][current_year][aid]
                    
                    if a_rem > 1.0 and row_prices[aid] > 0:
                        fee = max(a_rem * (float(config.commission_fee_percent) / 100.0), float(config.minimum_fee_per_trade))
                        if a_rem > fee:
                            s_state["units"][aid] += (a_rem - fee) / row_prices[aid]
                            s_state["invested"] += a_rem
                            s_state["invested_per_asset"][aid] += a_rem
                            s_state["fees"] += fee
                            s_contributions_today[aid] += a_rem
                    
                    # Reset this asset's budget and pending for the year
                    s_state["annual_budget_per_asset"][current_year][aid] = 0.0
                    s_state["pending_per_asset"][aid] = 0.0

            # 6. Record history
            b_val = sum(b_state["units"][aid] * row_prices[aid] for aid in asset_data)
            s_val = sum(s_state["units"][aid] * row_prices[aid] for aid in asset_data)
            
            # DEBUG: Log differences when they diverge
            if is_baseline_day and abs(b_val - s_val) > 1:
                import sys
                print(f"DEBUG_DIFF: date={date}, b_val={b_val:.2f}, s_val={s_val:.2f}, diff={s_val-b_val:.2f}", file=sys.stderr)
                for aid in asset_data:
                    print(f"DEBUG_DIFF:   Asset {aid}: b_units={b_state['units'][aid]:.4f}, s_units={s_state['units'][aid]:.4f}", file=sys.stderr)
            avg_p = sum(float(asset_data[aid]["weight"]) * row_prices[aid] for aid in asset_data)
            
            # CRITICAL: Ensure price is never 0 in history if we have assets
            if avg_p <= 0 and idx > 0:
                avg_p = portfolio_history[-1]["price"]
            if b_val <= 0 and idx > 0:
                b_val = portfolio_history[-1]["baseline_value"]
            if s_val <= 0 and idx > 0:
                s_val = portfolio_history[-1]["smart_value"]
            
            # If it's the very first point and it's still 0, we must force it to the first valid price
            if avg_p <= 0 and idx == 0:
                # This should have been handled by the initial point logic, but as a last resort:
                first_prices = {aid: float(asset_data[aid]["df"][asset_data[aid]["df"]["close"] > 0]["close"].iloc[0]) for aid in asset_data}
                avg_p = sum(float(asset_data[aid]["weight"]) * first_prices[aid] for aid in asset_data)
                b_val = sum(b_state["units"][aid] * first_prices[aid] for aid in asset_data)
                s_val = sum(s_state["units"][aid] * first_prices[aid] for aid in asset_data)

            # Asset distribution for area chart - ensure keys are strings and values are floats
            asset_distribution = {f"asset_{aid}_val": float(s_state["units"][aid] * row_prices[aid]) for aid in asset_data}

            portfolio_history.append({
                "date": date.strftime("%Y-%m-%d"),
                "invested": float(s_state["invested"]),
                "baseline_value": float(b_val),
                "smart_value": float(s_val),
                "cumulative_fees": float(s_state["fees"]),
                "b_contribution": float(sum(b_contributions_today.values())),
                "s_contribution": float(sum(s_contributions_today.values())),
                "price": float(avg_p),
                "is_rebalanced": 1 if is_rebalanced else 0, # Force to int for reliable aggregation
                **asset_distribution
            })

            # Record individual asset history
            for aid in asset_data:
                a_cfg = asset_data[aid]["config"]
                show_indicators = a_cfg.dynamic_timing_enabled or a_cfg.dynamic_sizing_enabled
                
                # Ensure price is never 0 in history
                p_close_hist = self._clean_val(row_prices[aid])
                if p_close_hist <= 0 and len(asset_data[aid]["history"]) > 0:
                    p_close_hist = asset_data[aid]["history"][-1]["price"]
                
                indicator_row = asset_data[aid]["df"].loc[date] if date in asset_data[aid]["df"].index else None
                
                # CRITICAL: If indicator_row is None (missing date for this asset), 
                # we should ffill the indicator values to avoid gaps in the chart
                ind_val = None
                ma_s = None
                ma_l = None
                if indicator_row is not None:
                    ind_val = self._clean_val(indicator_row.get("indicator_value"), None)
                    ma_s = self._clean_val(indicator_row.get("ma_short_val"), None)
                    ma_l = self._clean_val(indicator_row.get("ma_long_val"), None)
                
                # If values are None, try to get them from previous history entry (Forward Fill)
                if ind_val is None and len(asset_data[aid]["history"]) > 0:
                    ind_val = asset_data[aid]["history"][-1].get("indicator_value")
                    ma_s = asset_data[aid]["history"][-1].get("ma_short")
                    ma_l = asset_data[aid]["history"][-1].get("ma_long")
                
                # If it's the very first point and still None, try to find the first valid indicator value in the DF
                if ind_val is None and not asset_data[aid]["df"].empty:
                    valid_inds = asset_data[aid]["df"][pd.notna(asset_data[aid]["df"]["indicator_value"])]["indicator_value"]
                    if not valid_inds.empty:
                        ind_val = self._clean_val(valid_inds.iloc[0], None)
                    elif asset_data[aid]["config"].smart_indicator == "RSI":
                        ind_val = 50.0 # Neutral fallback for RSI

                # Only show indicators if at least one smart feature is active for this asset
                if not show_indicators:
                    ind_val = None
                    ma_s = None
                    ma_l = None

                asset_data[aid]["history"].append({
                    "date": date.strftime("%Y-%m-%d"),
                    "price": float(round(p_close_hist, 2)),
                    "indicator_value": round(ind_val, 4) if ind_val is not None else None,
                    "ma_short": round(ma_s, 2) if ma_s is not None else None,
                    "ma_long": round(ma_l, 2) if ma_l is not None else None,
                    "s_contribution": float(round(self._clean_val(s_contributions_today[aid]), 2)),
                    "b_contribution": float(round(self._clean_val(b_contributions_today[aid]), 2))
                })

        # --- FINAL AGGREGATION ---
        formatted_asset_results = []
        for aid, data in asset_data.items():
            final_p = self._clean_val(row_prices[aid])
            s_units = self._clean_val(s_state["units"][aid])
            total_inv_asset = self._clean_val(s_state.get("invested_per_asset", {}).get(aid, initial_cap * float(data["weight"])))
            # Fallback if invested_per_asset is not yet tracked correctly in all paths
            if total_inv_asset <= 0:
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
        
        # Identify columns
        c_cols = ["invested", "baseline_value", "smart_value", "cumulative_fees", "price"]
        cont_cols = ["b_contribution", "s_contribution"]
        # Ensure we catch all asset value columns
        asset_val_cols = [str(c) for c in df.columns if str(c).startswith("asset_") and str(c).endswith("_val")]
        
        # Resample values (last known value of the week)
        # We use 'last' for cumulative values and 'sum' for periodic ones
        w_values = df[c_cols + asset_val_cols].resample('W').last().ffill()
        w_cont = df[cont_cols].resample('W').sum()
        
        # Resample rebalancing flag: 1 if ANY day in the week had a rebalance
        if "is_rebalanced" in df.columns:
            # Important: Use max() to catch the '1' flag if it happened any day
            w_reb = df["is_rebalanced"].resample('W').max().fillna(0)
        else:
            w_reb = pd.Series(0, index=w_values.index, name="is_rebalanced")
        
        # Combine everything
        w = pd.concat([w_values, w_cont, w_reb], axis=1)
        
        # Ensure the first day is always included to avoid starting with a gap
        f_idx = df.index[0]
        if f_idx not in w.index:
            f_row = df.loc[f_idx:f_idx].copy()
            w = pd.concat([f_row, w]).sort_index()
            
        res = []
        for date, row in w.iterrows():
            p = row.to_dict()
            p['date'] = date.strftime("%Y-%m-%d")
            
            # Clean and round numeric values
            for col in c_cols + cont_cols + asset_val_cols:
                if col in p:
                    val = p[col]
                    if pd.isna(val):
                        p[col] = 0.0
                    else:
                        p[col] = float(round(float(val), 2))
            
            # Explicitly cast is_rebalanced to boolean for frontend
            # We check if it's > 0 because max() of [0, 1, 0] is 1
            p['is_rebalanced'] = bool(p.get('is_rebalanced', 0) > 0)
            res.append(p)
        return res

    def __del__(self):
        try:
            self.db.close()
        except:
            pass
