// Levels metadata for Grammar Arcade
// Keep it shallow and declarative. Icons reuse existing Word Arcade assets.

export const levels = [
  {
    id: 1,
    key: 'level1',
    title: 'Level 1 — Parts of Speech',
    desc: 'Identify nouns, verbs, adjectives in simple sentences.',
    icon: '../Word Arcade/assets/Images/icons/horror.svg',
    mode: 'pos_basics',
    unlocked: true,
  },
  {
    id: 2,
    key: 'level2',
    title: 'Level 2 — Subject–Verb Agreement',
    desc: 'Pick the correct verb form that matches the subject.',
    icon: '../Word Arcade/assets/Images/icons/rainbow.svg',
    mode: 'sva',
    unlocked: true,
  },
  {
    id: 3,
    key: 'level3',
    title: 'Level 3 — Tense Builder',
    desc: 'Choose the correct tense using time clues.',
    icon: '../Word Arcade/assets/Images/icons/fire-fist.svg',
    mode: 'tense_builder',
    unlocked: true,
  },
  {
    id: 4,
    key: 'level4',
    title: 'Level 4 — Punctuation Fix',
    desc: 'Insert missing punctuation or select the correct sentence.',
    icon: '../Word Arcade/assets/Images/icons/browse.png',
    mode: 'punctuation_fix',
    unlocked: true,
  },
  {
    id: 5,
    key: 'level5',
    title: 'Level 5 — Sentence Rewrite',
    desc: 'Rewrite or reorder small parts to fix grammar.',
    icon: '../Word Arcade/assets/Images/icons/cutie.svg',
    mode: 'sentence_rewrite',
    unlocked: true,
  },
];

export function getLevelById(id) {
  return levels.find(l => l.id === Number(id));
}
