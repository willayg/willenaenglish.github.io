const fetch = require('node-fetch'); // Netlify supports node-fetch v2

exports.handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

  let text = "";
  let voiceId = process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;
  if (!voiceId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ELEVEN_LABS_DEFAULT_VOICE_ID env var not set" })
    };
  }
  // Prefer explicit env override; fall back to stable default per docs
  let modelId = process.env.ELEVEN_LABS_MODEL_ID || "eleven_multilingual_v2";
  // Defaults requested: max clarity
  let voiceSettings = { stability: 1.0, similarity_boost: 1.0, style: 0.0, use_speaker_boost: false };
  try {
    const body = JSON.parse(event.body);
    text = body.text;
    if (body.voice_id) voiceId = body.voice_id;
    if (body.model_id && typeof body.model_id === 'string') modelId = body.model_id;
    if (body.voice_settings && typeof body.voice_settings === 'object') {
      // Shallow merge with defaults to enforce user's preferred baseline while allowing specific overrides
      voiceSettings = {
        stability: 1.0,
        similarity_boost: 1.0,
        style: 0.0,
        use_speaker_boost: false,
        ...body.voice_settings
      };
    }
    console.log(`TTS request: text="${text}", voiceId="${voiceId}", model_id="${modelId}", voice_settings=${JSON.stringify(voiceSettings)}`);
  } catch (e) {
    console.error("Invalid request body:", e);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body" })
    };
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  try {
    const elevenRes = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": elevenLabsApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        model_id: modelId,
        voice_settings: voiceSettings
      })
    });

    if (!elevenRes.ok) {
      let errBody = '';
      try { errBody = await elevenRes.text(); } catch {}
      console.error(`ElevenLabs API error: ${elevenRes.status} ${elevenRes.statusText} body=${errBody}`);
      return {
        statusCode: elevenRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
        body: JSON.stringify({ error: "Failed to fetch from Eleven Labs", details: errBody })
      };
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    console.log(`TTS success: Generated ${audioBase64.length} chars of base64 audio`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
      body: JSON.stringify({ audio: audioBase64 })
    };
  } catch (err) {
    console.error("Server error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Server error", details: err.message })
    };
  }
};