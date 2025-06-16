import os
import re
from dotenv import load_dotenv
import requests
import time

# === Load API Key and Voice ID from .env file ===
load_dotenv()
ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY")
ELEVEN_LABS_DEFAULT_VOICE_ID = os.getenv("ELEVEN_LABS_DEFAULT_VOICE_ID")
API_KEY = ELEVEN_LABS_API_KEY
VOICE_ID = ELEVEN_LABS_DEFAULT_VOICE_ID

# === Output folder ===
OUTPUT_DIR = "public/audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# === Prompts ===
prompts = [
    "Can you find the cat?",
    "Can you find the tree?",
    "Can you find the bike?",
    "Can you find the orange?",
    "Can you find the spoon?",
    "Can you find the sun?",
    "Can you find the baby?",
    "Can you find the cheese?",
    "Can you find the robot?",
    "Can you find the towel?",
    "Where is the dog?",
    "Where is the moon?",
    "Where is the phone?",
    "Where is the flower?",
    "Where is the bed?",
    "Where is the hot dog?",
    "Where is the lion?",
    "Where is the drum?",
    "Where is the clock?",
    "Where is the foot?",
    "Do you see the cloud?",
    "Do you see the duck?",
    "Do you see the puzzle?",
    "Do you see the lamp?",
    "Do you see the rice?",
    "Do you see the elephant?",
    "Do you see the plate?",
    "Do you see the book?",
    "Do you see the girl?",
    "Do you see the star?",
    "Point to the horse.",
    "Tap the fish, please.",
    "Let’s look for the key.",
    "Show me the milk.",
    "Can you show me the snow?",
    "I’m looking for the ant. Can you help?",
    "Hmm... where’s the carrot?",
    "Pick the TV!",
    "Let’s find the cookie together.",
    "Which one is the bear?",
    "Can you find the pig?",
    "Can you find the frog?",
    "Can you find the whale?",
    "Can you find the crab?",
    "Can you find the bee?",
    "Can you find the egg?",
    "Where is the apple?",
    "Where is the banana?",
    "Where is the bread?",
    "Where is the juice?",
    "Where is the chair?",
    "Do you see the fork?",
    "Do you see the cup?",
    "Do you see the bag?",
    "Do you see the broom?",
    "Do you see the soap?",
    "Point to the ant.",
    "Point to the snake.",
    "Show me the fire.",
    "Show me the water.",
    "Show me the grass.",
    "Let’s look for the bird.",
    "Let’s look for the sheep.",
    "Let’s find the cow.",
    "Let’s find the towel.",
    "Tap the plate, please.",
    "Tap the pencil, please.",
    "Tap the carrot, please.",
    "Pick the doll!",
    "Pick the ball!",
    "Pick the kite!",
    "Pick the tent!",
    "Can you find the mommy?",
    "Can you find the daddy?",
    "Can you find the friend?",
    "Can you find the boy?",
    "Can you find the girl?",
    "Can you find the hand?",
    "Can you find the face?",
    "Can you find the mouth?",
    "Where is the ear?",
    "Where is the eye?",
    "Where is the leg?",
    "Do you see the towel?",
    "Do you see the spoon?",
    "Do you see the game?",
    "Do you see the car?",
    "Do you see the ball?",
    "Point to the star.",
    "Point to the moon.",
    "Point to the rain.",
    "Point to the wind.",
    "Point to the fire.",
    "Show me the juice.",
    "Show me the cake.",
    "Show me the pizza.",
    "Show me the ice cream.",
    "Let’s look for the cheese.",
    "Let’s find the rice.",
    "Let’s find the meat.",
    "Let’s find the cookie.",
    "Hmm... where’s the fish?",
    "Hmm... where’s the bear?",
    "Hmm... where’s the lion?",
    "Hmm... where’s the monkey?",
    "Can you show me the tree?",
    "<speak>What is this? Carrot.<break time=\"400ms\"/></speak>"
]

# === Helper to extract filename from prompt ===
def extract_target_word(prompt):
    # Extract the last word before a period or at the end
    match = re.search(r'([A-Za-z가-힣]+)[\.\?]?$', prompt.strip())
    if match:
        return match.group(1).lower()
    return f"unknown_{hash(prompt)}"

# === Generate each audio file ===
def generate_audio(prompt):
    target_word = extract_target_word(prompt)
    filename = f"{target_word}.mp3"
    filepath = os.path.join(OUTPUT_DIR, filename)

    print(f"Generating: {filename} ...")

    # --- ElevenLabs API call ---
    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        headers={
            "xi-api-key": API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "text": prompt,
            "voice_settings": {
                "stability": 0.6,
                "similarity_boost": 0.5
            }
        }
    )

    if response.status_code == 200:
        with open(filepath, "wb") as f:
            f.write(response.content)
        print(f"Saved: {filepath}")
    else:
        print(f"Failed to generate for '{prompt}': {response.text}")

    time.sleep(1.2)  # To avoid rate limits

# === Main loop ===
print("Script started")
for prompt in prompts:
    generate_audio(prompt)

print("\\n✅ All MP3s saved to:", OUTPUT_DIR)
