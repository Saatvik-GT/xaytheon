// Explore by Topic: Force-directed topic map with BFS expansion
// Tokenless: Uses GitHub Search API for repos by base topic, optional language
// Nodes: topic (blue) and repo (black). Edges connect repo -> topic.
// Click a topic node to BFS-expand neighbors (discover more repos by that topic).

(function(){
  const form = document.getElementById('explore-form');
  if(!form) return;

  const topicEl = document.getElementById('ex-base-topic');
  const langEl = document.getElementById('ex-language');
  const limitEl = document.getElementById('ex-limit');
  const statusEl = document.getElementById('ex-status');

  const svg = d3.select('#graph');
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  let sim, linkSel, nodeSel; // d3 selections
  const linkKeys = new Set(); // track unique edges

  // Data structures
  const nodes = new Map(); // id -> node { id, type: 'topic'|'repo', label }
  const links = []; // { source, target }

  function setStatus(msg, level='info'){
    if(!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = level==='error' ? '#b91c1c' : '#111827';
  }

  function nodeColor(d){
    return d.type==='topic' ? '#0ea5e9' : '#111827';
  }

  function addNode(id, data){
    if(!nodes.has(id)) nodes.set(id, { id, ...data });
    return nodes.get(id);
  }

  function addLink(a, b){
    const key = `${a}->${b}`;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    links.push({ source: a, target: b });
  }

  async function ghJson(url){
    const res = await fetch(url, { headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'XAYTHEON-Explore-Topic'
    }});
    if(!res.ok){
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function searchReposByTopic(topic, language, perPage){
    const parts = [`topic:${topic}`];
    if(language) parts.push(`language:${language}`);
    const q = encodeURIComponent(parts.join(' '));
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${Math.max(10, Math.min(100, perPage||50))}`;
    const data = await ghJson(url);
    return Array.isArray(data.items) ? data.items : [];
  }

  // Render/Update the force graph
  function render(){
    // Build arrays for d3
    const nodeArr = Array.from(nodes.values());

    // Clear svg
    svg.selectAll('*').remove();

    // Zoom/pan
    const g = svg.append('g');
    const zoom = d3.zoom().on('zoom', (ev)=>{ g.attr('transform', ev.transform); });
    svg.call(zoom);

    // Links
    linkSel = g.append('g')
      .attr('stroke', 'rgba(0,0,0,0.2)')
      .attr('stroke-width', 1)
      .selectAll('line')
      .data(links)
      .enter()
      .append('line');

    // Nodes
    nodeSel = g.append('g')
      .selectAll('circle')
      .data(nodeArr, d=>d.id)
      .enter()
      .append('circle')
      .attr('r', d=> d.type==='topic' ? 8 : 6)
      .attr('fill', nodeColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', onNodeClick);

    // Titles
    nodeSel.append('title').text(d=>{
      if (d.type === 'repo') return `${d.label}\n${d.url||''}`;
      return d.label || d.id;
    });

    // Labels (lightweight)
    const labelSel = g.append('g')
      .selectAll('text')
      .data(nodeArr, d=>d.id)
      .enter()
      .append('text')
      .text(d=> d.type==='topic' ? d.label : '')
      .attr('font-size', 10)
      .attr('fill', '#333');

    // Simulation (tuned for larger samples):
    // - Slightly stronger repulsion for topic to keep spokes open
    // - Collide radius scaled by node type
    // - Gentle x/y centering to avoid drifting to edges
    // - Reheat alpha when (re)rendering
    sim = d3.forceSimulation(nodeArr)
      .force('charge', d3.forceManyBody().strength(d => d.type==='topic' ? -120 : -35))
      .force('link', d3.forceLink(links).id(d=>d.id).distance(l => (l.source.type==='repo' && l.target.type==='topic') ? 70 : 60).strength(0.8))
      .force('center', d3.forceCenter(width()/2, height()/2))
      .force('x', d3.forceX(width()/2).strength(0.05))
      .force('y', d3.forceY(height()/2).strength(0.05))
      .force('collide', d3.forceCollide(d => d.type==='topic' ? 12 : 9))
      .alpha(1)
      .alphaDecay(0.06)
      .on('tick', ()=>{
        linkSel
          .attr('x1', d=>d.source.x)
          .attr('y1', d=>d.source.y)
          .attr('x2', d=>d.target.x)
          .attr('y2', d=>d.target.y);
        g.selectAll('circle')
          .attr('cx', d=>d.x)
          .attr('cy', d=>d.y);
        labelSel
          .attr('x', d=>d.x+8)
          .attr('y', d=>d.y+4);
      });

    // Keep forces centered on resize
    window.addEventListener('resize', () => {
      if (!sim) return;
      sim.force('center', d3.forceCenter(width()/2, height()/2));
      sim.force('x', d3.forceX(width()/2).strength(0.05));
      sim.force('y', d3.forceY(height()/2).strength(0.05));
      sim.alpha(0.5).restart();
    });
  }

  async function onNodeClick(event, d){
    if (d.type === 'repo') {
      if (d.url) window.open(d.url, '_blank', 'noopener');
      return;
    }
    if (d.type !== 'topic') return;
    // BFS-like expand: fetch repos for this topic and link them in
    try{
      setStatus(`Expanding topic ${d.label}…`);
      const repos = await searchReposByTopic(d.label, langEl.value.trim(), 30);
      let added = 0;
      for (const r of repos){
        const repoId = `repo:${r.full_name}`;
        const topicId = `topic:${d.label}`;
        addNode(repoId, { type:'repo', label:r.full_name, url: r.html_url });
        addLink(repoId, topicId);
        added++;
      }
      setStatus(added?`Added ${added} repos for ${d.label}.`:'No new repos for this topic.');
      render();
    } catch(e){
      console.error(e);
      setStatus(e.message || 'Failed to expand topic', 'error');
    }
  }

  async function explore(){
    nodes.clear();
    links.length = 0;
    linkKeys.clear();
    const base = (topicEl.value||'').trim() || 'threejs';
    const lang = (langEl.value||'').trim();
    const limit = Math.max(10, Math.min(100, parseInt(limitEl.value||'50',10)));

    // Seed the base topic
  addNode(`topic:${base}`, { type:'topic', label: base });

    try{
      setStatus('Loading repositories…');
      const repos = await searchReposByTopic(base, lang, limit);
      let added = 0;
      for (const r of repos){
        const repoId = `repo:${r.full_name}`;
        addNode(repoId, { type:'repo', label: r.full_name, url: r.html_url });
        addLink(repoId, `topic:${base}`);
        added++;
      }
      setStatus(`Loaded ${added} repos for topic ${base}. Click a topic node to expand.`);
      render();
    } catch(e){
      console.error(e);
      setStatus(e.message || 'Failed to load repositories', 'error');
    }
  }

  form.addEventListener('submit', (e)=>{ e.preventDefault(); explore(); });
  document.getElementById('ex-clear').addEventListener('click', ()=>{
    topicEl.value = 'threejs';
    langEl.value = '';
    limitEl.value = '50';
    explore();
  });

  // Initial
  explore();
})();
