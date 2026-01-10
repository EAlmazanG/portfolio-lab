import yfinance as yf
import pandas as pd
from typing import Optional, List
from datetime import datetime, timedelta
import logging

# Set up logging
logger = logging.getLogger(__name__)

class YahooFinanceClient:
    """Client to interact with Yahoo Finance API."""

    def __init__(self):
        """Initialize the client."""
        pass

    def get_historical_data(
        self, 
        ticker: str, 
        start_date: Optional[datetime] = None, 
        end_date: Optional[datetime] = None,
        period: str = "max",
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch historical OHLCV data for a given ticker.
        
        Args:
            ticker: The asset ticker (e.g., BTC-USD, AAPL).
            start_date: Start date for data.
            end_date: End date for data.
            period: Period to fetch (e.g., '1mo', '1y', 'max').
            interval: Data interval (e.g., '1d', '1wk', '1mo').
            
        Returns:
            pd.DataFrame: Historical market data.
        """
        try:
            logger.info(f"Fetching data for {ticker}...")
            
            # Create ticker object
            yticker = yf.Ticker(ticker)
            
            # Fetch history
            if start_date and end_date:
                df = yticker.history(start=start_date, end=end_date, interval=interval)
            elif start_date:
                df = yticker.history(start=start_date, interval=interval)
            else:
                df = yticker.history(period=period, interval=interval)
            
            if df.empty:
                logger.warning(f"No data found for {ticker}")
                return pd.DataFrame()

            # Clean column names (convert to lowercase)
            df.columns = [col.lower().replace(" ", "_") for col in df.columns]
            
            # Ensure the index is named 'date' and is a datetime objects
            df.index.name = 'date'
            
            logger.info(f"Successfully fetched {len(df)} rows for {ticker}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data for {ticker}: {str(e)}")
            return pd.DataFrame()

    def get_asset_info(self, ticker: str) -> dict:
        """
        Get metadata/info for a given ticker.
        
        Args:
            ticker: The asset ticker.
            
        Returns:
            dict: Asset information.
        """
        try:
            yticker = yf.Ticker(ticker)
            info = yticker.info
            return info
        except Exception as e:
            logger.error(f"Error fetching info for {ticker}: {str(e)}")
            return {}

    def search_assets(self, query: str) -> List[dict]:
        """
        Search for assets matching a query.
        
        Args:
            query: Search term (e.g., 'Apple', 'Bitcoin').
            
        Returns:
            List[dict]: List of matching assets with ticker and name.
        """
        try:
            search = yf.Search(query, max_results=10)
            return search.quotes
        except Exception as e:
            logger.error(f"Error searching for {query}: {str(e)}")
            return []

