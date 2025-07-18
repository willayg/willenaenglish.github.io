import os
import requests
import csv
import re
import random
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../../../../.env'))
API_KEY = os.getenv('ELEVENLABS_API_KEY')
VOICE_IDS = [
    os.getenv('ELEVENLABS_VOICE_ID', 't48pCvC0g1kiVGYyVUCT'),
    'oNvlQihzGRXpXsYRhsku',
    'eG91bpIWBO32DYd3QWQp',
    '9BWtsMINqrJLrRacOk9x'
]
API_URL_TEMPLATE = "https://api.elevenlabs.io/v1/text-to-speech/{}"
CSV_PATH = os.path.join(os.path.dirname(__file__), 'starter.cvs')
OUTPUT_DIR = os.path.dirname(__file__)
print(f"Loaded API_KEY: {API_KEY}")
print(f"Loaded VOICE_IDS: {VOICE_IDS}")
print(f"CSV_PATH: {CSV_PATH}")
print("Files in Starter directory:")
for fname in os.listdir(os.path.dirname(__file__)):
    print(repr(fname))

def sanitize_filename(text):
    # Remove illegal filename characters and trim length
    text = re.sub(r'[\\/:*?"<>|]', '', text)
    return text[:100].replace('\n', '').strip()

def get_sentences(csv_path):
    sentences = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        for line in f:
            print(f"Read line: {repr(line)} | Length: {len(line)} | Bytes: {list(line.encode())}")
            sentence = line.strip().strip('"').strip(',')
            print(f"Processed sentence: {repr(sentence)} | Length: {len(sentence)} | Bytes: {list(sentence.encode())}")
            if sentence:
                sentences.append(sentence)
    print(f"Loaded sentences: {sentences}")
    return sentences

def text_to_speech(text, voice_id):
    api_url = API_URL_TEMPLATE.format(voice_id)
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1"
    }
    print(f"Requesting TTS for: {text} | Voice: {voice_id}")
    response = requests.post(api_url, headers=headers, json=payload)
    print(f"Response status: {response.status_code}")
    if response.status_code == 200:
        return response.content
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

def main():
    try:
        sentences = get_sentences(CSV_PATH)
        for sentence in sentences:
            voice_id = random.choice(VOICE_IDS)
            print(f"Processing: {sentence} | Using voice: {voice_id}")
            filename = sanitize_filename(sentence) + f'_{voice_id}.mp3'
            filepath = os.path.join(OUTPUT_DIR, filename)
            if os.path.exists(filepath):
                print(f"Skipping {filepath}, file already exists.")
                continue
            audio = text_to_speech(sentence, voice_id)
            if audio:
                with open(filepath, 'wb') as f:
                    f.write(audio)
                print(f"Saved: {filepath}")
            else:
                print(f"Failed: {sentence}")
    except Exception as e:
        import traceback
        print(f"Exception occurred: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()