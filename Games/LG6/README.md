# LG6 Game Documentation

## Overview
The LG6 project is an interactive game designed to help users practice sentence unscrambling. Players will be presented with sentences that have been scrambled into chunks, and they must rearrange the chunks to form the correct sentence.

## Project Structure
The project consists of the following files:

- **LG6.html**: The main HTML document that sets up the game interface.
- **LG6.js**: Contains the JavaScript logic for the game, including game mechanics and interactions.
- **LG6_contents.js**: Exports an array of sentence objects used in the game.
- **lg6_SENTENCES.md**: Contains the sentences used in the game for audio generation and content population.
- **download_lg6_11labs.py**: A Python script that generates audio files from the sentences using the Eleven Labs text-to-speech API.
- **mp3s/**: Directory for storing the generated voice mp3 files corresponding to the sentences.

## Setup Instructions
1. **Clone the Repository**: Download or clone the LG6 project repository to your local machine.
2. **Install Dependencies**: Ensure you have Python installed along with the required libraries. You may need to install `requests` and `python-dotenv` for the Python script.
3. **Configure API Keys**: Create a `.env` file in the `docs` directory with your Eleven Labs API key and voice ID.
4. **Generate Audio Files**: Run the `download_lg6_11labs.py` script to generate the audio files from the sentences in `lg6_SENTENCES.md`. This will populate the `mp3s` directory with the corresponding audio files.
5. **Open the Game**: Open `LG6.html` in a web browser to start playing the game.

## Usage
- Choose a game mode (Practice or Game) to begin.
- Follow the on-screen instructions to unscramble the sentences.
- Check your answers and track your score.

## Contributing
Feel free to contribute to the project by adding new features, improving the game mechanics, or enhancing the user interface. Please submit a pull request for any changes.

## License
This project is open-source and available for anyone to use and modify.