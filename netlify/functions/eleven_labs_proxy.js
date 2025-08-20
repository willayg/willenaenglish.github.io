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
  let voiceId = process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || "t48pCvC0g1kiVGYyVUCT"; // Use uppercase to match .env
  try {
    const body = JSON.parse(event.body);
    text = body.text;
    if (body.voice_id) voiceId = body.voice_id;
    console.log(`TTS request: text="${text}", voiceId="${voiceId}"`);
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
        model_id: "eleven_monolingual_v1"
      })
    });

    if (!elevenRes.ok) {
      console.error(`ElevenLabs API error: ${elevenRes.status} ${elevenRes.statusText}`);
      return {
        statusCode: elevenRes.status,
        body: JSON.stringify({ error: "Failed to fetch from Eleven Labs" })
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