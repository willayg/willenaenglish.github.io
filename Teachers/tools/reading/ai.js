// AI Question Generation for Reading Worksheets

export async function extractQuestionsWithAI(passage, numQuestions = 5, categories = ['comprehension'], questionFormat = 'multiple-choice') {
  const categoryText = categories.join(', ');
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
  const prompt = `
Based on the following reading passage, create exactly ${numQuestions} questions focusing on: ${categoryText}.

${formatInstructions}

Reading Passage:
"${passage}"

Requirements:
- Questions should be clear and appropriate for the reading level
- Focus on the specified categories: ${categoryText}
- Number each question (1., 2., 3., etc.)
- Make questions engaging and educational
- Ensure questions test understanding of the passage content
- For multiple choice questions, put the question on one line, then each option (a, b, c, d) on separate lines below it

Example format for multiple choice:
1. What is the main topic of the passage?
a) Sports
b) Science
c) History
d) Literature

Please generate the questions now:`;
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
    }

    const result = await response.json();
    const data = result.data;
    
    if (data.error) {
      throw new Error(data.error.message || 'OpenAI API error');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('AI question generation error:', error);
    throw error;
  }
}
