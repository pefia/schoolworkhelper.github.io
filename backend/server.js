const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('dns').promises;
const { CookieJar } = require('tough-cookie');
const { createSession, getSession, updateSession } = require('./sessionStore');
const { rewriteHtml } = require('./rewrite');

const app = express();
const port = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  'https://yourusername.github.io',
  'https://yourdomain.com',
  'http://localhost:3000', // for local testing
];

function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  const parts = ip.split('.').map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

async function resolveAndCheckUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname;
    const entry = await dns.lookup(host, { all: true });
    for (const item of entry) {
      if (isPrivateIp(item.address)) {
        throw new Error('Access to internal/private IP is blocked');
      }
    }
    return url;
  } catch (err) {
    throw new Error(`Invalid or blocked URL ${rawUrl}: ${err.message}`);
  }
}

app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.post('/api/create-session', (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }
  let normalized;
  try {
    normalized = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); // production assumes https by default
  } catch (err) {
    return res.status(400).json({ error: 'Invalid url' });
  }

  const sessionId = createSession(normalized.toString());
  const session = getSession(sessionId);
  if (session) {
    session.cookieJar = new CookieJar();
    updateSession(sessionId, { cookieJar: session.cookieJar });
  }

  res.json({ session: sessionId });
});

async function prepareTargetRequest(session, destinationUrl) {
  if (!session) throw new Error('Session not found');

  if (!session.cookieJar) {
    session.cookieJar = new CookieJar();
    updateSession(session.id, { cookieJar: session.cookieJar });
  }

  const cookieHeader = await session.cookieJar.getCookieString(destinationUrl.toString());
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; proxy/1.0)',
    Accept: '*/*',
    ... (cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  return headers;
}

async function storeCookies(session, destinationUrl, setCookieHeaders) {
  if (!setCookieHeaders || !session || !session.cookieJar) return;
  const jar = session.cookieJar;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const cookieText of headers) {
    try {
      await jar.setCookie(cookieText, destinationUrl.toString(), { ignoreError: true });
    } catch (err) {
      console.warn('Cookie set error', err.message);
    }
  }
}

app.get('/proxy', async (req, res) => {
  const { session: sessionId, path } = req.query;
  if (!sessionId || !path) return res.status(400).send('session and path required');

  const session = getSession(sessionId);
  if (!session) return res.status(404).send('Session not found');
  session.id = sessionId;

  let targetUrl;
  try {
    const base = await resolveAndCheckUrl(session.baseUrl);
    const resolved = new URL(path, base);
    await resolveAndCheckUrl(resolved.toString());
    targetUrl = resolved;
  } catch (err) {
    return res.status(400).send(err.message);
  }

  const headers = await prepareTargetRequest(session, targetUrl);

  try {
    const targetResponse = await axios.get(targetUrl.toString(), {
      headers,
      responseType: 'arraybuffer',
      validateStatus: null,
      maxRedirects: 5,
    });

    await storeCookies(session, targetUrl, targetResponse.headers['set-cookie']);
    updateSession(sessionId, { lastPath: path });

    const ct = targetResponse.headers['content-type'] || 'application/octet-stream';
    res.set('content-type', ct);

    if ((ct.includes('text/html') || ct.includes('application/xhtml+xml')) && targetResponse.data) {
      const html = targetResponse.data.toString('utf8');
      const rewritten = rewriteHtml(html, sessionId, targetUrl.toString());
      return res.send(rewritten);
    }

    if (targetResponse.data) {
      return res.send(targetResponse.data);
    }
    return res.status(502).send('Empty response from target');

  } catch (err) {
    console.error('Proxy error', err.message);
    return res.status(500).send(`Proxy fetch error: ${err.message}`);
  }
});

app.post('/proxy-form', async (req, res) => {
  const { session: sessionId, path } = req.query;
  if (!sessionId || !path) return res.status(400).send('session and path required');

  const session = getSession(sessionId);
  if (!session) return res.status(404).send('Session not found');
  session.id = sessionId;

  let targetUrl;
  try {
    const base = await resolveAndCheckUrl(session.baseUrl);
    const resolved = new URL(path, base);
    await resolveAndCheckUrl(resolved.toString());
    targetUrl = resolved;
  } catch (err) {
    return res.status(400).send(err.message);
  }

  const headers = await prepareTargetRequest(session, targetUrl);
  const contentType = req.get('Content-Type') || 'application/x-www-form-urlencoded';
  headers['Content-Type'] = contentType;

  let payload = req.body;

  if (contentType.includes('application/json')) payload = JSON.stringify(req.body);
  if (contentType.includes('application/x-www-form-urlencoded')) {
    payload = new URLSearchParams(req.body).toString();
  }

  try {
    const targetResponse = await axios.post(targetUrl.toString(), payload, {
      headers,
      responseType: 'arraybuffer',
      validateStatus: null,
      maxRedirects: 5,
    });

    await storeCookies(session, targetUrl, targetResponse.headers['set-cookie']);
    updateSession(sessionId, { lastPath: path });

    const ct = targetResponse.headers['content-type'] || 'application/octet-stream';
    res.set('content-type', ct);

    if ((ct.includes('text/html') || ct.includes('application/xhtml+xml')) && targetResponse.data) {
      const html = targetResponse.data.toString('utf8');
      const rewritten = rewriteHtml(html, sessionId, targetUrl.toString());
      return res.send(rewritten);
    }

    return res.send(targetResponse.data);
  } catch (err) {
    console.error('Proxy-form error', err.message);
    return res.status(500).send(`Proxy form error: ${err.message}`);
  }
});

app.get('/proxy-asset', async (req, res) => {
  const { session: sessionId, url: assetUrl } = req.query;
  if (!sessionId || !assetUrl) return res.status(400).send('session and url required');

  const session = getSession(sessionId);
  if (!session) return res.status(404).send('Session not found');
  session.id = sessionId;

  let targetUrl;
  try {
    targetUrl = await resolveAndCheckUrl(decodeURIComponent(assetUrl));
  } catch (err) {
    return res.status(400).send(err.message);
  }

  const headers = await prepareTargetRequest(session, targetUrl);

  try {
    const targetResponse = await axios.get(targetUrl.toString(), {
      headers,
      responseType: 'arraybuffer',
      validateStatus: null,
      maxRedirects: 5,
    });

    await storeCookies(session, targetUrl, targetResponse.headers['set-cookie']);
    updateSession(sessionId, { lastPath: targetUrl.pathname });

    const ct = targetResponse.headers['content-type'];
    if (ct) res.set('content-type', ct);
    return res.send(targetResponse.data);
  } catch (err) {
    console.error('Proxy-asset error', err.message);
    return res.status(500).send(`Proxy asset error: ${err.message}`);
  }
});

app.listen(port, () => {
  console.log(`Proxy backend listening on ${port}`);
});
