const appBasePath = '/app';
const API_BASE = 'https://f7d9-2a02-c7c-5b74-0-dea6-32ff-fe2a-46bb.ngrok-free.app';
let currentSession = null;
let currentTargetBaseUrl = null;

function normalizeUrl(input) {
  if (!input || input.trim() === '') return null;
  try {
    let u = input.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const parsed = new URL(u);
    return parsed.toString();
  } catch (err) {
    return null;
  }
}

async function createSession(targetUrl) {
  const res = await fetch(`${API_BASE}/api/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
  });

  if (!res.ok) throw new Error(`Failed create session: ${res.status}`);
  const data = await res.json();
  return data.session;
}

async function loadProxiedPath(session, path, pushHistory = true) {
  const viewport = document.getElementById('viewport');
  try {
    const encoded = encodeURIComponent(path);
    const res = await fetch(`${API_BASE}/proxy?session=${encodeURIComponent(session)}&path=${encoded}`);
    if (!res.ok) {
      const msg = await res.text();
      viewport.innerHTML = `<div id="error">Proxy error ${res.status}: ${escapeHtml(msg)}</div>`;
      return;
    }
    const html = await res.text();
    viewport.innerHTML = html;

    if (pushHistory) {
      history.pushState({ session, path }, '', appBasePath);
    }

    window.currentProxiedPath = path;

  } catch (err) {
    viewport.innerHTML = `<div id="error">Network error: ${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handleLinkClick(event) {
  const a = event.target.closest('a');
  if (!a || !a.getAttribute('href')) return;

  const href = a.getAttribute('href');
  if (href.startsWith('javascript:') || href.startsWith('data:') || href.startsWith('#')) {
    return;
  }

  event.preventDefault();
  if (!currentSession || !currentTargetBaseUrl) return;

  try {
    const resolved = new URL(href, currentTargetBaseUrl);
    const newPath = resolved.pathname + resolved.search;
    currentTargetBaseUrl = resolved.origin; // update base to follow absolute navigations
    loadProxiedPath(currentSession, newPath);
  } catch (err) {
    console.warn('Invalid href', href, err);
  }
}

async function handleFormSubmit(event) {
  const form = event.target;
  if (form.tagName !== 'FORM') return;

  event.preventDefault();
  if (!currentSession || !currentTargetBaseUrl) return;

  const actionAttr = form.getAttribute('action') || currentTargetBaseUrl;
  const actionUrl = new URL(actionAttr, currentTargetBaseUrl);
  const path = actionUrl.pathname + actionUrl.search;

  const data = new FormData(form);
  const payload = new URLSearchParams();
  data.forEach((v,k)=>payload.append(k,v));

  const res = await fetch(`${API_BASE}/proxy-form?session=${encodeURIComponent(currentSession)}&path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: payload.toString(),
  });

  const viewport = document.getElementById('viewport');
  if (!res.ok) {
    const msg = await res.text();
    viewport.innerHTML = `<div id="error">Form proxy error ${res.status}: ${escapeHtml(msg)}</div>`;
    return;
  }

  currentTargetBaseUrl = actionUrl.origin;
  const html = await res.text();
  viewport.innerHTML = html;
  history.pushState({ session: currentSession, path }, '', appBasePath);
}

function setupViewportInterceptors() {
  const viewport = document.getElementById('viewport');
  viewport.addEventListener('click', handleLinkClick);
  viewport.addEventListener('submit', handleFormSubmit);
}

window.addEventListener('popstate', (event) => {
  const state = event.state;
  if (!state || !state.session || !state.path) return;
  currentSession = state.session;
  loadProxiedPath(state.session, state.path, false);
});

function init() {
  if (location.pathname !== appBasePath) {
    history.replaceState({}, '', appBasePath);
  }

  const urlInput = document.getElementById('urlInput');
  const goBtn = document.getElementById('goBtn');

  goBtn.addEventListener('click', async () => {
    const normalized = normalizeUrl(urlInput.value);
    if (!normalized) {
      document.getElementById('viewport').innerHTML = '<div id="error">Please type a valid URL.</div>';
      return;
    }

    try {
      const session = await createSession(normalized);
      currentSession = session;
      currentTargetBaseUrl = normalized;
      history.pushState({ session, path: '/' }, '', appBasePath);
      await loadProxiedPath(session, '/');
    } catch (err) {
      document.getElementById('viewport').innerHTML = `<div id="error">Session error: ${escapeHtml(err.message)}</div>`;
    }
  });

  setupViewportInterceptors();
}

init();
