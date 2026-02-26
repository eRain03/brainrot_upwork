import urllib.parse

def build_url(ms_rate, mutation, category, item):
    params = {}
    if ms_rate and ms_rate != "0":
        params["steal-a-brainrot-ms"] = ms_rate
    if mutation and mutation != "none":
        params["steal-a-brainrot-mutations"] = mutation
    
    # te_v0 is Item Type. Assumed Brainrot
    params["te_v0"] = "Brainrot"
    
    if category:
        params["te_v1"] = category
    if item and item != "Other":
        params["te_v2"] = item

    # Add default gamePageOfferIndex and Size
    params["gamePageOfferIndex"] = "1"
    params["gamePageOfferSize"] = "24"

    return f"https://www.eldorado.gg/steal-a-brainrot-brainrots/i/259?{urllib.parse.urlencode(params)}"

print(build_url("1-plus-bs", "lava", "OG", "Skibidi Toilet"))
