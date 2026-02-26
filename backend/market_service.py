import httpx
import re
from typing import List, Dict, Any, Optional

CRAWLER_URL = "http://localhost:6674/search"

async def fetch_market_prices(filters: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetches market data from the local crawler, cleans prices, 
    sorts by price (low to high), and calculates average.
    """
    if not filters:
        return {"items": [], "average": 0}

    # Clean out None or empty string values from filters before passing
    clean_filters = {k: v for k, v in filters.items() if v}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(CRAWLER_URL, params=clean_filters, timeout=15.0)
            response.raise_for_status()
            raw_items = response.json()
            
            cleaned_items = []
            total_price = 0
            valid_count = 0

            for item in raw_items:
                raw_price = item.get("price", "0")
                # Remove non-numeric characters except dots (for decimals)
                # The example shows "¥70,894", so we remove '¥' and ','
                price_numeric_str = re.sub(r'[^\d.]', '', raw_price)
                
                try:
                    price_val = float(price_numeric_str)
                except ValueError:
                    price_val = 0.0

                cleaned_items.append({
                    "title": item.get("title"),
                    "price_raw": raw_price,
                    "price_val": price_val,
                    "seller": item.get("seller")
                })

                if price_val > 0:
                    total_price += price_val
                    valid_count += 1
            
            # Sort by price ascending
            cleaned_items.sort(key=lambda x: x["price_val"])

            average = total_price / valid_count if valid_count > 0 else 0

            return {
                "items": cleaned_items,
                "average": round(average, 2)
            }

    except Exception as e:
        print(f"Error fetching market prices: {e}")
        return {"items": [], "average": 0, "error": str(e)}
