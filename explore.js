// Explore by Topic — Graph + List View (FULLY WORKING)
// ---------- PROGRESS TRACKER ----------
const PROGRESS_KEY = "xaytheon:progress";

function getProgressData() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgressData(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

function updateProgressUI(total) {
  const progressData = getProgressData();
  const completed = Object.keys(progressData).filter(
  key => document.querySelector(`[data-repo="${key}"]`)
).length;

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const bar = document.getElementById("progress-bar");
  const text = document.getElementById("progress-text");

  if (bar) bar.style.width = percent + "%";
  if (text) text.textContent = `${percent}% completed`;
}


(function () {
  const form = document.getElementById("explore-form");
  if (!form) return;

  const topicEl = document.getElementById("ex-base-topic");
  const langEl = document.getElementById("ex-language");
  const limitEl = document.getElementById("ex-limit");
  const statusEl = document.getElementById("ex-status");
  const cacheInfoEl = document.getElementById("ex-cache-info");

  // Debounce helper
  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // API call tracker for rate limiting
  const API_TRACKER = {
    lastCall: 0,
    minInterval: 2000, // 2 seconds between calls to respect rate limits

    canCall() {
      const now = Date.now();
      return (now - this.lastCall) >= this.minInterval;
    },

    recordCall() {
      this.lastCall = Date.now();
    }
  };

  const svg = d3.select("#graph");
  const width = () => svg.node().clientWidth;
  const height = () => svg.node().clientHeight;

  // View toggle
  const graphView = document.getElementById("graph-view");
  const listView = document.getElementById("list-view");

  //Active view button 
  function setActive(btn) {
    document.querySelectorAll(".view-toggle .btn")
      .forEach(b => b.classList.remove("btn-primary"));
    btn.classList.add("btn-primary");
  }

  document.getElementById("view-graph-btn")?.addEventListener("click", () => {
    graphView.style.display = "block";
    listView.style.display = "none";
    setActive(document.getElementById("view-graph-btn"))
  });

  document.getElementById("view-list-btn")?.addEventListener("click", () => {
    graphView.style.display = "none";
    listView.style.display = "block";
    setActive(document.getElementById("view-list-btn"))
  });

  // Graph state
  let sim;
  const nodes = new Map();
  const links = [];
  const linkKeys = new Set();

  // Shared data
  const exploreData = {
    repos: []
  };

  // In-memory + local cache
  const memoryCache = new Map(); // key -> { at:number, items:Array, expiresAt: number }
  const TTL_MS = 15 * 60 * 1000; // 15 minutes

  function saveCache(key, value) {
    const entry = { at: Date.now(), items: value, expiresAt: Date.now() + TTL_MS };
    memoryCache.set(key, entry);
    try { localStorage.setItem('xaytheon:explore:' + key, JSON.stringify(entry)); } catch { }
    updateCacheInfo(key, entry);
  }

  function loadCache(key) {
    const mem = memoryCache.get(key);
    if (mem && Date.now() < mem.expiresAt) {
      updateCacheInfo(key, mem);
      return mem.items;
    }
    try {
      const raw = localStorage.getItem('xaytheon:explore:' + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Date.now() < parsed.expiresAt) {
        // Move to memory cache for faster access
        memoryCache.set(key, parsed);
        updateCacheInfo(key, parsed);
        return parsed.items;
      } else {
        // Remove expired entry
        localStorage.removeItem('xaytheon:explore:' + key);
      }
    } catch { }
    return null;
  }

  function updateCacheInfo(key, entry) {
    if (!cacheInfoEl) return;
    if (entry) {
      const age = Date.now() - entry.at;
      const minutesOld = Math.floor(age / 60000);
      const timeLeft = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 60000));
      cacheInfoEl.innerHTML = `Cached ${minutesOld} min ago, expires in ${timeLeft} min <button id="clear-explore-cache" class="btn btn-sm" style="margin-left: 10px;">Clear Cache</button>`;

      // Add event listener for clear cache button
      setTimeout(() => {
        const clearBtn = document.getElementById('clear-explore-cache');
        if (clearBtn) {
          clearBtn.onclick = () => {
            clearCache();
            cacheInfoEl.innerHTML = 'Cache cleared';
          };
        }
      }, 100);
    }
  }

  function clearCache() {
    memoryCache.clear();
    try {
      // Remove all explore cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('xaytheon:explore:')) {
          localStorage.removeItem(key);
        }
      }
    } catch { }
  }

  function setStatus(msg, level = "info") {
    statusEl.textContent = msg;
    statusEl.style.color = level === "error" ? "#b91c1c" : "#111827";
  }

  function nodeColor(d) {
    return d.type === "topic" ? "#0ea5e9" : "#111827";
  }

  function addNode(id, data) {
    if (!nodes.has(id)) nodes.set(id, { id, ...data });
    return nodes.get(id);
  }

  function addLink(a, b) {
    const key = `${a}->${b}`;
    if (linkKeys.has(key)) return;
    linkKeys.add(key);
    links.push({ source: a, target: b });
  }

  async function ghJson(url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    // Check for rate limiting
    if (res.status === 403 || res.status === 429) {
      const resetTime = res.headers.get('X-RateLimit-Reset');
      const remaining = res.headers.get('X-RateLimit-Remaining');

      if (remaining === '0' || res.status === 429) {
        const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
        const waitTime = resetDate ? Math.ceil((resetDate - Date.now()) / 60000) : 'unknown';
        throw new Error(`⚠️ GitHub API rate limit exceeded. Please try again in ${waitTime} minutes.`);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async function searchReposByTopic(topic, language, limit) {
    const cacheKey = JSON.stringify({ topic, language, limit });

    // Check cache first
    const cached = loadCache(cacheKey);
    if (cached) {
      exploreData.repos.push(...cached);
      return cached;
    }

    const parts = [`topic:${topic}`];
    if (language) parts.push(`language:${language}`);

    const q = encodeURIComponent(parts.join(" "));
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${limit}`;

    const data = await ghJson(url);
    exploreData.repos.push(...data.items);

    // Cache the results
    saveCache(cacheKey, data.items);

    return data.items;
  }
  function calculateTrendScore(repo) {
  return (
    (repo.stargazers_count || 0) * 0.6 +
    (repo.forks_count || 0) * 0.3 +
    (repo.watchers_count || 0) * 0.1
  );
}


 // ---------- LIST VIEW ----------
function renderRepoList(repos) {
  const tbody = document.getElementById("repo-list");
  if (!tbody) return;

  tbody.innerHTML = "";

  const sortedRepos = [...repos].sort(
    (a, b) => calculateTrendScore(b) - calculateTrendScore(a)
  );

  const progressData = getProgressData();

  sortedRepos.forEach(repo => {
    const tr = document.createElement("tr");
    const isChecked = !!progressData[repo.full_name];

    tr.innerHTML = `
      <td>
        <a href="${repo.html_url}" target="_blank" rel="noopener">
          ${repo.full_name}
        </a>
        <a href="health.html?repo=${repo.full_name}"
           style="margin-left:8px; text-decoration:none;"
           title="Check Sustainability">🩺</a>
      </td>
      <td>${repo.topics?.[0] || "—"}</td>
      <td>${repo.language || "—"}</td>
      <td align="right">${repo.stargazers_count}</td>
      <td align="center">
        <input
          type="checkbox"
          class="progress-checkbox"
          data-repo="${repo.full_name}"
          ${isChecked ? "checked" : ""}
        />
      </td>
    `;

    // checkbox change → localStorage
    const checkbox = tr.querySelector(".progress-checkbox");
    checkbox.addEventListener("change", () => {
      const data = getProgressData();

      if (checkbox.checked) {
        data[repo.full_name] = true;
      } else {
        delete data[repo.full_name];
      }

      saveProgressData(data);
      updateProgressUI(sortedRepos.length);
    });

    tbody.appendChild(tr);
  });

  updateProgressUI(sortedRepos.length);
}
// 🔹 DEMO MODE (for proof when API is unavailable)
if (new URLSearchParams(window.location.search).get("demo") === "1") {
  renderRepoList([
    {
      full_name: "demo/repo-one",
      html_url: "https://github.com/demo/repo-one",
      language: "JavaScript",
      stargazers_count: 120,
      topics: ["demo"]
    },
    {
      full_name: "demo/repo-two",
      html_url: "https://github.com/demo/repo-two",
      language: "Python",
      stargazers_count: 80,
      topics: ["demo"]
    }
  ]);
}


  // ---------- GRAPH ----------
  function renderGraph() {
    svg.selectAll("*").remove();

    const g = svg.append("g");
    svg.call(d3.zoom().on("zoom", e => g.attr("transform", e.transform)));

    const nodeArr = Array.from(nodes.values());

    const linkSel = g.append("g")
      .attr("stroke", "rgba(0,0,0,0.25)")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line");

    const nodeSel = g.append("g")
      .selectAll("circle")
      .data(nodeArr, d => d.id)
      .enter()
      .append("circle")
      .attr("r", d => (d.type === "topic" ? 8 : 6))
      .attr("fill", nodeColor)
      .attr("stroke", "#fff")
      .style("cursor", "pointer")
      .on("click", debouncedNodeClick);

    nodeSel.append("title").text(d => d.label);

    sim = d3.forceSimulation(nodeArr)
      .force("charge", d3.forceManyBody().strength(d => d.type === "topic" ? -120 : -40))
      .force("link", d3.forceLink(links).id(d => d.id).distance(70))
      .force("center", d3.forceCenter(width() / 2, height() / 2))
      .force("collide", d3.forceCollide(d => d.type === "topic" ? 14 : 10))
      .on("tick", () => {
        linkSel
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        nodeSel
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
      });
  }

  // Debounced node click function
  const debouncedNodeClick = debounce(async function onNodeClick(event, d) {
    if (d.type === "repo") {
      if (window.trackRepoView) {
        window.trackRepoView({ full_name: d.label, html_url: d.url });
      }
      window.open(d.url, "_blank");
      return;
    }

    // Rate limiting check
    if (!API_TRACKER.canCall()) {
      setStatus('Please wait a moment before expanding another topic.', 'error');
      return;
    }

    API_TRACKER.recordCall();

    try {
      setStatus(`Expanding ${d.label}…`);
      const repos = await searchReposByTopic(d.label, langEl.value.trim(), 30);

      repos.forEach(r => {
        const repoId = `repo:${r.full_name}`;
        addNode(repoId, { type: "repo", label: r.full_name, url: r.html_url });
        addLink(repoId, d.id);
      });

      renderGraph();
      renderRepoList(exploreData.repos);
      setStatus(`Added ${repos.length} repos`);
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Failed to expand topic", "error");

      // Add retry functionality
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-sm';
      retryBtn.textContent = 'Retry';
      retryBtn.style.marginLeft = '10px';
      retryBtn.onclick = () => {
        onNodeClick(event, d);
      };

      const statusContainer = statusEl;
      statusContainer.appendChild(retryBtn);
    }
  }, 300); // 300ms debounce

  // Debounced explore function
  const debouncedExplore = debounce(async function explore() {
    nodes.clear();
    links.length = 0;
    linkKeys.clear();
    exploreData.repos = [];

    const base = topicEl.value.trim() || "threejs";
    const lang = langEl.value.trim();
    const limitValue = limitEl.value.trim();

    // Validate topic
    if (base.length > 50) {
      setStatus("Topic must be 50 characters or less.", "error");
      return;
    }

    // Validate language
    if (lang && lang.length > 20) {
      setStatus("Language must be 20 characters or less.", "error");
      return;
    }

    // Validate limit
    if (!/^\d+$/.test(limitValue)) {
  setStatus("Limit must be a whole number between 10 and 100.", "error");
  return;
}

const limitNum = Number(limitValue);

// 2️⃣ Range check
if (limitNum < 10 || limitNum > 100) {
  setStatus("Limit must be between 10 and 100.", "error");
  return;
}
    const limit = Math.min(100, Math.max(10, limitNum));

    addNode(`topic:${base}`, { type: "topic", label: base });

    // Disable form during loading
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Loading...';
    }

    // Disable all form inputs
    const inputs = form.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (input !== submitBtn) input.disabled = true;
    });

    try {
      // Rate limiting check
      if (!API_TRACKER.canCall()) {
        setStatus('Please wait a moment before making another request.', 'error');
        return;
      }

      API_TRACKER.recordCall();

      if (window.trackSearchInterest) {
        window.trackSearchInterest(base, lang);
      }
      setStatus("Loading repositories…");
      const repos = await searchReposByTopic(base, lang, limit);

      repos.forEach(r => {
        const repoId = `repo:${r.full_name}`;
        addNode(repoId, { type: "repo", label: r.full_name, url: r.html_url });
        addLink(repoId, `topic:${base}`);
      });

      renderGraph();
      renderRepoList(exploreData.repos);
      setStatus(`Loaded ${repos.length} repositories`);
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Failed to load data", "error");

      // Add retry functionality
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn btn-sm';
      retryBtn.textContent = 'Retry';
      retryBtn.style.marginLeft = '10px';
      retryBtn.onclick = () => {
        explore();
      };

      const statusContainer = statusEl;
      statusContainer.appendChild(retryBtn);
    } finally {
      // Re-enable form
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Explore';
      }
      inputs.forEach(input => {
        if (input !== submitBtn) input.disabled = false;
      });
    }
  }, 300); // 300ms debounce

  form.addEventListener("submit", e => {
    e.preventDefault();
    debouncedExplore();
  });

  document.getElementById("ex-clear").addEventListener("click", () => {
    topicEl.value = "threejs";
    langEl.value = "";
    limitEl.value = "50";
    debouncedExplore();
  });

  // Replace the node click handler with debounced version
  // Find the node selection code and replace the click handler
  // We need to update the renderGraph function to use the debounced click handler

  // Initial load with defaults
  debouncedExplore();
  window.renderRepoList = renderRepoList;

})();
