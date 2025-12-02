# Sample Wordlist Modal - Supported Lists

The sample wordlist modal displays **14 word lists** as of October 2025.

## Complete List

| # | Label | File Name | Emoji | Category |
|---|-------|-----------|-------|----------|
| 1 | Easy Animals | `EasyAnimals.json` | 🐯 | Animals |
| 2 | More Animals | `Animals2.json` | 🐼 | Animals |
| 3 | Fruits & Veggies | `Food1.json` | 🍎 | Food |
| 4 | Meals & Snacks | `Food2.json` | 🍔 | Food |
| 5 | World Foods | `Food3.json` | 🍣 | Food |
| 6 | Jobs (Easy) | `EasyJobs.json` | 👩‍🔧 | Occupations |
| 7 | Getting Around | `Transportation.json` | 🚗 | Transport |
| 8 | Hobbies (Easy) | `EasyHobbies.json` | 🎨 | Hobbies |
| 9 | Sports | `Sports.json` | 🏀 | Sports |
| 10 | School Things | `SchoolSupplies.json` | ✏️ | School |
| 11 | Mixed Words (All) | `sample-wordlist.json` | 📚 | Mixed |
| 12 | Mixed Words (15) | `sample-wordlist-15.json` | 📝 | Mixed |
| 13 | Action Words (Easy) | `EasyVerbs.json` | 🏃‍♂️ | Verbs |
| 14 | Feelings & Emotions | `Feelings.json` | 😊 | Emotions |

## Code Location
File: `Games/Word Arcade/ui/sample_wordlist_modal.js` (lines 108-121)

```javascript
const allLists = [
  { label: 'Easy Animals', file: 'EasyAnimals.json', emoji: '🐯' },
  { label: 'More Animals', file: 'Animals2.json', emoji: '🐼' },
  { label: 'Fruits & Veggies', file: 'Food1.json', emoji: '🍎' },
  { label: 'Meals & Snacks', file: 'Food2.json', emoji: '🍔' },
  { label: 'World Foods', file: 'Food3.json', emoji: '🍣' },
  { label: 'Jobs (Easy)', file: 'EasyJobs.json', emoji: '👩‍🔧' },
  { label: 'Getting Around', file: 'Transportation.json', emoji: '🚗' },
  { label: 'Hobbies (Easy)', file: 'EasyHobbies.json', emoji: '🎨' },
  { label: 'Sports', file: 'Sports.json', emoji: '🏀' },
  { label: 'School Things', file: 'SchoolSupplies.json', emoji: '✏️' },
  { label: 'Mixed Words (All)', file: 'sample-wordlist.json', emoji: '📚' },
  { label: 'Mixed Words (15)', file: 'sample-wordlist-15.json', emoji: '📝' },
  { label: 'Action Words (Easy)', file: 'EasyVerbs.json', emoji: '🏃‍♂️' },
  { label: 'Feelings & Emotions', file: 'Feelings.json', emoji: '😊' }
];
```

## Categories Summary

- **Animals:** 2 lists (Easy Animals, More Animals)
- **Food:** 3 lists (Fruits & Veggies, Meals & Snacks, World Foods)
- **Occupations:** 1 list (Jobs)
- **Transport:** 1 list (Getting Around)
- **Hobbies:** 1 list (Hobbies)
- **Sports:** 1 list (Sports)
- **School:** 1 list (School Things)
- **Verbs:** 1 list (Action Words)
- **Emotions:** 1 list (Feelings & Emotions)
- **Mixed:** 2 lists (sample-wordlist, sample-wordlist-15)

## Notes

- The comment in the code says: "Flat list of all word lists (no categories, except Long U excluded)"
- Each list has an associated **emoji** for visual identification
- The **file names** reference JSON word list files
- Progress tracking is calculated per-list by averaging scores across 6 game modes
