// =====================================================
// netlify/functions/gemini.js — Netlify Serverless Proxy
//
// Runs on Netlify's servers, not in the visitor's browser.
// Reads GEMINI_API_KEY from the Netlify environment and
// forwards requests to the Google Gemini API.
//
// The browser calls: POST /.netlify/functions/gemini
// This function calls: POST https://generativelanguage.googleapis.com/...
// =====================================================

const ALLOWED_MODELS = new Set([
  'gemini-1.5-flash',
]);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Read the secret key from Netlify environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not set.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is not configured. Contact the site owner.' }),
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body.' }),
    };
  }

  const { model, messages, systemPrompt, jsonMode } = body;

  // Validate fields
  if (!model || !messages || !systemPrompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: model, messages, systemPrompt' }),
    };
  }

  if (!ALLOWED_MODELS.has(model)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Model "${model}" is not allowed.` }),
    };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'messages must be a non-empty array.' }),
    };
  }

  // Build and forward the Gemini API request.
  // We use the v1 stable endpoint with gemini-1.5-flash.
  // v1 does not support system_instruction or responseMimeType,
  // so we prepend the system prompt to the first user message instead.
  const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  const [firstMessage, ...rest] = messages;
  const firstText = firstMessage?.parts?.[0]?.text || '';
  const contentsWithSystem = [
    { role: 'user', parts: [{ text: `${systemPrompt}\n\n${firstText}` }] },
    ...rest,
  ];

  const geminiBody = {
    contents: contentsWithSystem,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.2,
    },
  };

  let geminiResponse;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (networkErr) {
    console.error('Network error reaching Gemini API:', networkErr);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Could not reach the Gemini API. Please try again.' }),
    };
  }

  const data = await geminiResponse.json();

  return {
    statusCode: geminiResponse.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
};
