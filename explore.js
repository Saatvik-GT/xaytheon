// ============================================================
// explore.js - Interactive GitHub Topic Explorer
//
// Shows an interactive force-directed graph of GitHub repos.
// Blue nodes = topics. Black nodes = repositories.
// Lines connect repos to their topics.
// Click a blue topic node to discover more repos related to it.
//
// Uses D3.js - a library that makes interactive data visualizations.
// The D3 API calls look different from regular JavaScript, but the
// logic around them uses regular functions and objects.
// ============================================================

window.addEventListener('DOMContentLoaded', function() {

  // --- Get references to form elements ---
  var form       = document.getElementById('explore-form');
  if (!form) return;  // only run on the explore page

  var topicInput = document.getElementById('ex-base-topic');
  var langInput  = document.getElementById('ex-language');
  var limitInput = document.getElementById('ex-limit');
  var statusEl   = document.getElementById('ex-status');
  var clearBtn   = document.getElementById('ex-clear');

  // The SVG element where D3 will draw the graph
  var svg = d3.select('#graph');
  var FILTERS_KEY = 'xaytheon:exploreFilters';


  // ============================================================
  // DATA STRUCTURES
  // ============================================================
  // We store nodes and links in plain objects/arrays.
  //
  // nodesById: an object where each key is a node's id
  //   { "topic:javascript": { id, type, label }, "repo:user/name": { ... }, ... }
  //
  // linksArray: an array of connections between nodes
  //   [ { source: "repo:user/name", target: "topic:javascript" }, ... ]
  //
  // linkSet: an object we use to check if a link already exists (avoid duplicates)
  //   { "repo:user/name->topic:javascript": true }

  var nodesById  = {};
  var linksArray = [];
  var linkSet    = {};


  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#b91c1c' : '#111827';
  }

  function loadSavedFilters() {
    try {
      var raw = localStorage.getItem(FILTERS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveCurrentFilters() {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        topic:    topicInput.value.trim(),
        language: langInput.value,
        limit:    limitInput.value
      }));
    } catch (error) {
      console.warn('Could not save explore filters:', error);
    }
  }

  function restoreSavedFilters() {
    var saved = loadSavedFilters();
    if (!saved) return;

    if (typeof saved.topic === 'string')    topicInput.value = saved.topic;
    if (typeof saved.language === 'string') langInput.value = saved.language;
    if (typeof saved.limit === 'string')    limitInput.value = saved.limit;
  }

  // Add a node to the graph (skips if it already exists)
  function addNode(id, data) {
    if (!nodesById[id]) {
      nodesById[id] = {
        id:    id,
        type:  data.type,   // "topic" or "repo"
        label: data.label,
        url:   data.url     // only repos have a URL
      };
    }
  }

  // Add a link between two nodes (skips if it already exists)
  function addLink(sourceId, targetId) {
    var key = sourceId + '->' + targetId;
    if (!linkSet[key]) {
      linkSet[key] = true;
      linksArray.push({ source: sourceId, target: targetId });
    }
  }


  // ============================================================
  // DATA FETCHING
  // ============================================================

  // Fetch repositories from GitHub by topic (and optional language)
  async function fetchReposByTopic(topic, language, perPage) {
    var count = Math.max(10, Math.min(100, perPage || 50));

    var query = 'topic:' + topic;
    if (language) query += ' language:' + language;

    var url =
      'https://api.github.com/search/repositories' +
      '?q=' + encodeURIComponent(query) +
      '&sort=stars&order=desc&per_page=' + count;

    var response = await fetch(url, {
      headers: {
        'Accept':     'application/vnd.github+json',
        'User-Agent': 'XAYTHEON-Explore'
      }
    });

    if (!response.ok) {
      throw new Error('GitHub API error: ' + response.status);
    }

    var data = await response.json();
    return data.items || [];
  }


  // ============================================================
  // GRAPH RENDERING (D3.js)
  // ============================================================

  // Draw the force-directed graph from the current nodesById and linksArray
  function renderGraph() {
    // Convert the nodesById object into a plain array for D3
    var nodesArray = [];
    for (var id in nodesById) {
      nodesArray.push(nodesById[id]);
    }

    var w = svg.node().clientWidth;
    var h = svg.node().clientHeight;

    // Clear the old graph
    svg.selectAll('*').remove();

    // Create a group element (g) that supports zoom/pan
    var g = svg.append('g');

    // Add zoom and pan behavior to the whole SVG
    var zoom = d3.zoom().on('zoom', function(event) {
      g.attr('transform', event.transform);
    });
    svg.call(zoom);

    // --- Draw the links (lines) ---
    var linkSelection = g.append('g')
      .attr('stroke', 'rgba(0,0,0,0.2)')
      .attr('stroke-width', 1)
      .selectAll('line')
      .data(linksArray)
      .enter()
      .append('line');

    // --- Draw the nodes (circles) ---
    var nodeSelection = g.append('g')
      .selectAll('circle')
      .data(nodesArray, function(d) { return d.id; })
      .enter()
      .append('circle')
      .attr('r', function(d) {
        return d.type === 'topic' ? 8 : 6;   // topics are slightly larger
      })
      .attr('fill', function(d) {
        return d.type === 'topic' ? '#0ea5e9' : '#111827';  // blue = topic, black = repo
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', onNodeClick);  // call onNodeClick when a node is clicked

    // Add a tooltip (text shown on hover) to each node
    nodeSelection.append('title').text(function(d) {
      return d.type === 'repo'
        ? d.label + '\n' + (d.url || '')
        : d.label;
    });

    // --- Draw labels (only for topic nodes) ---
    var labelSelection = g.append('g')
      .selectAll('text')
      .data(nodesArray, function(d) { return d.id; })
      .enter()
      .append('text')
      .text(function(d) { return d.type === 'topic' ? d.label : ''; })
      .attr('font-size', 10)
      .attr('fill', '#333');

    // --- Force simulation ---
    // D3's force simulation makes nodes push each other apart and
    // links pull connected nodes together — like springs and magnets.
    d3.forceSimulation(nodesArray)
      .force('charge', d3.forceManyBody().strength(function(d) {
        return d.type === 'topic' ? -120 : -35;  // topics repel more strongly
      }))
      .force('link', d3.forceLink(linksArray)
        .id(function(d) { return d.id; })
        .distance(70)       // preferred link length
        .strength(0.8)
      )
      .force('center',  d3.forceCenter(w / 2, h / 2))    // pull everything toward center
      .force('collide', d3.forceCollide(10))              // prevent nodes from overlapping
      .on('tick', function() {
        // "tick" runs on every animation frame — we update positions here
        linkSelection
          .attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; });

        g.selectAll('circle')
          .attr('cx', function(d) { return d.x; })
          .attr('cy', function(d) { return d.y; });

        labelSelection
          .attr('x', function(d) { return d.x + 8; })
          .attr('y', function(d) { return d.y + 4; });
      });
  }


  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  // Called when the user clicks a node in the graph
  async function onNodeClick(event, d) {
    if (d.type === 'repo') {
      // Clicking a repo node opens it on GitHub in a new tab
      if (d.url) window.open(d.url, '_blank');
      return;
    }

    if (d.type === 'topic') {
      // Clicking a topic node fetches more repos related to that topic
      try {
        setStatus('Expanding topic "' + d.label + '"…');
        var repos = await fetchReposByTopic(d.label, langInput.value.trim(), 30);

        var added = 0;
        for (var i = 0; i < repos.length; i++) {
          var repo    = repos[i];
          var repoId  = 'repo:'  + repo.full_name;
          var topicId = 'topic:' + d.label;
          addNode(repoId, { type: 'repo', label: repo.full_name, url: repo.html_url });
          addLink(repoId, topicId);
          added++;
        }

        setStatus('Added ' + added + ' repos for "' + d.label + '". Click another topic to expand.');
        renderGraph();

      } catch (error) {
        setStatus(error.message || 'Failed to expand topic', true);
      }
    }
  }


  // ============================================================
  // MAIN FUNCTION
  // ============================================================

  // Start fresh: clear everything and load repos for a base topic
  async function startExploring() {
    // Reset all data
    nodesById  = {};
    linksArray = [];
    linkSet    = {};

    var baseTopic = topicInput.value.trim() || 'threejs';
    var language  = langInput.value.trim();
    var limit     = Math.max(10, Math.min(100, parseInt(limitInput.value) || 50));

    limitInput.value = String(limit);
    saveCurrentFilters();

    // Add the starting topic as the first node (blue dot in the center)
    addNode('topic:' + baseTopic, { type: 'topic', label: baseTopic });

    try {
      setStatus('Loading repos for topic "' + baseTopic + '"…');
      var repos = await fetchReposByTopic(baseTopic, language, limit);

      var added = 0;
      for (var i = 0; i < repos.length; i++) {
        var repo   = repos[i];
        var repoId = 'repo:' + repo.full_name;
        addNode(repoId, { type: 'repo', label: repo.full_name, url: repo.html_url });
        addLink(repoId, 'topic:' + baseTopic);
        added++;
      }

      setStatus('Loaded ' + added + ' repos for "' + baseTopic + '". Click a blue node to expand it.');
      renderGraph();

    } catch (error) {
      setStatus(error.message || 'Failed to load repos', true);
    }
  }


  // ============================================================
  // WIRE UP THE PAGE
  // ============================================================

  form.addEventListener('submit', function(event) {
    event.preventDefault();
    startExploring();
  });

  clearBtn.addEventListener('click', function() {
    localStorage.removeItem(FILTERS_KEY);
    topicInput.value  = 'threejs';
    langInput.value   = '';
    limitInput.value  = '50';
    startExploring();
  });

  topicInput.addEventListener('input', saveCurrentFilters);
  langInput.addEventListener('change', saveCurrentFilters);
  limitInput.addEventListener('input', saveCurrentFilters);

  restoreSavedFilters();

  // Load on page start
  startExploring();

});  // end DOMContentLoaded
