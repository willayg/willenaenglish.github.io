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
    'vocabulary-sentence-mc': {
      instructions: `Create vocabulary-in-context questions as multiple choice. For each question:
1. Select a challenging word from the passage.
2. Write a NEW sentence (not from the passage) that uses the word in context, but leave the target word as a blank (_______).
3. Provide 4 options (a, b, c, d): one correct word (the target word from the passage) and three distractors (other words from the passage).
4. Do NOT ask about the meaning, definition, or comprehension of the passage.
5. Do NOT create comprehension, grammar, or inference questions. Only ask which word fits the blank in the sentence.
6. Do NOT use sentences from the passage.
7. Each question should look like this: "Sentence with blank _______" followed by options a) b) c) d).
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
      instructions: 'Create grammar questions as multiple choice, focusing on verb tense, articles, or sentence structure.',
      example: '1. Which sentence is correct?\na) ...\nb) ...\nc) ...\nd) ...'
    },
    'grammar-correction': {
      instructions: 'Create grammar questions as sentence correction or transformation.',
      example: '1. Correct the error: "He go to school every day."'
    },
    'inference-sa': {
      instructions: 'Create inference questions as short answer.',
      example: '1. What can you infer about the character\'s feelings?'
    },
    'main-idea-mc': {
      instructions: 'Create main idea questions as multiple choice.',
      example: '1. What is the main idea?\na) ...\nb) ...\nc) ...\nd) ...'
    }
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
    prompt = `Based on the following reading passage, create exactly ${numQuestions} questions.\n${catConfig.instructions}\n\nReading Passage:\n"${passage}"\n\nRequirements:\n- Questions should be clear and appropriate for the reading level\n- Number each question (1., 2., 3., etc.)\n- Make questions engaging and educational\n- Ensure questions test understanding of the passage content\n\nIMPORTANT: At the end of your response, add a section labeled "ANSWER KEY:" followed by the answers in this format:\n1. [correct answer]\n2. [correct answer]\n3. [correct answer]\n\nFor multiple choice, just put the letter (a, b, c, or d).\nFor other question types, provide the complete answer.\n\nExample:\n${catConfig.example}\n\nPlease generate the questions now:`;
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
    const answerKeyMatch = content.match(/ANSWER KEY:?\s*([\s\S]*?)$/i);
    let questions = content;
    let answers = '';
    
    if (answerKeyMatch) {
      // Remove answer key from questions
      questions = content.replace(/ANSWER KEY:?\s*[\s\S]*$/i, '').trim();
      // Extract answers
      answers = answerKeyMatch[1].trim();
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
