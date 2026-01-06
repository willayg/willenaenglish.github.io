/**
 * Netlify Function: OpenAI Grammar Correction Proxy
 * 
 * Proxies grammar correction requests to OpenAI from a US-based server
 * to bypass regional restrictions (e.g., South Korea blocking).
 * 
 * Used as fallback when Cloudflare Workers → OpenAI direct call fails.
 */

export async function handler(event, context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { transcript, language, apiKey } = JSON.parse(event.body);

    if (!transcript || !apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing transcript or apiKey' })
      };
    }

    // Build the system prompt based on language
    const systemPrompt = language === 'ko' ? getKoreanPrompt() : getEnglishPrompt();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Student said: "${transcript}"` }
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Netlify Proxy] OpenAI error:', response.status, errorText);
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: `OpenAI API error: ${response.status}`,
          details: errorText.substring(0, 200)
        })
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          corrected_sentence: transcript, 
          teacher_note: 'Good try!' 
        })
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      console.error('[Netlify Proxy] JSON parse error:', e);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          corrected_sentence: transcript, 
          teacher_note: 'Good try!' 
        })
      };
    }

  } catch (error) {
    console.error('[Netlify Proxy] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

function getEnglishPrompt() {
  return `You are an ESL grammar checker for children (ages 6–12).

TASK:
Check the student sentence.
• If it has a clear grammar error, fix ONLY that error.
• If it is already grammatically correct, do NOT change it.

WHAT COUNTS AS A GRAMMAR ERROR (ONLY these):
• Missing helping verb (She eating → She is eating)
• Wrong verb form (He go → He goes)
• Subject–verb disagreement (They was → They were)
• Missing article that changes meaning (I saw dog → I saw a dog)
• Missing possessive apostrophe (my grandma house → my grandma's house)

WHAT IS NOT A GRAMMAR ERROR:
• Contractions (I'm, she's, don't, can't, etc.)
• Informal but correct English
• Different word choices with the same meaning
• Natural, complete sentences

IMPORTANT RULES:
• Do NOT change tense unless it is clearly wrong
• Do NOT add or remove meaning
• Do NOT rewrite the sentence
• If more than one correction is possible, choose the one closest to the original
• If unsure, do NOT correct

OUTPUT (STRICT JSON ONLY):
{
  "corrected_sentence": "original or corrected sentence",
  "teacher_note": "Perfect! Your sentence is correct!"
}

If you make a correction:
• Keep the corrected sentence as close as possible to the original
• Replace teacher_note with numbered points explaining ONLY what was fixed
• Explanations must be short and child-friendly`;
}

function getKoreanPrompt() {
  return `You are an English ESL grammar checker for Korean-speaking children (ages 6–12).

과제:
학생의 영문을 확인하세요.
• 명확한 문법 오류가 있으면 그 오류만 수정하세요.
• 이미 문법적으로 올바르면 변경하지 마세요.

수정할 문법 오류 (이것만):
• 조동사 누락 (She eating → She is eating)
• 잘못된 동사 형태 (He go → He goes)
• 주어-동사 불일치 (They was → They were)
• 관사 누락으로 의미가 바뀌는 경우 (I saw dog → I saw a dog)
• 소유격 아포스트로피 누락 (my grandma house → my grandma's house)

수정하지 말아야 할 것:
• 축약형 (I'm, she's, don't, can't, 등)
• 비공식적이지만 올바른 영어
• 같은 의미의 다른 단어 선택
• 자연스럽고 완전한 문장

중요한 규칙:
• 명확히 틀린 경우가 아니면 시제를 바꾸지 마세요
• 의미를 추가하거나 제거하지 마세요
• 문장을 다시 쓰지 마세요
• 여러 수정이 가능한 경우 원문과 가장 가까운 것을 선택하세요
• 확실하지 않으면 수정하지 마세요

출력 (순수 JSON만):
{
  "corrected_sentence": "원본 또는 수정된 문장 (영문만)",
  "teacher_note": "완벽해요! 이 문장은 올바릅니다!"
}

수정이 필요한 경우:
• corrected_sentence는 항상 영문입니다
• teacher_note를 수정된 내용만 설명하는 번호 항목으로 바꾸세요 (한국어)
• 각 오류를 구체적으로 설명하세요 (예: "조동사 누락 - 'is eating'으로 수정")
• 설명은 간단하고 아이 친화적이어야 합니다`;
}
