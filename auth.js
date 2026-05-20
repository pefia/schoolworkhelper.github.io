(function () {
  const config = {
    domain: 'dev-zgzp0yft7ibbh6tq.us.auth0.com',
    clientId: 'vbeJVVDDrAf5PvEkSjZl6LKHMbG6fu1I'
  };

  let clientPromise;

  function callbackUrl() {
    return location.origin + '/login.html';
  }

  function getNextPath() {
    const next = new URLSearchParams(location.search).get('next');
    if (!next) return '/games.html';
    try {
      const decoded = decodeURIComponent(next);
      return decoded.startsWith('/') ? decoded : '/games.html';
    } catch {
      return '/games.html';
    }
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
        authorizationParams: { redirect_uri: callbackUrl() },
        cacheLocation: 'localstorage'
      });
    }
    return clientPromise;
  }

  async function ensureCallbackHandled() {
    if (location.pathname !== '/login.html') return;
    if (!(location.search.includes('code=') && location.search.includes('state='))) return;
    const client = await getClient();
    await client.handleRedirectCallback();
    history.replaceState({}, '', '/login.html' + location.hash);
  }

  window.Auth = {
    async login(isSignup) {
      const client = await getClient();
      const next = new URLSearchParams(location.search).get('next') || '/games.html';
      await client.loginWithRedirect({
        authorizationParams: {
          redirect_uri: callbackUrl(),
          screen_hint: isSignup ? 'signup' : undefined
        },
        appState: { next }
      });
    },
    async logout() {
      const client = await getClient();
      await client.logout({ logoutParams: { returnTo: location.origin + '/login.html' } });
    },
    async isAuthenticated() {
      await ensureCallbackHandled();
      const client = await getClient();
      return client.isAuthenticated();
    },
    async currentUser() {
      await ensureCallbackHandled();
      const client = await getClient();
      if (!(await client.isAuthenticated())) return null;
      return client.getUser();
    },
    async requireAuth() {
      const authed = await this.isAuthenticated();
      if (!authed) {
        const next = encodeURIComponent(location.pathname + location.search + location.hash);
        location.replace('/login.html?next=' + next);
      }
    },
    async completeLoginRedirect() {
      const params = new URLSearchParams(location.search);
      if (params.get('error')) {
        return { ok: false, error: params.get('error_description') || params.get('error') };
      }

      const hasCode = params.has('code') && params.has('state');
      if (hasCode) {
        const client = await getClient();
        const { appState } = await client.handleRedirectCallback();
        history.replaceState({}, '', '/login.html');
        return { ok: true, next: appState?.next || getNextPath(), redirected: true };
      }

      if (await this.isAuthenticated()) {
        return { ok: true, next: getNextPath() };
      }

      return { ok: false, unauthenticated: true };
    }
  };
})();
