from fastapi import FastAPI, HTTPException, Query
from playwright_scraper import fetch_search_results
from typing import List, Dict
import logging

# Initialize FastAPI app
app = FastAPI(title="Eldorado Scraper API", version="1.0.0")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Eldorado Scraper API is running"}

@app.get("/search", response_model=List[Dict[str, str]])
def search_items(
    ms_rate: str = Query(None, description="M/s Rate (e.g. 1-plus-bs)"),
    mutations: str = Query(None, description="Mutations (e.g. lava)"),
    category: str = Query(None, description="Category (e.g. OG, Secret)"),
    item_name: str = Query(None, description="Specific item name (e.g. Skibidi Toilet)")
):
    """
    Search for items on Eldorado.gg using filters.
    """
    filters = {
        "ms_rate": ms_rate,
        "mutations": mutations,
        "category": category,
        "item_name": item_name
    }
    logger.info(f"Received search request for filters: {filters}")
    try:
        results = fetch_search_results(filters)
        if not results:
             # Depending on requirements, empty list might be 200 OK or 404
             # Returning empty list is standard for search
             logger.info("No results found.")
             return []
        
        logger.info(f"Returning {len(results)} results.")
        return results
    except Exception as e:
        logger.error(f"Internal server error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=6674)
