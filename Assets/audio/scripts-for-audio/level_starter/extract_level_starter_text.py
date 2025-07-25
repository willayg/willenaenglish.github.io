import os
import requests
import re
from dotenv import load_dotenv

def get_sentences(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip()]

def sanitize_filename(text):
    text = re.sub(r'[\\/:*?"<>|]', '', text)
    return text[:100].replace('\n', '').strip()

def text_to_speech(text, voice_id, api_key):
    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json"
    }
    # Calm voice settings
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.7,
            "similarity_boost": 0.3,
            "style": 0.2,
            "use_speaker_boost": False
        }
    }
    response = requests.post(api_url, headers=headers, json=payload)
    if response.status_code == 200:
        return response.content
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

def main():
    load_dotenv(os.path.join(os.path.dirname(__file__), '../../../../.env'))
    API_KEY = os.getenv('ELEVENLABS_API_KEY')
    VOICE_ID = os.getenv('ELEVENLABS_VOICE_ID', 't48pCvC0g1kiVGYyVUCT')
    INPUT_PATH = os.path.join(os.path.dirname(__file__), 'Level_Starter(1_2).txt')
    OUTPUT_DIR = os.path.dirname(__file__)

    print(f"Loaded API_KEY: {API_KEY}")
    print(f"Using VOICE_ID: {VOICE_ID}")
    print(f"Input file: {INPUT_PATH}")
    print(f"Output directory: {OUTPUT_DIR}")

    sentences = get_sentences(INPUT_PATH)
    print(f"Total sentences: {len(sentences)}")

    for i, sentence in enumerate(sentences, 1):
        filename = sanitize_filename(sentence) + '.mp3'
        filepath = os.path.join(OUTPUT_DIR, filename)
        if os.path.exists(filepath):
            print(f"Skipping {filename}, file already exists.")
            continue
        print(f"[{i}/{len(sentences)}] Generating: {sentence}")
        audio = text_to_speech(sentence, VOICE_ID, API_KEY)
        if audio:
            with open(filepath, 'wb') as f:
                f.write(audio)
            print(f"✓ Saved: {filename}")
        else:
            print(f"✗ Failed: {sentence}")

if __name__ == "__main__":
    main()
