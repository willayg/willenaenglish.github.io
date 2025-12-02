// AI Question Generation for Reading Worksheets

// Advanced prompt support: if advancedPrompt is provided, use it directly (with minimal formatting requirements)
export async function extractQuestionsWithAI(passage, numQuestions = 5, categories = ['comprehension'], questionFormat = 'multiple-choice', advancedPrompt = null) {
  let prompt = '';
  const categoryMap = {
    'comprehension-choose-word-mc': {
      instructions: `Create comprehension questions as multiple choice, where the student must choose the correct word to complete a sentence about the passage. For each question:
1. Write a sentence about the passage with a blank (_______) for a key word.
2. Provide 4 options (a, b, c, d) with only one correct answer.
3. Do NOT use sentences directly from the passage.
4. Do NOT ask about vocabulary meaning, grammar, or inference. Only test comprehension of the passage by choosing the correct word.
5. Each question should look like this: "Sentence about the passage with blank _______" followed by options a) b) c) d).
`,
      example: `1. The main character felt ____ after losing his book.\na) sad\nb) happy\nc) angry\nd) excited\n2. The story takes place in a ____ near the river.\na) village\nb) city\nc) forest\nd) desert`
    },
    'vocabulary-context-mc': {
      instructions: `Create vocabulary-in-context questions as multiple choice. For each question:
1. Select a challenging word from the passage.
2. Write a NEW sentence (not related to the passage) that uses the word in context, but leave the target word as a blank (_______).
2.1. It is really important that you do not use any related sentences to the passage. Create completely new sentences that use the target word in a different context.
3. Provide 4 options (a, b, c, d): one correct word (the target word from the passage) and three distractors (other words from the passage).
4. Do NOT ask about the meaning, definition, or comprehension of the passage.
5. Do NOT create comprehension, grammar, or inference questions. Only ask which word fits the blank in the sentence.
6. Do NOT use sentences from the passage.
7. Each question should look like this: Start of the sentence(if present) "_______" end of the sentence(if present) followed by options a) b) c) d).
8. Ensure that the answers are clear and cannot be mistaken for another answer.
9. Choose words that most challenging in the passage. Avoid the simplest words in the passage.
9.1. The correct answer must be a word from the passage that fits naturally and logically in the new sentence.
9.2. Distractors should also be plausible in context, but only one should be clearly correct.
10. Do not use the same word in multiple questions.
`,
      example: `1. The scientist made an important ____ in her research.\na) discovery\nb) mistake\nc) journey\nd) promise\n2. The children were filled with ____ as they entered the amusement park.\na) excitement\nb) fear\nc) boredom\nd) sadness`
    },
    'comprehension-mc': {
      instructions: 'Create comprehension questions as multiple choice with 4 options (a, b, c, d).',
      example: '1. What is the main idea of the passage?\na) Option 1\nb) Option 2\nc) Option 3\nd) Option 4'
    },
    'comprehension-sa': {
      instructions: 'Create comprehension questions as short answer (1-2 sentences).',
      example: '1. Explain why the main character was worried.'
    },
    'vocabulary-mc': {
      instructions: `Create ONLY vocabulary questions as multiple choice with 4 options (a, b, c, d). Do NOT include comprehension, grammar, or inference questions. Use these types:\n- What does the word X mean in the passage?\n- Which word is closest to the meaning of X?\n- Which word is the opposite meaning of X?\nReplace X with words from the passage.`,
      example: `1. What does the word "astonished" mean in the passage?\na) surprised\nb) tired\nc) angry\nd) bored\n2. Which word is closest to the meaning of "brave"?\na) cowardly\nb) strong\nc) weak\nd) shy\n3. Which word is the opposite meaning of "happy"?\na) sad\nb) excited\nc) joyful\nd) pleased`
    },
    'grammar-mc': {
      instructions: `Analyze the reading passage below and identify a variety of teachable grammar points (such as verb tense, subject-verb agreement, passive/active voice, word order, pronouns, articles, prepositions, conjunctions, comparatives, modals, question forms, negatives, gerunds/infinitives, conditionals, reported speech, etc.).

For the grammar points, create a multiple choice question in this format:
- Write a sentence with ONE blank (________) for the target grammar item.
- The sentence MUST use names, objects, places, and vocabulary that appear in the passage. Do NOT use any names, objects, or topics that are not found in the passage.
- For every question, the subject, context, and vocabulary must be taken directly from the passage.
- Do NOT copy sentences directly from the passage, but paraphrase or create new sentences using the same people, places, and things.
- Do NOT use the same subject or object in more than one question.
- Do NOT copy the example below; use it only as a format guide.
- Provide 4 options (a, b, c, d), with only one grammatically correct answer and three plausible distractors.
- Do NOT ask about grammar rules, grammar terms, or definitions.
- ONLY create fill-in-the-blank sentences that test grammar in context.
- Do NOT ask the student a question about the passage's meaning or content.
- Ensure that the correct answer is grammatically correct and the only correct option.
- Allow two-word answers if the grammar structure requires it (e.g., "has been," "was playing," "is made").
- Vary the grammar points and make sure each question is clear and appropriate for the passage.

Example (format only, do not copy names or vocabulary):

1. ________ realized that even though his plans changed, he still had a great day.
   a) Jason
   b) Jasons
   c) Jasoned
   d) Jasoning

At the end, add a section labeled "ANSWER KEY:" with the correct letter for each question.
`,
      example: `1. The children ________ playing in the park yesterday.\na) is\nb) are\nc) was\nd) were\n2. She bought _____ umbrella.\na) a\nb) an\nc) the\nd) no article`
    },
    'grammar-correction': {
      instructions: `Read the following passage carefully. You must create exactly ${numQuestions} grammar correction questions.\n\nPASSAGE:\n"${passage}"\n\nFor each question:
- Write a sentence that is based on the passage but contains exactly ONE grammar mistake.
- The sentence must use ONLY names, objects, places, and vocabulary from the passage. Do NOT use any generic names, topics, or vocabulary not found in the passage.
- Each question must use a different subject or object from the passage.
- The grammar mistake should be a common error pattern (verb tense, subject-verb agreement, articles, prepositions, pronouns, adverbs, word order, etc.).
- Do NOT copy sentences directly from the passage. Paraphrase or create new sentences using the same people, places, and things.
- Do NOT use the same subject or object in more than one question.
- Do NOT ask about grammar rules, grammar terms, or definitions.
- ONLY create sentences that test grammar in context.
- Do NOT ask the student a question about the passage's meaning or content.
- Format each question like this: Incorrect sentence   ________  =>  _________. The student should write the correct sentence in the blank.
- At the end, add a section labeled "ANSWER KEY:" with ONLY the single incorrect word, then an arrow, then the single correct word. Do NOT write phrases or full sentences.

Meta-example (do not copy, just follow the format):
PASSAGE: "Sarah and Tom visit the library every Saturday. They read books and play games."
Question: Sarah go to the library every Saturday   ________  =>  ________.
Answer Key: go => goes`,
      example: '1. Sarah go to the library every Saturday   ________  =>  _________.'
    },
    'grammar-unscramble': {
      instructions: `Read the following passage carefully. You must create exactly ${numQuestions} Grammar Unscramble questions. For each question:
- Select a sentence based on the passage (do NOT copy directly, paraphrase or use passage vocabulary).
- Break the sentence into its main word/phrase chunks (no more than 7 per question).
- Scramble the order of the chunks so the sentence is not correct.
- Write the scrambled chunks separated by slashes, like this: "was invented / the telephone / by / A.G. Belle / 1900s / in the / ."
- Do NOT use generic names, objects, or vocabulary. Use only content from the passage.
- Do NOT use the same sentence structure in more than one question.
- At the end, add a section labeled "ANSWER KEY:" and provide the correct, unscrambled sentence for each question.

Example:
1. was invented / the telephone / by / A.G. Belle / 1900s / in the / .
ANSWER KEY:
1. The telephone was invented by A.G. Belle in the 1900s.`,
      example: '1. was invented / the telephone / by / A.G. Belle / 1900s / in the / .'
    },
    'inference-sa': {
      instructions: `Create inference questions that require students to make logical conclusions based on clues from the passage. Use the same formats as inference-mc, but do NOT provide answer choices. Do NOT ask about facts stated directly; require inference. Do NOT copy sentences directly from the passage; paraphrase or use passage vocabulary.`,
      example: `1. What can we infer about the character’s feelings?`
    },
    'main-idea-mc': {
      instructions: 'Create main idea questions as multiple choice.',
      example: '1. What is the main idea?\na) ...\nb) ...\nc) ...\nd) ...'
    },
    'inference-mc': {
      instructions: `Create inference questions as multiple choice. Use a variety of formats such as:
- What do we know about [character/event]?
- How do we know that [character/event]?
- Can we tell if [character/event]?
- Why do you think [character] did [action]?
- What can we infer about [character’s feelings/motivation]?
- What is most likely true about [character/event]?
- Which statement is best supported by the passage?
- What evidence in the passage supports [idea]?

For each question:
- Use clues from the passage to make logical conclusions.
- Provide 4 answer options (a, b, c, d), only one of which is best supported by the passage.
- Do NOT copy sentences directly from the passage; paraphrase or use passage vocabulary.
- Do NOT ask about facts stated directly; require inference.
- At the end, add a section labeled "ANSWER KEY:" with the correct letter for each question.`,
      example: `1. What do we know about Tom?
a) He is sad
b) He is excited
c) He is tired
d) He is angry
2. Why do you think Sarah went to the library?
a) To play games
b) To read books
c) To meet friends
d) To do homework`
    },
    // Add more as needed
  };

  if (advancedPrompt && typeof advancedPrompt === 'string' && advancedPrompt.trim().length > 0) {
    // Use the user's advanced prompt directly, with NO extra filtering or requirements
    prompt = `${advancedPrompt}\n\nReading Passage:\n"${passage}"`;
  } else {
    // Default: use category-based prompt
    // Assume only one category is selected for simplicity
    const selectedCat = categories[0];
    const catConfig = categoryMap[selectedCat] || { instructions: '', example: '' };
    if (selectedCat === 'grammar-mc') {
      // Place the passage FIRST, then the instructions, to maximize LLM attention
      prompt = `Read the following passage carefully. You must create exactly ${numQuestions} GRAMMAR multiple choice questions.\n\nPASSAGE:\n"${passage}"\n\nFor each question:
- Write a fill-in-the-blank sentence that tests a grammar point ONLY (such as verb tense, agreement, passive, articles, prepositions, pronouns, etc.).
- The sentence must use only people, places, and things from the passage.
- Do NOT write questions about the story, meaning, or context. ONLY test grammar.
- Each sentence must be original and use a different subject or object from the passage for each question.
- Provide four answer options (a, b, c, d), with only one grammatically correct answer.
- The correct answer must be the only grammatically correct option.
- At the end, provide an answer key with the correct letter for each question.`;
    } else {
      prompt = `Based on the following reading passage, create exactly ${numQuestions} questions.\n${catConfig.instructions}\n\nReading Passage:\n"${passage}"\n\nRequirements:\n- Questions should be clear and appropriate for the reading level\n- Number each question (1., 2., 3., etc.)\n- Make questions engaging and educational\n- Ensure questions test understanding of the passage content\n\nIMPORTANT: At the end of your response, add a section labeled "ANSWER KEY:" followed by the answers in this format:\n1. [correct answer]\n2. [correct answer]\n3. [correct answer]\n\nFor multiple choice, just put the letter (a, b, c, or d).\nFor other question types, provide the complete answer.\n\nExample:\n${catConfig.example}\n\nPlease generate the questions now:`;
    }
  }

  try {
    const response = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }    const result = await response.json();
    const data = result.data;
    
    if (data.error) {
      throw new Error(data.error.message || 'OpenAI API error');
    }

    const content = data.choices[0].message.content.trim();
    
    // Separate questions and answers
    const answerKeyMatch = content.match(/ANSWER KEY:?[\s\S]*$/i);
    let questions = content;
    let answers = '';
    if (answerKeyMatch) {
      // Remove answer key from questions
      questions = content.replace(/ANSWER KEY:?[\s\S]*$/i, '').trim();
      // Extract and reformat answers
      const rawAnswers = answerKeyMatch[0].replace(/ANSWER KEY:?/i, '').trim();
      // Find all pairs like 'go → goes' or 'go => goes'
      const answerLines = rawAnswers.split(/\n|\r/).map(line => line.trim()).filter(line => line.length > 0);
      const arrowRegex = /(.*?)\s*(→|=>)\s*(.*)/;
      const formattedAnswers = answerLines
        .map(line => {
          const match = line.match(arrowRegex);
          if (match) {
            let incorrect = match[1].trim();
            let correct = match[3].trim();
            
            // If the incorrect/correct parts are too long (more than 3 words), try to extract just the key word
            if (incorrect.split(' ').length > 3 || correct.split(' ').length > 3) {
              // Try to find the differing word(s)
              const incorrectWords = incorrect.split(' ');
              const correctWords = correct.split(' ');
              
              // Find the first differing word
              for (let i = 0; i < Math.min(incorrectWords.length, correctWords.length); i++) {
                if (incorrectWords[i] !== correctWords[i]) {
                  incorrect = incorrectWords[i];
                  correct = correctWords[i];
                  break;
                }
              }
              
              // If lengths differ, use the shorter version
              if (incorrectWords.length !== correctWords.length) {
                if (incorrectWords.length < correctWords.length) {
                  incorrect = incorrectWords[incorrectWords.length - 1] || incorrect;
                  correct = correctWords[correctWords.length - 1] || correct;
                } else {
                  incorrect = incorrectWords[correctWords.length] || incorrect;
                  correct = correctWords[correctWords.length - 1] || correct;
                }
              }
            }
            
            // Always use '=>' for output
            return `${incorrect} => ${correct}`;
          }
          // If not a pair, just return the line
          return line;
        })
        .join('\n');
      answers = formattedAnswers;
    }
    
    return { questions, answers };
  } catch (error) {
    console.error('AI question generation error:', error);
    throw error;
  }
}

function getCategoryInstructions(categories, numQuestions) {
  if (!categories || categories.length === 0) return '';
  if (categories.length === 1) {
    switch (categories[0]) {
      case 'comprehension':
        return 'Focus on reading comprehension questions that check understanding of the passage.';
      case 'vocabulary':
        return 'Focus on vocabulary questions that test the meaning of words or phrases from the passage.';
      case 'grammar':
        return 'Focus on grammar questions related to the passage.';
      case 'inference':
        return 'Focus on inference questions that require students to read between the lines.';
      case 'main idea':
        return 'Focus on main idea questions that test understanding of the overall point or theme.';
      default:
        return '';
    }
  } else {
    // Multiple categories
    return 'Mix the following question types: ' + categories.join(', ') + '. Distribute the ' + numQuestions + ' questions as evenly as possible among these categories.';
  }
}
