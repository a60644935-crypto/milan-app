const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const apiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function readBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on('end', () => resolve(raw));
    request.on('error', reject);
  });
}

async function readJson(request, maxBytes) {
  const raw = await readBody(request, maxBytes);
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('Invalid request body.'), { statusCode: 400 });
  }
}

function supabaseConfigError() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env, then restart the server.';
  }
  return null;
}

async function supabaseRequest(resource, options = {}) {
  const configError = supabaseConfigError();
  if (configError) throw Object.assign(new Error(configError), { statusCode: 503, code: 'CONFIG' });
  let response;
  try {
    response = await fetch(`${supabaseUrl}${resource}`, {
      ...options,
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw Object.assign(new Error('Unable to reach Supabase.'), { statusCode: 502, code: 'SUPABASE' });
  }
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = data?.message || data?.error_description || data?.hint || 'Supabase request failed.';
    throw Object.assign(new Error(detail), { statusCode: response.status >= 500 ? 502 : 400, code: 'SUPABASE' });
  }
  return data;
}

function parseCookies(request) {
  const cookies = {};
  (request.headers.cookie || '').split(';').forEach((item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return;
    cookies[item.slice(0, separator).trim()] = decodeURIComponent(item.slice(separator + 1).trim());
  });
  return cookies;
}

function getSession(request) {
  const token = parseCookies(request).milan_admin_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAdmin(request, response) {
  const session = getSession(request);
  if (!session) {
    sendError(response, 401, 'Admin login required.');
    return null;
  }
  return session;
}

function csrfIsValid(request, session) {
  const supplied = request.headers['x-csrf-token'];
  return typeof supplied === 'string' && supplied.length === session.csrf.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrf));
}

function normalizedEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? value.trim().toLowerCase()
    : '';
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function recordLoginFailure(ip) {
  const current = loginAttempts.get(ip) || { count: 0, firstAt: Date.now() };
  if (Date.now() - current.firstAt > 15 * 60 * 1000) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
  } else {
    current.count += 1;
    loginAttempts.set(ip, current);
  }
}

function loginIsLimited(ip) {
  const current = loginAttempts.get(ip);
  if (!current || Date.now() - current.firstAt > 15 * 60 * 1000) return false;
  return current.count >= 10;
}

async function handleChat(request, response) {
  if (!apiKey) {
    sendError(response, 503, 'Gemini is not configured. Set GEMINI_API_KEY before starting the server.');
    return;
  }
  const body = await readJson(request, 32 * 1024);
  const message = text(body.message, 1000);
  if (!message) {
    sendError(response, 400, 'Message must be between 1 and 1000 characters.');
    return;
  }
  const persona = text(body.persona, 80) || 'Milan Guide';
  const context = text(body.context, 300);
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
    sendError(response, 502, 'Gemini request failed.');
    return;
  }
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    sendError(response, 502, 'Gemini returned an empty response.');
    return;
  }
  sendJson(response, 200, { reply });
}

async function handleUserTracking(request, response) {
  const body = await readJson(request, 64 * 1024);
  const email = normalizedEmail(body.email);
  const name = text(body.name, 120);
  const location = text(body.location, 120);
  const interest = text(body.interest, 120);
  const age = Number(body.age);
  if (!email || !name || !location || !interest || !Number.isInteger(age) || age < 18 || age > 100) {
    sendError(response, 400, 'A valid email, name, age, location, and interest are required.');
    return;
  }
  await supabaseRequest('/rest/v1/users?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      email,
      name,
      age,
      location,
      interest,
      last_seen_at: new Date().toISOString(),
    }),
  });
  sendJson(response, 200, { ok: true });
}

function validScreenshot(value) {
  return typeof value === 'string'
    && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)
    && value.length <= 4 * 1024 * 1024;
}

async function handlePaymentSubmission(request, response) {
  const body = await readJson(request, 5 * 1024 * 1024);
  const email = normalizedEmail(body.email || body.userEmail);
  const planType = text(body.planType || body.type, 80);
  const utr = text(body.utr, 80);
  const screenshot = body.screenshot;
  if (!email || !planType || !utr || !validScreenshot(screenshot)) {
    sendError(response, 400, 'A valid email, plan, UTR, and payment screenshot are required. Screenshots must be PNG, JPEG, or WebP and under 3 MB.');
    return;
  }
  const result = await supabaseRequest('/rest/v1/payment_submissions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_email: email,
      plan_type: planType,
      utr,
      screenshot_data: screenshot,
      status: 'pending',
    }),
  });
  sendJson(response, 201, { ok: true, payment: Array.isArray(result) ? result[0] : result });
}

