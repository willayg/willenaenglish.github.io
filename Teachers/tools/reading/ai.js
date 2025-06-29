// AI Question Generation for Reading Worksheets

export async function extractQuestionsWithAI(passage, numQuestions = 5, categories = ['comprehension'], questionFormat = 'multiple-choice') {
  let formatInstructions = '';
  switch (questionFormat) {
    case 'multiple-choice':
      formatInstructions = `Create multiple choice questions with 4 options (a, b, c, d). Format them like this:
      
Question text here?
a) First option
b) Second option  
c) Third option
d) Fourth option

Put each question on its own line, then each option (a, b, c, d) on separate lines below it.`;
      break;
    case 'fill-blanks':
      formatInstructions = 'Create fill-in-the-blank questions with clear blanks (______) for missing words.';
      break;
    case 'circle-word':
      formatInstructions = 'Create questions where students circle the correct word from 2-3 options in parentheses.';
      break;
    case 'short-answer':
      formatInstructions = 'Create short answer questions that require 1-2 sentence responses.';
      break;
    case 'mixed':
      formatInstructions = 'Create a mix of question types: multiple choice, fill-in-the-blank, and short answer.';
      break;
  }

  // If grammar is selected, override the prompt with grammar-specific instructions
  let prompt = '';
  if (categories.length === 1 && categories[0] === 'grammar') {
    prompt = `
Create ${numQuestions} grammar exercises for ESL kids based on the following short passage. These should be fill-in-the-blank, sentence correction, or sentence transformation activities that test basic grammar like verb tense, articles, or sentence structure. Each exercise should include four multiple choice answers (A–D) and the correct answer should be clearly marked. Keep the language suitable for intermediate-level ESL learners aged 9–13.

Reading Passage:
"${passage}"

Requirements:
- Exercises should be clear and appropriate for the reading level
- Number each exercise (1., 2., 3., etc.)
- Make exercises engaging and educational
- Ensure exercises test understanding of grammar in the passage

IMPORTANT: At the end of your response, add a section labeled "ANSWER KEY:" followed by the answers in this format:
1. [correct answer]
2. [correct answer]
3. [correct answer]

For multiple choice, just put the letter (a, b, c, or d).
For other question types, provide the complete answer.

Please generate the exercises now:
`;
  } else {
    // Use the regular prompt for other categories
    const categoryInstructions = getCategoryInstructions(categories, numQuestions);
    prompt = `
Based on the following reading passage, create exactly ${numQuestions} questions.
${categoryInstructions}
${formatInstructions}

Reading Passage:
"${passage}"

Requirements:
- Questions should be clear and appropriate for the reading level
- Number each question (1., 2., 3., etc.)
- Make questions engaging and educational
- Ensure questions test understanding of the passage content
- For multiple choice questions, put the question on one line, then each option (a, b, c, d) on separate lines below it

IMPORTANT: At the end of your response, add a section labeled "ANSWER KEY:" followed by the answers in this format:
1. [correct answer]
2. [correct answer]
3. [correct answer]

For multiple choice, just put the letter (a, b, c, or d).
For other question types, provide the complete answer.

Example format for multiple choice:
1. What is the main topic of the passage?
a) Sports
b) Science
c) History
d) Literature

Please generate the questions now:`;
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
