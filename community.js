// Community Highlights: Top-K Trending Repos by Score (Heap)
// Defaults: language Any, topic empty, timeWindow 30, topK 10

(function(){
  const form = document.getElementById('trend-form');
  if (!form) return;

  const langEl = document.getElementById('trend-lang');
  const topicEl = document.getElementById('trend-topic');
  const windowEl = document.getElementById('trend-window');
  const kEl = document.getElementById('trend-k');
  const statusEl = document.getElementById('trend-status');
  const resultsEl = document.getElementById('trend-results');
  const resetBtn = document.getElementById('trend-reset');

  // In-memory + local cache
  const memoryCache = new Map(); // key -> { at:number, items:Array }
  const TTL_MS = 5 * 60 * 1000; // 5 minutes

  // --- Heap implementation (min-heap for Top-K) ---
  class BinaryHeap {
    constructor(compare){
      this.a = [];
      this.cmp = compare || ((x,y)=>x<y);
    }
    size(){ return this.a.length; }
    peek(){ return this.a[0]; }
    push(val){
      const a=this.a; a.push(val);
      let i=a.length-1;
      while(i>0){
        const p=(i-1>>1); // parent
        if(this.cmp(a[i], a[p])){ [a[i],a[p]]=[a[p],a[i]]; i=p; } else break;
      }
    }
    pop(){
      const a=this.a; if(a.length===0) return undefined;
      const top=a[0]; const last=a.pop();
      if(a.length){ a[0]=last; this._down(0);} 
      return top;
    }
    _down(i){
      const a=this.a; const n=a.length;
      while(true){
        let l=i*2+1, r=l+1, m=i;
        if(l<n && this.cmp(a[l], a[m])) m=l;
        if(r<n && this.cmp(a[r], a[m])) m=r;
        if(m===i) break;
        [a[i],a[m]]=[a[m],a[i]]; i=m;
      }
    }
  }

  // Score function: 0.5*stars + 0.3*forks + 0.2*recencyBoost(0..1)
  function computeScore(repo){
    const stars = repo.stargazers_count || 0;
    const forks = repo.forks_count || 0;
    const pushed = new Date(repo.pushed_at);
    const days = Math.max(0, (Date.now() - pushed.getTime()) / (24*3600*1000));
    const decay = 14; // days
    // exp decay mapped roughly to [0,1]
    const recency = Math.exp(-days/decay);
    return 0.5*stars + 0.3*forks + 0.2*recency*100; // scale recency for influence
  }

  function keyFor(filters){
    return JSON.stringify(filters);
  }

  function setStatus(msg, level='info'){
    if(!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = level==='error' ? '#b91c1c' : '#111827';
  }

  function renderCards(items){
    if(!resultsEl) return;
    if(!items || items.length===0){
      resultsEl.innerHTML = '<div class="muted">No repos matched your filters.</div>';
      return;
    }
    resultsEl.innerHTML = items.map(r => `
      <div class="repo-item">
        <div class="repo-name"><a href="${r.html_url}" target="_blank" rel="noopener">${escapeHtml(r.full_name)}</a></div>
        ${r.description ? `<div class="repo-desc">${escapeHtml(r.description)}</div>` : ''}
        <div class="repo-meta">
          <span>★ ${r.stargazers_count||0}</span>
          <span>⑂ ${r.forks_count||0}</span>
          ${r.language ? `<span>${escapeHtml(r.language)}</span>` : ''}
          <span>Pushed ${timeAgo(r.pushed_at)}</span>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(str){
    if(str==null) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s]));
  }

  function timeAgo(dateStr){
    const d = new Date(dateStr);
    const s = Math.floor((Date.now()-d.getTime())/1000);
    const units = [
      ['year', 365*24*3600],
      ['month', 30*24*3600],
      ['day', 24*3600],
      ['hour', 3600],
      ['minute', 60]
    ];
    for(const [name,secs] of units){
      const v = Math.floor(s/secs);
      if(v>=1) return `${v} ${name}${v>1?'s':''} ago`;
    }
    return 'just now';
  }

  async function ghJson(url){
    const res = await fetch(url, { headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'XAYTHEON-Community-Highlights'
    }});
    if(res.status===403){
      // Possibly rate limited; surface friendly error text
      const reset = res.headers.get('x-ratelimit-reset');
      const resetIn = reset ? Math.max(0, Math.round((+reset*1000 - Date.now())/1000)) : null;
      throw new Error(`Rate limit reached. Try again ${resetIn?`in ~${Math.ceil(resetIn/60)} min`:'later'}.`);
    }
    if(!res.ok){
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function fetchRepos(filters){
    // Build search query: use pushed:>=date for activity; include language/topic if present.
    const { language, topic, days } = filters;
    const since = new Date(Date.now() - days*24*3600*1000).toISOString().slice(0,10);
    const parts = [`pushed:>=${since}`];
    if(language) parts.push(`language:${language}`);
    if(topic) parts.push(`topic:${topic}`);
    const q = encodeURIComponent(parts.join(' '));

    // Sort by stars as baseline; fetch first 100 results.
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=100`;
    const data = await ghJson(url);
    return Array.isArray(data.items) ? data.items : [];
  }

  function topK(items, k){
    if(!Array.isArray(items) || items.length===0) return [];
    const heap = new BinaryHeap((a,b)=>a.score<b.score); // min-heap on score
    for(const repo of items){
      const score = computeScore(repo);
      const item = { score, repo };
      if(heap.size()<k){
        heap.push(item);
      } else if(score > heap.peek().score){
        heap.pop();
        heap.push(item);
      }
    }
    // Extract to array high->low
    const out=[]; while(heap.size()) out.push(heap.pop());
    out.sort((a,b)=>b.score-a.score);
    return out.map(x=>({ ...x.repo, _score:x.score }));
  }

  function saveCache(key, value){
    const entry = { at: Date.now(), items: value };
    memoryCache.set(key, entry);
    try{ localStorage.setItem('xaytheon:community:'+key, JSON.stringify(entry)); }catch{}
  }
  function loadCache(key){
    const mem = memoryCache.get(key);
    if(mem && Date.now()-mem.at<TTL_MS) return mem.items;
    try{
      const raw = localStorage.getItem('xaytheon:community:'+key);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(parsed && Date.now()-parsed.at<TTL_MS) return parsed.items;
    }catch{}
    return null;
  }

  async function update(){
    const filters = {
      language: (langEl.value||'').trim(),
      topic: (topicEl.value||'').trim(),
      days: parseInt(windowEl.value||'30',10) || 30,
      k: Math.max(1, Math.min(20, parseInt(kEl.value||'10',10)))
    };
    const cacheKey = keyFor(filters);
    setStatus('Loading trending repositories…');
    resultsEl.innerHTML = '<div class="muted">Loading…</div>';
    try{
      const cached = loadCache(cacheKey);
      let items;
      if(cached){
        items = cached;
      } else {
        const repos = await fetchRepos(filters);
        const top = topK(repos, filters.k);
        items = top;
        saveCache(cacheKey, items);
      }
      renderCards(items);
      setStatus('Done');
    } catch(e){
      console.error(e);
      setStatus(e.message || 'Failed to fetch trending repos', 'error');
      resultsEl.innerHTML = '<div class="muted">Couldn\'t load trending repositories right now.</div>';
    }
  }

  // Events
  form.addEventListener('submit', (e)=>{ e.preventDefault(); update(); });
  resetBtn.addEventListener('click', ()=>{
    langEl.value = '';
    topicEl.value = '';
    windowEl.value = '30';
    kEl.value = '10';
    update();
  });

  // Initial load with defaults
  update();
})();
