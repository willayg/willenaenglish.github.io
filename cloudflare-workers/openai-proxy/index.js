/**
 * Cloudflare Worker: OpenAI Proxy for Grammar Correction
 * 
 * Simple proxy that calls OpenAI GPT from CF's US colos (which OpenAI accepts).
 * The main analyze-sentence worker calls this when it detects a KR/HKG colo.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    const apiKey = env.OPENAI_API_KEY || env.OPENAI_API;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }

    try {
      const body = await request.json();
      const { transcript, language = 'en' } = body;

      if (!transcript || typeof transcript !== 'string') {
        return new Response(JSON.stringify({ error: 'Missing or invalid transcript' }), {
          status: 400,
          headers: CORS_HEADERS,
        });
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

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        return new Response(
          JSON.stringify({
            error: 'OpenAI error',
            status: response.status,
            detail: errorText?.slice(0, 200),
          }),
          { status: 502, headers: CORS_HEADERS }
        );
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        return new Response(
          JSON.stringify({ corrected_sentence: transcript, teacher_note: 'Good job!' }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), { status: 200, headers: CORS_HEADERS });
      } catch {
        return new Response(
          JSON.stringify({ corrected_sentence: transcript, teacher_note: 'Good job!' }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Grammar correction failed' }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  },
};
