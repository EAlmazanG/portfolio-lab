import argparse
import sys
import os
from datetime import datetime, timedelta, timezone
from backend.db.session import SessionLocal
from backend.db import crud
from backend.data_ingestion.yfinance_client import YahooFinanceClient
from backend.models.market_data import MarketData
from backend.models.asset import Asset
from sqlalchemy import func
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# Suppress noisy logs from third party libraries
logging.getLogger("yfinance").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

def manage_settings():
    """Interactively manage global settings."""
    db = SessionLocal()
    try:
        while True:
            years = crud.get_setting(db, "ingestion_years", "10")
            interval = crud.get_setting(db, "ingestion_interval", "1d")
            
            print("\n" + "-"*30)
            print(" ⚙️  GLOBAL SETTINGS ".center(30, "-"))
            print("-"*30)
            print(f" 1. Back-download years: {years} years")
            print(f" 2. Ingestion interval : {interval} (e.g. 1d, 1wk, 1mo)")
            print(" 3. Return to Main Menu")
            print("-"*30)
            
            choice = input("\nEdit option (1-2) or return (3): ").strip()
            
            if choice == '1':
                new_years = input(f"Enter new value [currently {years}]: ").strip()
                if new_years.isdigit():
                    crud.update_setting(db, "ingestion_years", new_years, "Years of history to download for new assets")
                    print("✅ Setting updated.")
                else:
                    print("❌ Invalid input. Please enter a number.")
            elif choice == '2':
                new_interval = input(f"Enter new interval [currently {interval}]: ").strip()
                if new_interval in ["1d", "1wk", "1mo"]:
                    crud.update_setting(db, "ingestion_interval", new_interval, "Historical data interval")
                    print("✅ Setting updated.")
                else:
                    print("❌ Invalid interval. Choose from: 1d, 1wk, 1mo")
            elif choice == '3':
                break
    finally:
        db.close()

