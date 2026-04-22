// =====================================================
// api/gemini.js — Vercel Serverless Proxy
//
// This function runs on Vercel's servers, not in the
// visitor's browser. It reads GEMINI_API_KEY from the
// Vercel environment (never exposed to the public) and
// forwards requests to the Google Gemini API.
//
// The browser calls: POST /api/gemini
// This function calls: POST https://generativelanguage.googleapis.com/...
// =====================================================

// Allowed models — whitelist prevents misuse of the proxy
const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]);

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read the secret key from Vercel environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not set.');
    return res.status(500).json({ error: 'Server is not configured. Contact the site owner.' });
  }

  // Parse and validate the request body
  const { model, messages, systemPrompt, jsonMode } = req.body || {};

  if (!model || !messages || !systemPrompt) {
    return res.status(400).json({ error: 'Missing required fields: model, messages, systemPrompt' });
  }

  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Model "${model}" is not allowed.` });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  // Build the Gemini API request
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.2,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  };

  // Forward to Gemini
  let geminiResponse;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (networkErr) {
    console.error('Network error reaching Gemini API:', networkErr);
    return res.status(502).json({ error: 'Could not reach the Gemini API. Please try again.' });
  }

  const data = await geminiResponse.json();

  // Pass through Gemini's status code and response
  return res.status(geminiResponse.status).json(data);
}
