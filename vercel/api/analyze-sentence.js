/**
 * Vercel Function: analyze-sentence (grammar correction)
 * 
 * Endpoint: https://your-vercel-project.vercel.app/api/analyze-sentence
 * 
 * Receives: POST { transcript, language }
 * Returns: JSON { corrected_sentence, teacher_note }
 * 
 * Uses OpenAI GPT from US region (no geo blocking).
 * 
 * Environment variables required:
 * - OPENAI_API_KEY
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server not configured: missing OPENAI_API_KEY' });
  }

  const { transcript, language = 'en' } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid transcript' });
  }

  const systemPrompt = `You are a friendly English teacher for elementary students (ages 6-12).
Your job is to correct the student's spoken English sentence.

RULES:
1. ONLY fix grammar, tense, plurals, articles, and missing words
2. Do NOT add new ideas or information
3. Do NOT change the meaning of the sentence
4. Keep corrections simple and age-appropriate
5. If the sentence is already correct, return it unchanged

OUTPUT FORMAT (strict JSON only, no markdown):
{
  "corrected_sentence": "the corrected sentence here",
  "teacher_note": "brief, encouraging explanation of what was fixed (1-2 sentences max)"
}

If no changes needed, set teacher_note to "Perfect! Your sentence is correct!"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Student said: "${transcript}"` },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI] Error ${response.status}:`, errorText);
      return res.status(response.status).json({ error: `OpenAI error: ${response.status}` });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(200).json({
        corrected_sentence: transcript,
        teacher_note: 'Good job!',
      });
    }

    try {
      const parsed = JSON.parse(content);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({
        corrected_sentence: transcript,
        teacher_note: 'Good job!',
      });
    }
  } catch (error) {
    console.error('[analyze-sentence] Error:', error);
    return res.status(500).json({ error: 'Grammar correction failed' });
  }
}