async function handleAdminLogin(request, response) {
  const ip = request.socket.remoteAddress || 'unknown';
  if (loginIsLimited(ip)) {
    sendError(response, 429, 'Too many login attempts. Please try again later.');
    return;
  }
  if (!adminEmail || !adminPassword) {
    sendError(response, 503, 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.');
    return;
  }
  const body = await readJson(request, 16 * 1024);
  const email = normalizedEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const emailMatches = email === adminEmail;
  const passwordMatches = password.length === adminPassword.length
    && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));
  if (!emailMatches || !passwordMatches) {
    recordLoginFailure(ip);
    sendError(response, 401, 'Invalid admin email or password.');
    return;
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { email: adminEmail, csrf, expiresAt: Date.now() + SESSION_TTL_MS });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  sendJson(response, 200, { ok: true, email: adminEmail, csrfToken: csrf }, {
    'Set-Cookie': `milan_admin_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure}`,
  });
}

async function handleAdminDashboard(request, response) {
  const session = requireAdmin(request, response);
  if (!session) return;
  const [users, payments] = await Promise.all([
    supabaseRequest('/rest/v1/users?select=id,email,name,age,location,interest,created_at,last_seen_at&order=last_seen_at.desc&limit=500'),
    supabaseRequest('/rest/v1/payment_submissions?select=id,user_email,plan_type,utr,screenshot_data,status,submitted_at,reviewed_at,reviewed_by,rejection_reason&order=submitted_at.desc&limit=500'),
  ]);
  const paymentRows = Array.isArray(payments) ? payments : [];
  sendJson(response, 200, {
    admin: { email: session.email },
    counts: {
      users: Array.isArray(users) ? users.length : 0,
      payments: paymentRows.length,
      pending: paymentRows.filter((item) => item.status === 'pending').length,
      approved: paymentRows.filter((item) => item.status === 'approved').length,
      rejected: paymentRows.filter((item) => item.status === 'rejected').length,
    },
    users: Array.isArray(users) ? users : [],
    payments: paymentRows,
  });
}

async function handlePaymentReview(request, response, paymentId) {
  const session = requireAdmin(request, response);
  if (!session) return;
  if (!csrfIsValid(request, session)) {
    sendError(response, 403, 'Invalid CSRF token.');
    return;
  }
  if (!/^[0-9a-f-]{20,}$/i.test(paymentId)) {
    sendError(response, 400, 'Invalid payment id.');
    return;
  }
  const body = await readJson(request, 16 * 1024);
  const status = body.status === 'approved' || body.status === 'rejected' ? body.status : '';
  if (!status) {
    sendError(response, 400, 'Status must be approved or rejected.');
    return;
  }
  const result = await supabaseRequest(`/rest/v1/payment_submissions?id=eq.${encodeURIComponent(paymentId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.email,
      rejection_reason: status === 'rejected' ? text(body.reason, 240) || 'Payment could not be verified.' : null,
    }),
  });
  if (!Array.isArray(result) || result.length === 0) {
    sendError(response, 404, 'Payment submission not found.');
    return;
  }
  sendJson(response, 200, { ok: true, payment: result[0] });
}

async function handleAdminLogout(request, response) {
  const session = getSession(request);
  if (session) sessions.delete(session.token);
  sendJson(response, 200, { ok: true }, {
    'Set-Cookie': 'milan_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
  });
}

function staticFile(request, response) {
  const parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const requestedPath = parsedUrl.pathname === '/' ? '/index.html'
    : parsedUrl.pathname === '/admin' ? '/admin.html' : parsedUrl.pathname;
  const filePath = path.resolve(root, `.${requestedPath}`);
  const relativePath = path.relative(root, filePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)
    || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }
  const extensions = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  response.writeHead(200, {
    'Content-Type': extensions[path.extname(filePath)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (request.method === 'POST' && url.pathname === '/api/chat') return await handleChat(request, response);
    if (request.method === 'POST' && url.pathname === '/api/users/track') return await handleUserTracking(request, response);
    if (request.method === 'POST' && url.pathname === '/api/payments') return await handlePaymentSubmission(request, response);
    if (request.method === 'POST' && url.pathname === '/api/admin/login') return await handleAdminLogin(request, response);
    if (request.method === 'POST' && url.pathname === '/api/admin/logout') return await handleAdminLogout(request, response);
    if (request.method === 'GET' && url.pathname === '/api/admin/session') {
      const session = getSession(request);
      if (!session) return sendError(response, 401, 'Admin login required.');
      return sendJson(response, 200, { ok: true, email: session.email, csrfToken: session.csrf });
    }
    if (request.method === 'GET' && url.pathname === '/api/admin/dashboard') return await handleAdminDashboard(request, response);
    const reviewMatch = url.pathname.match(/^\/api\/admin\/payments\/([^/]+)\/review$/);
    if (request.method === 'POST' && reviewMatch) return await handlePaymentReview(request, response, reviewMatch[1]);
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET, POST' });
      response.end('Method Not Allowed');
      return;
    }
    staticFile(request, response);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error(error.code === 'SUPABASE' ? 'Supabase request failed.' : error.message);
    const message = error.code === 'SUPABASE'
      ? 'Supabase request failed. Verify the environment variables and run the SQL in SUPABASE_SETUP.md.'
      : status === 500 ? 'Unexpected server error.' : error.message;
    sendError(response, status, message);
  }
});

server.listen(port, () => console.log(`Milan is running at http://localhost:${port}`));
