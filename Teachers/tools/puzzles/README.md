# Standalone Wordsearch Generator

A complete, standalone wordsearch puzzle generator with the same UI design as the reading worksheet tool.

## Features

### Core Functionality
- **Grid Generation**: Creates wordsearch grids from 10x10 to 20x20
- **Word Placement**: Smart algorithm places words horizontally, vertically, and diagonally
- **Flexible Options**: 
  - Allow/disallow diagonal words
  - Allow/disallow backwards words
  - Uppercase or lowercase letters
  - Multiple font options (Arial, Courier New, Comic Sans, Nanum Pen Script)

### AI-Powered Features
- **Category Word Generation**: Enter a category (animals, colors, food, etc.) to automatically generate relevant words
- **Text Analysis**: Paste text to extract suitable words for the puzzle
- **Smart Filtering**: Automatically filters out common words and duplicates

### User Interface
- **Live Preview**: See your wordsearch update in real-time as you make changes
- **Answer Highlighting**: Toggle to show/hide answers with yellow highlighting
- **Template Options**: Choose from 3 different worksheet designs
- **Size & Position Controls**: Adjust puzzle size and position with sliders

### Export & Save
- **Print Function**: Print-optimized worksheets
- **Save/Load**: Save your wordsearch configurations as JSON files
- **Multiple Templates**: Professional worksheet layouts with header, name/date fields

## How to Use

### Basic Usage
1. Open `wordsearch.html` in your browser
2. Enter a title and instructions (optional)
3. Add words in the "Words to Find" textarea (one per line)
4. Click "Generate Wordsearch" to create your puzzle
5. Use "Show Answers" to highlight the hidden words

### AI Word Generation
1. Enter a category in the "AI Word Generation" field (e.g., "animals", "food", "colors")
2. Click "Generate" to automatically fill the word list
3. The wordsearch will generate automatically

### Text Analysis
1. Paste any text into the "Extract Words from Text" area
2. Click "Extract Words" to find suitable words from the text
3. The system will filter out common words and extract meaningful vocabulary

### Customization
- **Font**: Choose from 4 different fonts in the toolbar
- **Case**: Switch between uppercase and lowercase letters
- **Grid Size**: Select from 10x10, 12x12, 15x15, or 20x20
- **Template**: Choose from 3 worksheet designs
- **Size/Position**: Use sliders to adjust puzzle size and position

### Advanced Options
- **Diagonal Words**: Check/uncheck to allow diagonal word placement
- **Backwards Words**: Check/uncheck to allow words to be placed backwards
- **Auto-Update**: The preview updates automatically as you change settings

## File Structure

```
wordsearch.html              # Main HTML file
wordsearch-standalone.js     # JavaScript logic
../tests/style.css          # Shared CSS styles
../../../Assets/Images/Logo.png  # Logo image
```

## Technical Details

### Word Placement Algorithm
- Uses a smart placement algorithm that tries up to 100 positions per word
- Supports 8 directions (horizontal, vertical, diagonal) with forwards/backwards options
- Handles word collisions by checking existing letters
- Fills empty cells with random letters

### Categories Supported
- Animals, Colors, Food, Sports, School, Family
- Weather, Body Parts, House, Transportation
- And more... (extensible system)

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Print functionality works across all browsers
- No external dependencies except Google Fonts

## Customization

### Adding New Categories
Edit the `wordCategories` object in `wordsearch-standalone.js` to add new word categories.

### Modifying Templates
Edit the `worksheetTemplates` array to customize the worksheet layouts.

### Styling
Modify the CSS in the `<style>` section of `wordsearch.html` to change colors, fonts, and layout.

## License
This tool is part of the Willena English teaching platform.
