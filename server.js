const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const apiKey = process.env.GEMINI_API_KEY;

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function handleChat(request, response) {
  if (!apiKey) {
    sendJson(response, 503, { error: 'Gemini is not configured. Set GEMINI_API_KEY before starting the server.' });
    return;
  }

  let rawBody = '';
  for await (const chunk of request) rawBody += chunk;
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    sendJson(response, 400, { error: 'Invalid request body.' });
    return;
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > 1000) {
    sendJson(response, 400, { error: 'Message must be between 1 and 1000 characters.' });
    return;
  }

  const persona = typeof body.persona === 'string' && body.persona.trim()
    ? body.persona.trim().slice(0, 80)
    : 'Milan Guide';
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, 300) : '';
  const prompt = `You are an AI companion on Milan named ${persona}. You must be transparent if asked: you are an AI companion, not a real person.
Reply in the same language and general tone as the user's message. Sound warm, natural, respectful, and conversational, but do not claim real-world experiences you do not have. Keep replies under 80 words.
You can discuss the companion's listed interests, safe dating, community rules, and respectful conversation. Never ask for passwords, OTPs, card numbers, or sensitive personal information.
Profile context: ${context || 'A friendly Milan AI companion who enjoys meaningful conversations.'}
User message: ${message}`;

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  const data = await geminiResponse.json();
  if (!geminiResponse.ok) {
    sendJson(response, 502, { error: 'Gemini request failed.' });
    return;
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    sendJson(response, 502, { error: 'Gemini returned an empty response.' });
    return;
  }
  sendJson(response, 200, { reply });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/chat') {
      await handleChat(request, response);
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405);
      response.end('Method Not Allowed');
      return;
    }

    const requestedPath = request.url === '/' ? '/index.html' : request.url;
    const filePath = path.resolve(root, `.${requestedPath}`);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }
    const extensions = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
    response.writeHead(200, { 'Content-Type': extensions[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 500, { error: 'Unexpected server error.' });
  }
});

server.listen(port, () => console.log(`Milan is running at http://localhost:${port}`));
