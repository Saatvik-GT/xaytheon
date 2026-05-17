// ============================================================
// js/explore.js — Interactive GitHub Topic Explorer
//
// Imports setStatus from utils.js so we don't duplicate that helper.
// Everything else (D3 graph, fetch logic) stays in this file because
// it is specific to the Explore page and not reused anywhere else.
// ============================================================

import { setStatus } from './Modules/utils.js';

window.addEventListener('DOMContentLoaded', function() {

  var form = document.getElementById('explore-form');
  if (!form) return;

  var topicInput = document.getElementById('ex-base-topic');
  var langInput  = document.getElementById('ex-language');
  var limitInput = document.getElementById('ex-limit');
  var clearBtn   = document.getElementById('ex-clear');
  var svg        = d3.select('#graph');

  var nodesById  = {};
  var linksArray = [];
  var linkSet    = {};

  // ---- helpers ----

  function status(msg, err) { setStatus('ex-status', msg, err); }

  function addNode(id, data) {
    if (!nodesById[id]) nodesById[id] = { id: id, type: data.type, label: data.label, url: data.url };
  }

  function addLink(sourceId, targetId) {
    var key = sourceId + '->' + targetId;
    if (!linkSet[key]) { linkSet[key] = true; linksArray.push({ source: sourceId, target: targetId }); }
  }

  // ---- data fetching ----

  async function fetchReposByTopic(topic, language, perPage) {
    var count = Math.max(10, Math.min(100, perPage || 50));
    var query = 'topic:' + topic;
    if (language) query += ' language:' + language;

    var response = await fetch(
      'https://api.github.com/search/repositories?q=' + encodeURIComponent(query) + '&sort=stars&order=desc&per_page=' + count,
      { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'XAYTHEON-Explore' } }
    );
    if (!response.ok) throw new Error('GitHub API error: ' + response.status);
    var data = await response.json();
    return data.items || [];
  }

  // ---- graph rendering ----

  function renderGraph() {
    var nodesArray = Object.values(nodesById);
    var w = svg.node().clientWidth;
    var h = svg.node().clientHeight;

    svg.selectAll('*').remove();
    var g = svg.append('g');

    svg.call(d3.zoom().on('zoom', function(event) { g.attr('transform', event.transform); }));

    var linkSelection = g.append('g')
      .attr('stroke', 'rgba(0,0,0,0.2)').attr('stroke-width', 1)
      .selectAll('line').data(linksArray).enter().append('line');

    var nodeSelection = g.append('g')
      .selectAll('circle').data(nodesArray, function(d) { return d.id; }).enter()
      .append('circle')
      .attr('r',    function(d) { return d.type === 'topic' ? 8 : 6; })
      .attr('fill', function(d) { return d.type === 'topic' ? '#0ea5e9' : '#111827'; })
      .attr('stroke', '#fff').attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('click', onNodeClick);

    nodeSelection.append('title').text(function(d) {
      return d.type === 'repo' ? d.label + '\n' + (d.url || '') : d.label;
    });

    var labelSelection = g.append('g')
      .selectAll('text').data(nodesArray, function(d) { return d.id; }).enter()
      .append('text')
      .text(function(d) { return d.type === 'topic' ? d.label : ''; })
      .attr('font-size', 10).attr('fill', '#333');

    d3.forceSimulation(nodesArray)
      .force('charge', d3.forceManyBody().strength(function(d) { return d.type === 'topic' ? -120 : -35; }))
      .force('link',   d3.forceLink(linksArray).id(function(d) { return d.id; }).distance(70).strength(0.8))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collide', d3.forceCollide(10))
      .on('tick', function() {
        linkSelection
          .attr('x1', function(d) { return d.source.x; }).attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; }).attr('y2', function(d) { return d.target.y; });
        g.selectAll('circle').attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; });
        labelSelection.attr('x', function(d) { return d.x + 8; }).attr('y', function(d) { return d.y + 4; });
      });
  }

  // ---- event handlers ----

  async function onNodeClick(event, d) {
    if (d.type === 'repo') { if (d.url) window.open(d.url, '_blank'); return; }
    if (d.type === 'topic') {
      try {
        status('Expanding topic "' + d.label + '"…');
        var repos = await fetchReposByTopic(d.label, langInput.value.trim(), 30);
        repos.forEach(function(repo) {
          var repoId = 'repo:' + repo.full_name;
          addNode(repoId, { type: 'repo', label: repo.full_name, url: repo.html_url });
          addLink(repoId, 'topic:' + d.label);
        });
        status('Added ' + repos.length + ' repos for "' + d.label + '". Click another topic to expand.');
        renderGraph();
      } catch (error) {
        status(error.message || 'Failed to expand topic', true);
      }
    }
  }

  async function startExploring() {
    nodesById  = {};
    linksArray = [];
    linkSet    = {};

    var baseTopic = topicInput.value.trim() || 'threejs';
    var language  = langInput.value.trim();
    var limit     = Math.max(10, Math.min(100, parseInt(limitInput.value) || 50));

    addNode('topic:' + baseTopic, { type: 'topic', label: baseTopic });

    try {
      status('Loading repos for topic "' + baseTopic + '"…');
      var repos = await fetchReposByTopic(baseTopic, language, limit);
      repos.forEach(function(repo) {
        var repoId = 'repo:' + repo.full_name;
        addNode(repoId, { type: 'repo', label: repo.full_name, url: repo.html_url });
        addLink(repoId, 'topic:' + baseTopic);
      });
      status('Loaded ' + repos.length + ' repos for "' + baseTopic + '". Click a blue node to expand it.');
      renderGraph();
    } catch (error) {
      status(error.message || 'Failed to load repos', true);
    }
  }

  // ---- wire up ----

  form.addEventListener('submit', function(e) { e.preventDefault(); startExploring(); });
  clearBtn.addEventListener('click', function() {
    topicInput.value = 'threejs'; langInput.value = ''; limitInput.value = '50';
    startExploring();
  });

  startExploring();
});
