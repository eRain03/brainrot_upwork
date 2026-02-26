import httpx
import base64
import os
import json
from typing import Optional

BASE_URL = "https://apis.iflow.cn/v1"
MODEL_NAME = "qwen3-vl-plus"

async def analyze_image_with_ai(image_bytes: bytes, api_key: str) -> dict:
    """
    Analyzes an image using the Qwen-VL-Plus model via OpenAI-compatible API.
    Returns a JSON object with:
    - title (string)
    - mutation (string or null)
    - traits_count (integer)
    - brainrot_type (string: 'Free' or 'Non-free')
    - price_suggestion (number, optional)
    """
    
    # Encode image to base64
    base64_image = base64.b64encode(image_bytes).decode('utf-8')
    image_url = f"data:image/jpeg;base64,{base64_image}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    prompt = """
    You are an AI assistant for the game 'Steal a Brainrot'. 
    Your task is to analyze a screenshot of a game item listing or inventory.
    Extract the following information and return it in valid JSON format.

    Crucial: You must generate a 'title' that strictly follows the marketing format below, AND a 'clean_name' for searching.

    **Title Format Rules:**
    1. Start with a relevant emoji (e.g., 🌋 for Lava, 🌈 for Rainbow, 🚽 for generic).
    2. Follow with: "{Mutation} {Traits Count} Trait {Item Name} (OG/Variant if visible)".
    3. Add a fire emoji 🔥 and then the stats if visible (e.g., "4.4B/s").
    4. Add "(RARE SECRET)" or similar rarity tags if applicable.
    5. ALWAYS Append: "| (💸 CHEAPEST | 📦 FAST DELIVERY)"
    6. IF the item is "Free Brainrot" (look for "Free" tag or price 0), APPEND this specific suffix:
       "| Steal A Brainrot | COMES WITH FREE BRAINROT 🆓"

    **Clean Name Rules (For Search):**
    - MUST BE EXTREMELY SHORT AND PRECISE for market search.
    - ONLY include the Mutation (if any) and the base Item Name.
    - DO NOT include trait counts (like "26"), "OG", stats, emojis, or marketing fluff.
    - Example: "Lava Skibidi Toilet" or "Rainbow Camera Man"

    **Examples:**
    - Non-Free Item Title: "🌋 Lava 1 Trait Skibidi Toilet (OG) 🔥 4.4B/s (RARE SECRET) | (💸 CHEAPEST | 📦 FAST DELIVERY)"
    - Free Item Title: "🌈 Rainbow 2 Trait Camera Man 🔥 1.2B/s | (💸 CHEAPEST | 📦 FAST DELIVERY) | Steal A Brainrot | COMES WITH FREE BRAINROT 🆓"

    **Fields to Extract:**
    1. title: The formatted marketing string as defined above.
    2. clean_name: The clean item name for searching market prices (e.g. "Lava Skibidi Toilet").
    3. mutation: The mutation name (e.g., "Rainbow", "Lava"). Null if none.
    4. traits_count: The integer number of traits.
    5. brainrot_type: "Free" or "Non-free".
    6. price_suggestion: A rough integer estimate (e.g. 500). 0 if Free.
    7. item_name: The base item name WITHOUT mutations or OG tags, exactly as it might appear in a dictionary (e.g. "Skibidi Toilet", "Cocofanto Elefanto").
    8. ms_rate: The M/s or B/s rate as a string exactly as shown on the image (e.g. "4.4B/s", "150M/s"). Null if none.

    Return ONLY the JSON object. Do not include markdown code blocks.
    """

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_url
                        }
                    }
                ]
            }
        ],
        "max_tokens": 1000
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(f"{BASE_URL}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()
            
            content = result['choices'][0]['message']['content']
            
            # Clean up potential markdown code blocks
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "")
            elif content.startswith("```"):
                content = content.replace("```", "")
            
            return json.loads(content.strip())
            
        except Exception as e:
            print(f"Error calling AI API: {e}")
            # Fallback / Mock response for development if API fails
            return {
                "title": "Error Analyzing Image",
                "mutation": None,
                "traits_count": 0,
                "brainrot_type": "Non-free",
                "price_suggestion": 0,
                "error": str(e)
            }
