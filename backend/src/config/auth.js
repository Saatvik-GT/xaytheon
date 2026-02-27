(function () {
  "use strict";

  const API_BASE_URL = "http://127.0.0.1:5000/api/auth";
  const REQUEST_TIMEOUT = 30000;

  // NEW: Supabase Client Initialization
  let supabaseClient = null;

  function ensureClient() {
    if (supabaseClient) return supabaseClient;

    // Replace with your actual project credentials
    const SUPABASE_URL = window.__SUPABASE_URL__;
    const SUPABASE_KEY = window.__SUPABASE_ANON_KEY__;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error("Supabase config not provided");
      return null;
    }

    if (typeof supabase === "undefined") {
      console.error("Supabase SDK not loaded");
      return null;
    }

    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return supabaseClient;
  }

  function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  // ... (existing helper functions: fetchWithTimeout, isTokenExpired, setAccessToken)

  let accessToken = null;
  let currentUser = null;
  let tokenExpiryTime = null;
  let refreshTimer = null;

  const authChannel = new BroadcastChannel("xaytheon_auth");

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function scheduleTokenRefresh() {
    clearRefreshTimer();
    if (!tokenExpiryTime) return;

    const delay = tokenExpiryTime - Date.now() - 5000;
    if (delay <= 0) return;

    refreshTimer = setTimeout(async () => {
      try {
        await refreshAccessToken();
      } catch (err) {
        console.error("Token refresh failed", err);
        logout(false);
      }
    }, delay);
  }

  function updateAuthUI() {
    document
      .querySelectorAll("[data-requires-auth]")
      .forEach(el => (el.style.display = accessToken ? "" : "none"));

    document
      .querySelectorAll("[data-requires-guest]")
      .forEach(el => (el.style.display = accessToken ? "none" : ""));
  }

  function setAccessToken(token, expiresIn, user) {
    accessToken = token;
    currentUser = user || null;
    tokenExpiryTime = Date.now() + expiresIn * 1000;

    scheduleTokenRefresh();
    updateAuthUI();

    window.dispatchEvent(
      new CustomEvent("xaytheon:authchange", {
        detail: { user: currentUser }
      })
    );

    authChannel.postMessage({ type: "authchange" });
  }

  // ... (existing session management: getSession, refreshAccessToken, authenticatedFetch)

  async function logout(shouldReload = true) {
    try {
      await fetch(`${API_BASE_URL}/logout`, { method: "POST" });
    } catch {}

    clearRefreshTimer();

    accessToken = null;
    currentUser = null;
    tokenExpiryTime = null;

    localStorage.removeItem("x_refresh_token");

    updateAuthUI();

    window.dispatchEvent(
      new CustomEvent("xaytheon:authchange", {
        detail: { user: null }
      })
    );

    authChannel.postMessage({ type: "logout" });

    if (shouldReload) window.location.reload();
  }

  authChannel.onmessage = event => {
    if (event.data.type === "logout") {
      clearRefreshTimer();
      accessToken = null;
      currentUser = null;
      tokenExpiryTime = null;
      updateAuthUI();
    }

    if (event.data.type === "authchange") {
      updateAuthUI();
    }
  };

  // UPDATED: Expose ensureClient in the public API
  window.XAYTHEON_AUTH = {
    ensureClient,
    getSession,
    login: async (email, password) => { /* logic */ },
    register: async (email, password) => { /* logic */ },
    logout,
    authenticatedFetch,
    isAuthenticated: () => !!accessToken,
    getAccessToken: () => accessToken
  };

  // Init logic
  window.addEventListener("DOMContentLoaded", async () => {
    if (localStorage.getItem("x_refresh_token")) {
      try {
        await refreshAccessToken();
      } catch (err) {
        console.error("Session restoration failed", err);
        localStorage.removeItem("x_refresh_token");
      }
    }

    updateAuthUI();
  });

  window.addEventListener("xaytheon:authchange", updateAuthUI);
})();
