# Starter to Level 1 MP3 Generator

This script generates MP3 audio files from text sentences in the `starter.cvs` file using ElevenLabs Text-to-Speech API.

## Features

- Converts all sentences from `starter.cvs` to MP3 format
- Uses the default ElevenLabs voice (configurable via environment variables)
- Outputs files to `Assets/audio/scripts-for-audio/level_1/` folder
- Skips files that already exist (resumable)
- Sanitizes filenames for Windows compatibility
- Provides detailed progress tracking

## Requirements

- Python 3.x
- Required packages: `requests`, `python-dotenv`
- ElevenLabs API key (set in `.env` file)

## Setup

1. Ensure your `.env` file contains:
   ```
   ELEVENLABS_API_KEY=your_api_key_here
   ELEVENLABS_VOICE_ID=your_default_voice_id_here
   ```

2. Install required packages (if not already installed):
   ```bash
   pip install requests python-dotenv
   ```

## Usage

Run the script from the `Starter` directory:

```bash
python starter_to_level1.py
```

## Output

- **Location**: `Assets/audio/scripts-for-audio/level_1/`
- **Format**: MP3 files with sanitized filenames
- **Naming**: Based on the sentence content (e.g., "What's this.mp3")

## Script Logic

1. Reads sentences from `starter.cvs`
2. Cleans up text (removes quotes, commas)
3. Sanitizes filename for each sentence
4. Checks if MP3 file already exists
5. If not, calls ElevenLabs API to generate audio
6. Saves MP3 file to output directory
7. Provides summary report

## Example Output

```
Processing 1/136: What's this?
✓ Saved: What's this.mp3

Processing 2/136: It's a pencil.
✓ Saved: It's a pencil.mp3

=== Summary ===
Total sentences: 136
Successful: 136
Failed: 0
```

## Notes

- The script automatically creates the output directory if it doesn't exist
- Files are skipped if they already exist, making the script resumable
- Special characters in filenames are removed for compatibility
- Progress is shown for each sentence being processed
