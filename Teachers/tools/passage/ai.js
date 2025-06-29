// AI helper for question generation in passage tool
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
    case 'written':
      formatInstructions = 'Create written answer questions that require 1-3 sentence responses.';
      break;
    // Add more formats as needed
  }

  const prompt = `
Based on the following reading passage, create exactly ${numQuestions} questions.
${formatInstructions}

Reading Passage:
"${passage}"

Requirements:
- Number each question (1., 2., 3., etc.)
- Make questions engaging and educational
- Ensure questions test understanding of the passage content

At the end, add a section labeled "ANSWER KEY:" followed by the answers.
`;

  const response = await fetch('/.netlify/functions/openai_proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'chat/completions',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const result = await response.json();
  const data = result.data;
  if (data.error) throw new Error(data.error.message || 'OpenAI API error');

  const content = data.choices[0].message.content.trim();

  // Separate questions and answers
  const answerKeyMatch = content.match(/ANSWER KEY:?\s*([\s\S]*?)$/i);
  let questions = content;
  let answers = '';
  if (answerKeyMatch) {
    questions = content.replace(/ANSWER KEY:?\s*[\s\S]*$/i, '').trim();
    answers = answerKeyMatch[1].trim();
  }
  return { questions, answers };
}
