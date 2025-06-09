const fetch = require('node-fetch'); // Netlify supports node-fetch v2

exports.handler = async (event, context) => {
  const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

  let text = "";
  let voiceId = "YOUR_DEFAULT_VOICE_ID"; // Replace with your default voice ID
  try {
    const body = JSON.parse(event.body);
    text = body.text;
    if (body.voice_id) voiceId = body.voice_id;
  } catch (e) {
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
      return {
        statusCode: elevenRes.status,
        body: JSON.stringify({ error: "Failed to fetch from Eleven Labs" })
      };
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioBase64 })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", details: err.message })
    };
  }
};