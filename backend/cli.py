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

def add_asset_interactive():
    """Interactively add a new asset."""
    ticker = input("\nEnter asset ticker (e.g., AAPL, BTC-USD): ").strip().upper()
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
        
        default_type = info.get('quoteType', 'stock').lower()
        asset_type = input(f"Enter asset type (default: {default_type}): ").strip().lower()
        if not asset_type:
            asset_type = default_type
            
        sector = info.get('sector')
        
        asset = crud.create_asset(db, ticker=ticker, name=name, asset_type=asset_type, sector=sector)
        print(f"✅ Successfully added asset: {asset.name} ({asset.ticker})")
        
        # Ask to download history
        do_download = input("Do you want to download full history now? (y/n) [y]: ").strip().lower() or 'y'
        if do_download == 'y':
            print(f"📥 Downloading history for {ticker}...")
            df = client.get_historical_data(ticker, period="max")
            if not df.empty:
                count = crud.save_market_data(db, asset.id, df)
                print(f"✅ Saved {count} records.")
            else:
                print("❌ No data found.")
                
    finally:
        db.close()

def delete_asset_interactive():
    """Interactively delete an asset."""
    list_assets()
    ticker = input("\nEnter ticker to delete: ").strip().upper()
    if not ticker:
        return
    
    db = SessionLocal()
    try:
        asset = crud.get_asset_by_ticker(db, ticker)
        if not asset:
            print(f"❌ Asset {ticker} not found.")
            return
        
        confirm = input(f"⚠️  Are you sure you want to delete {asset.name} and ALL its history? (y/n): ").strip().lower()
        if confirm == 'y':
            db.delete(asset)
            db.commit()
            print(f"✅ Deleted {ticker}.")
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
        print(f"\n🚀 Updating {len(assets)} assets to current date...")
        
        total_assets_updated = 0
        total_records_saved = 0
        
        # Get today's date in UTC
        today = datetime.now(timezone.utc).date()
        
        for asset in assets:
            # Find the latest date for this asset
            latest_date_query = db.query(func.max(MarketData.date)).filter(MarketData.asset_id == asset.id).scalar()
            
            if latest_date_query:
                # Ensure latest_date is aware or naive consistently.
                # MarketData.date is naive in our model but we treat it as UTC.
                last_date = latest_date_query.date() if hasattr(latest_date_query, 'date') else latest_date_query
                
                # Start from the day after the last record
                start_date = latest_date_query + timedelta(days=1)
                
                # Check if we actually need an update
                if last_date >= today:
                    print(f"😴 {asset.ticker:<10} | Already up to date (last: {last_date})")
                    continue
                    
                print(f"📥 {asset.ticker:<10} | Fetching from {start_date.date()}...")
                df = client.get_historical_data(asset.ticker, start_date=start_date)
            else:
                print(f"📥 {asset.ticker:<10} | No history found. Downloading max...")
                df = client.get_historical_data(asset.ticker, period="max")
            
            if not df.empty:
                count = crud.save_market_data(db, asset.id, df)
                total_records_saved += count
                total_assets_updated += 1
                print(f"✅ {asset.ticker:<10} | Saved {count} new records.")
            else:
                print(f"ℹ️ {asset.ticker:<10} | No new data available.")
        
        print(f"\n✨ Done! Updated {total_assets_updated} assets, saved {total_records_saved} total records.")
                
    finally:
        db.close()

def list_assets():
    """List all assets in the database."""
    db = SessionLocal()
    try:
        assets = crud.get_assets(db)
        if not assets:
            print("\n📭 No assets found in database.")
            return

        print("\nAvailable Assets:")
        print("-" * 80)
        print(f"{'Ticker':<15} {'Name':<35} {'Type':<15} {'Records':<10}")
        print("-" * 80)
        for asset in assets:
            # Count records
            count = db.query(MarketData).filter(MarketData.asset_id == asset.id).count()
            print(f"{asset.ticker:<15} {asset.name[:33]:<35} {asset.asset_type:<15} {count:<10}")
        print("-" * 80)
    finally:
        db.close()

def interactive_menu():
    """Main interactive menu loop."""
    while True:
        print("\n" + "="*40)
        print(" 🧪 PORTFOLIO-LAB DATA MANAGER ".center(40, "="))
        print("="*40)
        print(" 1. 📋 List Assets")
        print(" 2. ➕ Add New Asset")
        print(" 3. 🚀 Update All (Sync Missing Data)")
        print(" 4. 🗑️  Delete Asset")
        print(" 5. 🚪 Exit")
        print("="*40)
        
        choice = input("\nSelect an option (1-5): ").strip()
        
        if choice == '1':
            list_assets()
        elif choice == '2':
            add_asset_interactive()
        elif choice == '3':
            update_all_assets()
        elif choice == '4':
            delete_asset_interactive()
        elif choice == '5' or choice.lower() == 'q':
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
