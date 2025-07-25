import os
import requests
import csv
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '../../../../../.env'))
API_KEY = os.getenv('ELEVENLABS_API_KEY')
DEFAULT_VOICE_ID = os.getenv('ELEVENLABS_VOICE_ID', 't48pCvC0g1kiVGYyVUCT')
API_URL_TEMPLATE = "https://api.elevenlabs.io/v1/text-to-speech/{}"

# Paths
CSV_PATH = os.path.join(os.path.dirname(__file__), 'starter.cvs')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../../scripts-for-audio/level_1')

print(f"Loaded API_KEY: {API_KEY}")
print(f"Using DEFAULT_VOICE_ID: {DEFAULT_VOICE_ID}")
print(f"CSV_PATH: {CSV_PATH}")
print(f"OUTPUT_DIR: {OUTPUT_DIR}")

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

def sanitize_filename(text):
    """Remove illegal filename characters and trim length"""
    text = re.sub(r'[\\/:*?"<>|]', '', text)
    return text[:100].replace('\n', '').strip()

def get_sentences(csv_path):
    """Extract sentences from the CSV file"""
    sentences = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        for line in f:
            print(f"Read line: {repr(line)} | Length: {len(line)}")
            # Clean up the sentence by removing quotes, commas, and extra whitespace
            sentence = line.strip().strip('"').strip(',').strip('"').strip()
            print(f"Processed sentence: {repr(sentence)} | Length: {len(sentence)}")
            if sentence:
                sentences.append(sentence)
    print(f"Total sentences loaded: {len(sentences)}")
    return sentences

def text_to_speech(text, voice_id):
    """Convert text to speech using ElevenLabs API"""
    api_url = API_URL_TEMPLATE.format(voice_id)
    headers = {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1"
    }
    
    print(f"Requesting TTS for: {text}")
    response = requests.post(api_url, headers=headers, json=payload)
    print(f"Response status: {response.status_code}")
    
    if response.status_code == 200:
        return response.content
    else:
        print(f"Error {response.status_code}: {response.text}")
        return None

def main():
    """Main function to process all sentences"""
    try:
        sentences = get_sentences(CSV_PATH)
        success_count = 0
        total_count = len(sentences)
        
        for i, sentence in enumerate(sentences, 1):
            print(f"\nProcessing {i}/{total_count}: {sentence}")
            
            # Create filename
            filename = sanitize_filename(sentence) + '.mp3'
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            # Skip if file already exists
            if os.path.exists(filepath):
                print(f"Skipping {filepath}, file already exists.")
                success_count += 1
                continue
            
            # Generate audio
            audio = text_to_speech(sentence, DEFAULT_VOICE_ID)
            if audio:
                with open(filepath, 'wb') as f:
                    f.write(audio)
                print(f"✓ Saved: {filename}")
                success_count += 1
            else:
                print(f"✗ Failed: {sentence}")
        
        print(f"\n=== Summary ===")
        print(f"Total sentences: {total_count}")
        print(f"Successful: {success_count}")
        print(f"Failed: {total_count - success_count}")
        print(f"Output directory: {OUTPUT_DIR}")
        
    except Exception as e:
        import traceback
        print(f"Exception occurred: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
