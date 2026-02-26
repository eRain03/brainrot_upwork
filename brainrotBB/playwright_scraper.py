import urllib.parse
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def fetch_search_results(filters: dict):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        )
        page = context.new_page()
        
        # Build query parameters
        params = {}
        ms_rate = filters.get("ms_rate")
        if ms_rate and ms_rate != "0" and ms_rate != "none":
            params["steal-a-brainrot-ms"] = ms_rate
        
        mutations = filters.get("mutations")
        if mutations and mutations != "none":
            params["steal-a-brainrot-mutations"] = mutations
            
        category = filters.get("category")
        item_name = filters.get("item_name")
        
        # Only set te_v params if category/item are provided
        if category or item_name:
             params["te_v0"] = "Brainrot"
             if category:
                 params["te_v1"] = category
             if item_name and item_name != "Other":
                 params["te_v2"] = item_name

        params["gamePageOfferIndex"] = "1"
        params["gamePageOfferSize"] = "24"

        query_string = urllib.parse.urlencode(params)
        url = f"https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?{query_string}"
        
        logger.info(f"Navigating to: {url}")
        
        try:
            response = page.goto(url, timeout=45000, wait_until="domcontentloaded")
            logger.info(f"Page loaded. URL: {page.url}")
            
            # Wait for specific elements that indicate offers are loaded
            try:
                # Wait for at least one offer item or the 'no results' message
                page.wait_for_selector("eld-offer-item", timeout=20000)
                logger.info("Offer items detected.")
            except:
                logger.warning("Timeout waiting for 'eld-offer-item'. Validating page content...")
            
            # Allow a bit more time for any final hydration
            time.sleep(2)
            
            content = page.content()
            return parse_content(content)
            
        except Exception as e:
            logger.error(f"Error in Playwright fetch: {e}")
            return []
        finally:
            browser.close()

def parse_content(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    offers = []
    
    offer_items = soup.find_all("eld-offer-item")
    
    if not offer_items:
        logger.info("No offers found in HTML.")
        return []

    for item in offer_items:
        try:
            title_elem = item.select_one(".offer-title")
            price_elem = item.select_one("eld-offer-price strong")
            seller_elem = item.select_one(".seller-details .username")
            
            title = title_elem.get_text(strip=True) if title_elem else "N/A"
            price = price_elem.get_text(strip=True) if price_elem else "N/A"
            seller = seller_elem.get_text(strip=True) if seller_elem else "N/A"
            
            offers.append({
                "title": title,
                "price": price,
                "seller": seller
            })
        except Exception as e:
            logger.error(f"Error parsing item: {e}")
            continue
            
    return offers

if __name__ == "__main__":
    results = fetch_search_results("Toilet")
    print(f"Found {len(results)} offers:")
    for res in results[:5]:
        print(res)