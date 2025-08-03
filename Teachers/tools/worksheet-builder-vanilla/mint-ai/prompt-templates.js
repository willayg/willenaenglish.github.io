// prompt-templates.js - Modular prompt layers for MINT AI Modal

export const universalContext = `You are a top-notch English teacher who wants to produce high-quality worksheets for your students. Your output should be clear, accurate, and formatted for easy use in a classroom.`;

export const modeTemplates = {
  grammar: n => `Design ${n} grammar exercise problems for ESL learners based on the user's prompt.`,
  free: () => `Design questions based on the user's prompt.`,
  // Add more as needed
};

export const typeTemplates = {
  open: `Create open-ended questions that require students to write their own answers.`,
  multi: `Create multiple choice questions for ESL students. Each question should have 1 correct answer and 3 plausible distractors. The correct answer must always be included as one of the four options. All answer options must be full, realistic, meaningful English words or phrases, and must not be incomplete, cut-off, or random letters. Do not repeat the same word or use partial words. Do not use options like 'gre', 'wi', 'w', 'b', 'c', 'd', or 'longly'. Never use a single letter, random string, or incomplete word as an option. If you cannot think of a plausible distractor, use a real English word that is grammatically possible, but not correct. If you use a nonsense or single-letter option, you will be penalized.

If the question is about superlatives, always use 'the _______' in the blank and make sure the correct answer includes the definite article 'the' if required. Use this format for all superlative questions:
1. The cheetah is the _______ animal in the world. a) fastest  b) faster  c) fastly  d) more fast

For all questions:
- Randomize the position of the correct answer so it is sometimes a), b), c), or d) (not just a) or b)). The correct answer must not always be in the same position.
- Shuffle the order of all answer choices for every question, so the correct answer is not always in the same position.
- Avoid patterns: do not always put the correct answer in the first or second position.
- Use a clear blank in the question and provide four options, only one of which is correct.
- Do not use labels like "Question:" or "Answer:". Just write questions and answer choices clearly, all on one line per question.

After all the questions, include an answer key in this EXACT format (all answers must be on ONE SINGLE LINE, separated by large spaces):
Answer Key: 1.a    2.b    3.c    4.d    5.a
DO NOT put each answer on a separate line. ALL answers must be on the same horizontal line.
`,
  fill: `Create fill-in-the-blank questions. Use a blank (____) for the missing word(s).\nIMPORTANT: After all questions, provide an answer key in this EXACT format (all answers must be on ONE SINGLE LINE, separated by large spaces):\nAnswer Key: 1.word    2.answer    3.solution    4.response\nDO NOT put each answer on a separate line. ALL answers must be on the same horizontal line.\n`,
  // Add more as needed
};

export const difficultyTemplates = {
  basic: `Make the questions very simple and suitable for beginners. Use basic vocabulary and clear, short sentences. Avoid complex grammar. Ensure that elementary school-aged children can do this.`,
  easy: `Make the questions simple and suitable for lower-level students, especially elementary school-aged children. Use familiar, basic vocabulary and straightforward grammar.`,
  medium: `Make the questions moderately challenging for elementary school students. Use a mix of basic and intermediate vocabulary and grammar. Include some variety in question structure, but keep it accessible for young learners.`,
  hard: `Make the questions challenging and suitable for middle and high school students. Use more advanced vocabulary and grammar. Include some less common words and more complex sentence structures.`,
  veryhard: `Make the questions very challenging, appropriate for middle and high school students. Use advanced vocabulary, idioms, and complex grammar. Expect students to think critically and apply their knowledge.`,
  advanced: `Make the questions suitable for advanced learners, such as high school students preparing for exams. Use sophisticated vocabulary, nuanced grammar, and require higher-order thinking skills. Include subtle distractors and multi-step reasoning where appropriate.`
};

export function locationTemplate(location) {
  return location ? `Note: The user is located in ${location}. Adapt the questions to be relevant or accessible for students in this region if possible.` : '';
}

export function buildPrompt({ mode, type, difficulty, n, userPrompt, location }) {
  return [
    universalContext,
    modeTemplates[mode] ? modeTemplates[mode](n) : '',
    typeTemplates[type] || '',
    difficultyTemplates[difficulty] || '',
    `User prompt: ${userPrompt}`,
    locationTemplate(location)
  ].filter(Boolean).join('\n\n');
}