def add_asset_interactive():
    """Interactively add a new asset with category suggestions."""
    categories = {
        "1": {"name": "Crypto", "type": "crypto", "tickers": ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD"]},
        "2": {"name": "Stocks", "type": "stock", "tickers": ["AAPL", "TSLA", "MSFT", "NVDA", "GOOGL"]},
        "3": {"name": "Indices", "type": "index", "tickers": ["^GSPC", "^IXIC", "^IBEX", "^GDAXI", "^FTSE"]},
        "4": {"name": "Commodities", "type": "commodity", "tickers": ["GC=F", "SI=F", "CL=F"]},
        "5": {"name": "Custom Ticker", "type": "custom", "tickers": []}
    }

    print("\n--- Select Asset Category ---")
    for k, v in categories.items():
        print(f"{k}. {v['name']}")
    
    cat_choice = input("\nSelect category (1-5): ").strip()
    if cat_choice not in categories:
        print("❌ Invalid selection.")
        return

    selected_cat = categories[cat_choice]
    ticker = ""

    if selected_cat["type"] == "custom":
        ticker = input("\nEnter custom ticker (e.g., PLTR): ").strip().upper()
    else:
        print(f"\n--- Suggested {selected_cat['name']} ---")
        for i, t in enumerate(selected_cat["tickers"], 1):
            print(f"{i}. {t}")
        print(f"{len(selected_cat['tickers']) + 1}. Enter custom {selected_cat['name']} ticker")
        
        tick_choice = input(f"\nSelect ticker (1-{len(selected_cat['tickers']) + 1}): ").strip()
        
        try:
            idx = int(tick_choice) - 1
            if 0 <= idx < len(selected_cat["tickers"]):
                ticker = selected_cat["tickers"][idx]
            elif idx == len(selected_cat["tickers"]):
                ticker = input(f"Enter custom {selected_cat['name']} ticker: ").strip().upper()
        except ValueError:
            print("❌ Invalid selection.")
            return

    if not ticker:
        return

    db = SessionLocal()
    try:
        existing = crud.get_asset_by_ticker(db, ticker)
        if existing:
            print(f"\n⚠️  Asset {ticker} already exists: {existing.name}")
            return

        client = YahooFinanceClient()
        print(f"🔍 Fetching info for {ticker} from Yahoo Finance...")
        info = client.get_asset_info(ticker)
        
        name = info.get('longName') or info.get('shortName') or ticker
        print(f"✨ Found: {name}")
        
        default_type = selected_cat["type"] if selected_cat["type"] != "custom" else info.get('quoteType', 'stock').lower()
        asset_type = input(f"Confirm asset type (default: {default_type}): ").strip().lower() or default_type
            
        sector = info.get('sector')
        
        # Get settings for interval
        interval = crud.get_setting(db, "ingestion_interval", "1d")
        
        asset = crud.create_asset(db, ticker=ticker, name=name, asset_type=asset_type, sector=sector)
        # Update interval in asset model (since create_asset doesn't handle it yet)
        asset.interval = interval
        db.commit()
        
        print(f"✅ Successfully added asset: {asset.name} ({asset.ticker})")
        
        # Get settings for download
        years = int(crud.get_setting(db, "ingestion_years", "10"))
        
        # Ask to download history
        do_download = input(f"Do you want to download history ({years} years, {interval} interval)? (y/n) [y]: ").strip().lower() or 'y'
        if do_download == 'y':
            print(f"📥 Downloading history for {ticker}...")
            start_date = datetime.now(timezone.utc) - timedelta(days=years*365)
            df = client.get_historical_data(ticker, start_date=start_date, interval=interval)
            if not df.empty:
                count = crud.save_market_data(db, asset.id, df)
                print(f"✅ Saved {count} records.")
            else:
                print("❌ No data found.")
                
    finally:
        db.close()

def search_asset_interactive():
    """Search for assets on Yahoo Finance without adding them."""
    client = YahooFinanceClient()
    
    while True:
        query = input("\n🔍 Enter search term (e.g., Apple, Bitcoin, S&P 500) or 'q' to go back: ").strip()
        if not query or query.lower() == 'q':
            break

        print(f"⏳ Searching for '{query}'...")
        results = client.search_assets(query)

        if not results:
            print("❌ No results found. Try another term.")
            continue

        while True:
            print("\n" + "Search Results:".center(80, "-"))
            print(f"{'#':<3} {'Ticker':<12} {'Name':<40} {'Type':<10} {'Exchange':<10}")
            print("-" * 80)
            
            tickers_in_results = []
            for i, res in enumerate(results, 1):
                symbol = res.get('symbol', 'N/A')
                tickers_in_results.append(symbol)
                name = res.get('longname') or res.get('shortname') or 'N/A'
                quote_type = res.get('quoteType', 'N/A')
                exch = res.get('exchange', 'N/A')
                print(f"{i:<3} {symbol:<12} {name[:38]:<40} {quote_type:<10} {exch:<10}")
            print("-" * 80)
            
            print("\nOptions: [Number] Select index | [Ticker] Custom ticker | [s] New search | [q] Back")
            choice = input("👉 Select an option: ").strip()
            
            if not choice:
                continue
            
            if choice.lower() == 's':
                break # Break inner loop to prompt for new query
            if choice.lower() == 'q':
                return # Exit function

            # Determine selected ticker
            selected_ticker = ""
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(tickers_in_results):
                    selected_ticker = tickers_in_results[idx]
                else:
                    print(f"❌ Invalid index: {choice}")
                    continue
            else:
                selected_ticker = choice.upper()

            # Show details for selected ticker
            print(f"🔍 Fetching details for {selected_ticker}...")
            info = client.get_asset_info(selected_ticker)
            if not info or not (info.get('longName') or info.get('shortName')):
                print(f"❌ Could not find details for {selected_ticker}. It might be an invalid ticker.")
                continue

            print("\n" + f" Details: {selected_ticker} ".center(60, "="))
            print(f"  🏢 Name:      {info.get('longName') or info.get('shortName')}")
            print(f"  🎫 Ticker:    {selected_ticker}")
            print(f"  📊 Type:      {info.get('quoteType', 'N/A')}")
            print(f"  🏭 Sector:    {info.get('sector', 'N/A')}")
            print(f"  💰 Currency:  {info.get('currency', 'N/A')}")
            print(f"  🏛️  Exchange:  {info.get('exchange', 'N/A')}")
            desc = info.get('longBusinessSummary', 'No description available.')
            print(f"  📝 Summary:   {desc[:350]}...")
            print("=" * 60)
            
            while True:
                print(f"\nOptions for {selected_ticker}: [a] Add to DB | [b] Back to results | [s] New search | [q] Exit search")
                post_detail_choice = input("👉 Choice: ").strip().lower()
                
                if post_detail_choice == 'a':
                    db = SessionLocal()
                    try:
                        existing = crud.get_asset_by_ticker(db, selected_ticker)
                        if existing:
                            print(f"⚠️  Already exists in database: {existing.name}")
                        else:
                            asset_type = info.get('quoteType', 'stock').lower()
                            sector = info.get('sector')
                            interval = crud.get_setting(db, "ingestion_interval", "1d")
                            
                            asset = crud.create_asset(db, ticker=selected_ticker, name=info.get('longName') or selected_ticker, asset_type=asset_type, sector=sector)
                            asset.interval = interval
                            db.commit()
                            print(f"✅ Added {asset.name} ({asset.ticker}) to database.")
                            
                            # Optional download
                            years = int(crud.get_setting(db, "ingestion_years", "10"))
                            do_dl = input(f"📥 Download {years}y history now? (y/n) [y]: ").strip().lower() or 'y'
                            if do_dl == 'y':
                                start_dt = datetime.now(timezone.utc) - timedelta(days=years*365)
                                df = client.get_historical_data(selected_ticker, start_date=start_dt, interval=interval)
                                if not df.empty:
                                    count = crud.save_market_data(db, asset.id, df)
                                    print(f"✅ Saved {count} records.")
                    finally:
                        db.close()
                    break # Go back to results
                elif post_detail_choice == 'b':
                    break # Back to results list
                elif post_detail_choice == 's':
                    # This is tricky, need to break multiple loops. 
                    # Let's use a "state" or just exit and rely on outer loop.
                    # We can break this inner loop and set a flag.
                    break 
                elif post_detail_choice == 'q':
                    return
                else:
                    print("❌ Invalid option.")
            
            if post_detail_choice == 's':
                break # Break the "Search Results" loop to get back to "Enter search term"

def delete_asset_interactive():
    """Interactively delete an asset."""
    db = SessionLocal()
    try:
        assets = crud.get_assets(db)
        if not assets:
            print("\n📭 No assets to delete.")
            return

        print("\nSelect asset to delete:")
        for i, asset in enumerate(assets, 1):
            print(f"{i}. {asset.ticker} - {asset.name}")
        
        choice = input("\nSelect number (or 'c' to cancel): ").strip()
        if choice.lower() == 'c':
            return
            
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(assets):
                asset = assets[idx]
                confirm = input(f"⚠️  Are you sure you want to delete {asset.ticker} and ALL its data? (y/n): ").strip().lower()
                if confirm == 'y':
                    if crud.delete_asset(db, asset.id):
                        print(f"✅ Asset {asset.ticker} deleted.")
                    else:
                        print(f"❌ Error deleting asset.")
            else:
                print("❌ Invalid selection.")
        except ValueError:
            print("❌ Invalid input.")
    finally:
        db.close()

def update_all_assets():
    """Update all existing assets with the latest market data."""
    db = SessionLocal()
    try:
        assets = crud.get_assets(db)
        if not assets:
            print("\n❌ No assets found in database to update.")
            return

        client = YahooFinanceClient()
        
        # Get settings
        years = int(crud.get_setting(db, "ingestion_years", "10"))
        interval = crud.get_setting(db, "ingestion_interval", "1d")
        
        print(f"\n🚀 Updating {len(assets)} assets (Settings: {years}y, {interval} interval)...")
        
        total_assets_updated = 0
        total_records_saved = 0
        
        today = datetime.now(timezone.utc).date()
        
        for asset in assets:
            # Find the earliest and latest dates for this asset
            latest_date_query = db.query(func.max(MarketData.date)).filter(MarketData.asset_id == asset.id).scalar()
            earliest_date_query = db.query(func.min(MarketData.date)).filter(MarketData.asset_id == asset.id).scalar()
            
            target_start_date = datetime.now(timezone.utc) - timedelta(days=years*365)
            
            # Case 1: Filling history if we don't have enough years back
            if earliest_date_query and earliest_date_query.replace(tzinfo=timezone.utc) > target_start_date:
                print(f"📥 {asset.ticker:<10} | Back-filling history to reach {years} years...")
                df_back = client.get_historical_data(asset.ticker, start_date=target_start_date, end_date=earliest_date_query, interval=interval)
                if not df_back.empty:
                    count = crud.save_market_data(db, asset.id, df_back)
                    total_records_saved += count
                    print(f"✅ {asset.ticker:<10} | Back-filled {count} records.")

            # Case 2: Regular sync to today
            if latest_date_query:
                last_date = latest_date_query.date() if hasattr(latest_date_query, 'date') else latest_date_query
                start_date = latest_date_query + timedelta(days=1)
                
                if last_date >= today:
                    print(f"😴 {asset.ticker:<10} | Already up to date (last: {last_date})")
                else:
                    print(f"📥 {asset.ticker:<10} | Fetching from {start_date.date()} to today...")
                    df = client.get_historical_data(asset.ticker, start_date=start_date, interval=interval)
                    if not df.empty:
                        count = crud.save_market_data(db, asset.id, df)
                        total_records_saved += count
                        total_assets_updated += 1
                        print(f"✅ {asset.ticker:<10} | Saved {count} new records.")
            else:
                # No data at all
                print(f"📥 {asset.ticker:<10} | No history found. Downloading {years} years...")
                df = client.get_historical_data(asset.ticker, start_date=target_start_date, interval=interval)
                if not df.empty:
                    count = crud.save_market_data(db, asset.id, df)
                    total_records_saved += count
                    total_assets_updated += 1
                    print(f"✅ {asset.ticker:<10} | Saved {count} new records.")
        
        print(f"\n✨ Done! Total new records saved: {total_records_saved}")
                
    finally:
        db.close()

def list_assets():
    """List all assets in the database with data range info."""
    db = SessionLocal()
    try:
        assets = crud.get_assets(db)
        if not assets:
            print("\n📭 No assets found in database.")
            return

        print("\nAvailable Assets:")
        print("-" * 115)
        print(f"{'Ticker':<12} {'Name':<25} {'Type':<10} {'Interval':<10} {'First Rec':<12} {'Last Rec':<12} {'Records':<10}")
        print("-" * 115)
        for asset in assets:
            # Get stats for this asset
            stats = db.query(
                func.count(MarketData.id).label("count"),
                func.min(MarketData.date).label("min_date"),
                func.max(MarketData.date).label("max_date")
            ).filter(MarketData.asset_id == asset.id).one()
            
            count = stats.count
            first_rec = stats.min_date.date() if stats.min_date else "N/A"
            last_rec = stats.max_date.date() if stats.max_date else "N/A"
            interval = asset.interval or "1d"
            
            print(f"{asset.ticker:<12} {asset.name[:23]:<25} {asset.asset_type:<10} {interval:<10} {str(first_rec):<12} {str(last_rec):<12} {count:<10}")
        print("-" * 115)
    finally:
        db.close()

def interactive_menu():
    """Main interactive menu loop."""
    while True:
        print("\n" + "="*40)
        print(" 🧪 PORTFOLIO-LAB DATA MANAGER ".center(40, "="))
        print("="*40)
        print(" 1. 📋 List Assets")
        print(" 2. 🔍 Search Assets (Explore)")
        print(" 3. ➕ Add New Asset (Quick Add)")
        print(" 4. 🚀 Update All (Sync Missing Data)")
        print(" 5. ⚙️  Configure Settings")
        print(" 6. 🗑️  Delete Asset")
        print(" 7. 🚪 Exit")
        print("="*40)
        
        choice = input("\nSelect an option (1-7): ").strip()
        
        if choice == '1':
            list_assets()
        elif choice == '2':
            search_asset_interactive()
        elif choice == '3':
            add_asset_interactive()
        elif choice == '4':
            update_all_assets()
        elif choice == '5':
            manage_settings()
        elif choice == '6':
            delete_asset_interactive()
        elif choice == '7' or choice.lower() == 'q':
            print("\nExiting. Goodbye! 👋")
            break
        else:
            print("\n❌ Invalid option. Please try again.")

def main():
    # If no arguments provided, run interactive menu
    if len(sys.argv) == 1:
        interactive_menu()
        return

    # Non-interactive CLI
    parser = argparse.ArgumentParser(description='Portfolio-Lab CLI Tool')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # add-asset command
    parser_add = subparsers.add_parser('add-asset', help='Add a new asset')
    parser_add.add_argument('--ticker', required=True, help='Asset ticker')
    parser_add.add_argument('--name', help='Asset name')
    parser_add.add_argument('--type', help='Asset type')
    parser_add.add_argument('--sector', help='Asset sector')

    # download command
    parser_download = subparsers.add_parser('download', help='Download historical data for specific asset')
    parser_download.add_argument('--ticker', required=True, help='Asset ticker')
    parser_download.add_argument('--start', help='Start date (YYYY-MM-DD)')
    parser_download.add_argument('--period', default='max', help='Period (1y, max, etc.)')

    # update-all command
    parser_update = subparsers.add_parser('update-all', help='Update all assets to current date')

    # list command
    parser_list = subparsers.add_parser('list', help='List all assets')

    args = parser.parse_args()
    
    if args.command == 'add-asset':
        db = SessionLocal()
        try:
            client = YahooFinanceClient()
            info = client.get_asset_info(args.ticker)
            name = args.name or info.get('longName') or info.get('shortName') or args.ticker
            asset_type = args.type or info.get('quoteType', 'stock').lower()
            asset = crud.create_asset(db, ticker=args.ticker, name=name, asset_type=asset_type, sector=args.sector or info.get('sector'))
            print(f"✅ Added {asset.ticker}")
        finally:
            db.close()
            
    elif args.command == 'download':
        db = SessionLocal()
        try:
            asset = crud.get_asset_by_ticker(db, args.ticker)
            if not asset:
                print(f"❌ Asset {args.ticker} not found.")
                return
            client = YahooFinanceClient()
            start = datetime.strptime(args.start, '%Y-%m-%d') if args.start else None
            df = client.get_historical_data(args.ticker, start_date=start, period=args.period)
            if not df.empty:
                count = crud.save_market_data(db, asset.id, df)
                print(f"✅ Saved {count} records for {args.ticker}")
            else:
                print(f"ℹ️ No new data for {args.ticker}")
        finally:
            db.close()
            
    elif args.command == 'update-all':
        update_all_assets()
        
    elif args.command == 'list':
        list_assets()
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
