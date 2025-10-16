// User Contributions CRUD (Supabase)
(function(){
  const supa = () => (window.supabase && window.XAYTHEON_AUTH?.ensureClient()) || null;

  function status(msg, level='info'){ const el = document.getElementById('contrib-status'); if (el){ el.textContent = msg; el.style.color = level==='error'?'#b91c1c':'#111827'; } }

  async function getUser(){ const s = await window.XAYTHEON_AUTH.getSession(); return s?.user || null; }

  async function ensureTables(){
    // Tables and buckets must be created in Supabase. Provide SQL helper in README if needed.
    // Expected table: contributions (id uuid default uuid_generate_v4() primary key, user_id uuid, project text, link text, program text, date date, type text, description text, tech text, screenshot_url text, created_at timestamp default now()) with RLS: user_id = auth.uid()
  }

  async function uploadScreenshot(file, userId){
    if (!file) return null;
    const c = supa(); if (!c) return null;
    const path = `${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const { error } = await c.storage.from('contrib-screens').upload(path, file, { upsert: false });
    if (error) { console.warn('upload error', error); return null; }
    const { data } = c.storage.from('contrib-screens').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function saveContribution(e){
    e.preventDefault();
    const c = supa(); if (!c) return;
    const user = await getUser(); if (!user){ status('Please sign in to save.', 'error'); return; }

    const project = document.getElementById('cf-project').value.trim();
    const link = document.getElementById('cf-link').value.trim();
    const program = document.getElementById('cf-program').value.trim();
    const date = document.getElementById('cf-date').value || null;
    const type = document.getElementById('cf-type').value.trim();
    const description = document.getElementById('cf-desc').value.trim();
    const tech = document.getElementById('cf-tech').value.trim();
    const file = document.getElementById('cf-shot').files[0] || null;

    status('Saving...');
    let screenshot_url = null;
    try { screenshot_url = await uploadScreenshot(file, user.id); } catch {}

    const { error } = await c.from('contributions').insert({
      user_id: user.id,
      project, link, program, date, type, description, tech, screenshot_url
    });
    if (error) { status('Save failed: ' + error.message, 'error'); return; }
    status('Saved.');
    (document.getElementById('contrib-form')).reset();
    await listContributions();
  }

  function rowHtml(r){
    const shot = r.screenshot_url ? `<img src="${r.screenshot_url}" alt="screenshot" style="max-width:120px; border-radius:8px;"/>` : '';
    const date = r.date ? new Date(r.date).toLocaleDateString() : '';
    return `
      <div class="repo-item" data-id="${r.id}" style="display:grid; grid-template-columns: 1fr auto; gap: 8px; align-items:center;">
        <div>
          <div class="repo-name" style="font-family:'Eightgon',sans-serif;">${escapeHtml(r.project || '')}</div>
          <div class="repo-desc">${escapeHtml(r.description || '')}</div>
          <div class="repo-meta">
            ${r.link ? `<a href="${r.link}" target="_blank" rel="noopener">Link</a>` : ''}
            ${r.program ? `<span>${escapeHtml(r.program)}</span>` : ''}
            ${r.type ? `<span>${escapeHtml(r.type)}</span>` : ''}
            ${date ? `<span>${date}</span>` : ''}
            ${r.tech ? `<span>${escapeHtml(r.tech)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          ${shot}
          <button class="btn btn-outline contrib-del" data-id="${r.id}" title="Delete">Delete</button>
        </div>
      </div>`;
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

  async function listContributions(){
    const c = supa(); if (!c) return;
    const list = document.getElementById('contrib-list'); if (!list) return;
    const user = await getUser(); if (!user){ list.innerHTML = ''; return; }
    const { data, error } = await c.from('contributions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) { list.innerHTML = `<div class="muted">Load failed: ${escapeHtml(error.message)}</div>`; return; }
    if (!data || !data.length) { list.innerHTML = '<div class="muted">No contributions yet.</div>'; return; }
    list.innerHTML = data.map(rowHtml).join('');
    // Wire delete buttons
    list.querySelectorAll('.contrib-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        if (!confirm('Delete this contribution?')) return;
        const c = supa(); if (!c) return;
        const { error } = await c.from('contributions').delete().eq('id', id);
        if (error) { status('Delete failed: ' + error.message, 'error'); return; }
        status('Deleted.');
        await listContributions();
      });
    });
  }

  function onReady(){
    const form = document.getElementById('contrib-form');
    if (form) form.addEventListener('submit', saveContribution);
    listContributions();
    window.addEventListener('xaytheon:authchange', listContributions);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', onReady);
  } else {
    // DOM is already ready when script is loaded at the end of body
    onReady();
  }
})();
