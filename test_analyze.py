import requests
import json

api_key = "sk-b6abb7d08e147c21e047724cbf981c7b"
url = "http://127.0.0.1:6671/analyze"
headers = {"Authorization": f"Bearer {api_key}"}
files = {"file": ("test.png", open("test.png", "rb"), "image/png")}

response = requests.post(url, headers=headers, files=files)
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")
