# Sample Wordlists – Level 2

New Level 2 vocabulary sets with slightly harder words than Level 1. These lists avoid duplicates with the Level 1 `sample-wordlists` folder.

Lists included:
- AnimalsAdvanced.json (advanced animal names)
- Verbs2.json (richer action verbs)
- Feelings2.json (more nuanced emotions)
- Vegetables.json (common vegetables)
- ClothingAccessories.json (clothing and accessories)
- SchoolSupplies2.json (extra tools for school)
- CommunityPlaces2.json (places around town)
- NatureLandforms.json (geography and landforms)

Each entry contains:
- eng: English word
- kor: Korean translation
- def: Simple definition for learners
- ex: Short example sentence

Integration notes:
- The current sample list picker loads from `sample-wordlists/`. To browse these Level 2 lists in the UI, you can either:
  1) Add a new category in `ui/sample_wordlist_modal.js` that points to these files and pass full paths like `sample-wordlists-level2/AnimalsAdvanced.json`, and
  2) Update `loadSampleWordlistByFilename` in `main.js` to accept paths with a subfolder (if it assumes `sample-wordlists/`).

Alternatively, you can load a list programmatically by calling the Word Arcade loader with the relative path.
