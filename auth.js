// Supabase Auth Integration (client-only)
// Initializes Supabase, renders navbar auth UI, handles magic link redirects, and sign out.

(function(){
  const SUPABASE_URL = 'https://gqwohbqudbxahlssuohr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxd29oYnF1ZGJ4YWhsc3N1b2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDM0OTgsImV4cCI6MjA3NjA3OTQ5OH0.KLkjEHdMM5xUpO-bLRhLGYF_x6XShzjso4Evwlxza2I';

  let client;
  function ensureClient(){
    if (!client) {
      if (!window.supabase || !window.supabase.createClient) {
        console.warn('Supabase SDK not loaded');
        return null;
      }
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  async function getSession(){
    const c = ensureClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data?.session || null;
  }

  function computeRedirectTo(){
    // Redirect back to index.html in the same repo path (works for GitHub Pages subpaths)
    const { origin, pathname } = location;
    const basePath = pathname.replace(/\/[^\/]*$/, '/');
    return origin + basePath + 'index.html';
  }

  function initialsAvatarData(text) {
    const ch = (text||'?').trim().charAt(0).toUpperCase() || '?';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>
      <rect width='100%' height='100%' rx='8' ry='8' fill='#111'/>
      <text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='32' fill='#fff'>${ch}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function getAvatarUrl(session){
    const user = session?.user;
    const meta = user?.user_metadata || {};
    const email = user?.email || '';
    return (
      meta.avatar_url || meta.picture || initialsAvatarData(email)
    );
  }

  async function renderAuthArea(){
    const container = document.getElementById('auth-area');
    if (!container) return;
    const session = await getSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      container.innerHTML = '<a class="btn btn-outline" href="login.html">Sign in</a>';
      return;
    }

    const avatar = getAvatarUrl(session);
    container.innerHTML = `
      <div class="user-menu">
        <button class="user-button" id="user-button" aria-haspopup="true" aria-expanded="false" title="${escapeHtml(userEmail)}">
          <img class="user-avatar" src="${avatar}" alt="User avatar" />
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        <div class="user-dropdown" id="user-dropdown" role="menu" hidden>
          <button class="dropdown-item" id="sign-out-btn" role="menuitem">Sign out</button>
        </div>
      </div>`;

    const btn = document.getElementById('user-button');
    const dd = document.getElementById('user-dropdown');
    const signOutBtn = document.getElementById('sign-out-btn');

    if (btn && dd) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = dd.hasAttribute('hidden');
        if (isHidden) {
          dd.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          dd.setAttribute('hidden', '');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('click', (e) => {
        if (!dd || dd.hasAttribute('hidden')) return;
        const within = e.target === btn || btn.contains(e.target) || dd.contains(e.target);
        if (!within) {
          dd.setAttribute('hidden', '');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        const c = ensureClient();
        if (!c) return;
        try {
          await c.auth.signOut();
        } finally {
          // Immediately re-render UI and gating without requiring a manual refresh
          await renderAuthArea();
          await applyAuthGating();
        }
      });
    }
  }

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  async function handleAuthState(){
    const c = ensureClient();
    if (!c) return;
    // Render immediately
    await renderAuthArea();
    // React to auth changes
    c.auth.onAuthStateChange(async (_event, _session) => {
      await renderAuthArea();
      // Optionally gate content blocks marked data-requires-auth
      applyAuthGating();
      // Notify other modules
      try { window.dispatchEvent(new CustomEvent('xaytheon:authchange')); } catch {}
    });
    applyAuthGating();
    // Re-apply once after a short delay (covers delayed session hydration on first load)
    setTimeout(applyAuthGating, 300);
  }

  async function applyAuthGating(){
    const session = await getSession();
    const authed = !!session;
    document.querySelectorAll('[data-requires-auth]').forEach((el) => {
      el.style.display = authed ? '' : 'none';
    });
    document.querySelectorAll('[data-requires-guest]').forEach((el) => {
      el.style.display = authed ? 'none' : '';
    });
  }

  // Expose a helper for login page to trigger magic link
  async function sendMagicLink(email){
    const c = ensureClient();
    if (!c) throw new Error('Supabase not available');
    const redirectTo = computeRedirectTo();
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    return true;
  }

  window.XAYTHEON_AUTH = { ensureClient, getSession, handleAuthState, sendMagicLink };

  // Initialize on DOM ready
  window.addEventListener('DOMContentLoaded', handleAuthState);
})();
// Supabase Auth bootstrap (client-side, works on GitHub Pages)
(() => {
  const SUPABASE_URL = 'https://gqwohbqudbxahlssuohr.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxd29oYnF1ZGJ4YWhsc3N1b2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MDM0OTgsImV4cCI6MjA3NjA3OTQ5OH0.KLkjEHdMM5xUpO-bLRhLGYF_x6XShzjso4Evwlxza2I';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('Supabase SDK not loaded. Ensure @supabase/supabase-js is included before auth.js');
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Expose globally for optional use elsewhere
  window.sb = sb;

  function qs(id) { return document.getElementById(id); }

  async function refreshAuthUI() {
    try {
      const { data: { user } } = await sb.auth.getUser();

      const signin = qs('auth-signin');
      const signout = qs('auth-signout');
      const userEl = qs('auth-user');

      if (user) {
        if (signin) signin.style.display = 'none';
        if (signout) signout.style.display = '';
        if (userEl) { userEl.textContent = user.email || user.user_metadata?.name || 'Signed in'; userEl.style.display = ''; }
        toggleGated(true);
      } else {
        if (signin) signin.style.display = '';
        if (signout) signout.style.display = 'none';
        if (userEl) { userEl.textContent = ''; userEl.style.display = 'none'; }
        toggleGated(false);
      }
    } catch (e) {
      console.warn('Auth UI refresh error:', e);
    }
  }

  function toggleGated(authed) {
    document.querySelectorAll('[data-requires-auth]')
      .forEach(el => { el.style.display = authed ? '' : 'none'; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Wire sign out
    const signout = qs('auth-signout');
    if (signout) {
      signout.addEventListener('click', async () => {
        try { await sb.auth.signOut(); } catch {}
        await refreshAuthUI();
      });
    }

    // Initial UI sync and listen to changes
    refreshAuthUI();
    sb.auth.onAuthStateChange((_event, _session) => {
      refreshAuthUI();
    });
  });
})();
