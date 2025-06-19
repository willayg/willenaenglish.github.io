import os
import requests
import re
import time
from dotenv import load_dotenv

# Load API keys from .env
load_dotenv("../../docs/.env")
API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

with open("es6_SENTENCES.md", "r", encoding="utf-8") as f:
    lines = [line.strip() for line in f if line.strip()]

url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"

headers = {
    "xi-api-key": API_KEY,
    "Content-Type": "application/json"
}

os.makedirs("mp3s", exist_ok=True)

def safe_filename(text):
    text = text.strip().replace(" ", "_")
    text = re.sub(r'[\\/*?:"<>|]', '', text)
    text = re.sub(r'[\']', '', text)
    return text[:100]

def generate_and_save(sentence, retries=5):
    filename = safe_filename(sentence) + ".mp3"
    mp3_path = os.path.join("mp3s", filename)
    if os.path.exists(mp3_path):
        print(f"Already exists, skipping: {mp3_path}")
        return
    data = {
        "text": sentence,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
    for attempt in range(retries):
        print(f"Generating audio for: {sentence} (Attempt {attempt+1})")
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            with open(mp3_path, "wb") as out:
                out.write(response.content)
            print(f"Saved: {mp3_path}")
            return
        elif response.status_code == 429:
            print(f"Rate limited or busy. Waiting before retrying...")
            time.sleep(10)
        else:
            print(f"Failed for: {sentence} ({response.status_code}) {response.text}")
            break
    else:
        print(f"Failed to generate after {retries} attempts: {sentence}")

for sentence in lines:
    if not sentence:
        continue
    generate_and_save(sentence)
    time.sleep(2)