// Minimal, dependency-free SVG Radar (Spider) Chart
// Usage: RadarChart.render(containerSelector, data, options)
(function (global) {
  function createSvg(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  function merge(a, b) {
    var res = {};
    for (var k in a) res[k] = a[k];
    for (var k in b) res[k] = b[k];
    return res;
  }

  function polarToCartesian(cx, cy, radius, angleDeg) {
    var a = (angleDeg - 90) * Math.PI / 180.0;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  function drawPolygon(points, attrs) {
    var p = createSvg('polygon');
    p.setAttribute('points', points.map(function (pt) { return pt.x + ',' + pt.y; }).join(' '));
    for (var k in attrs) p.setAttribute(k, attrs[k]);
    return p;
  }

  function drawLine(x1,y1,x2,y2,attrs){
    var l = createSvg('line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    for (var k in attrs) l.setAttribute(k, attrs[k]);
    return l;
  }

  function RadarChart() {}

  RadarChart.render = function (rootSelector, data, opts) {
    var options = merge({
      size: 360,
      levels: 4,
      maxValue: null,
      // margin reserves space between outermost grid and SVG edge for labels
      margin: 36,
      gridScale: 0.82, // shrink pentagon relative to available radius
      stroke: '#0b6b9a',
      strokeWidth: 2,
      fill: '#0b6b9a',
      fillOpacity: 0.12,
      gridStroke: '#cfcfcf',
      labelColor: '#553d3d',
      labelFontSize: 12
    }, opts || {});

    var root = (typeof rootSelector === 'string') ? document.querySelector(rootSelector) : rootSelector;
    if (!root) return;

    // Clear root
    root.innerHTML = '';

    // Create tooltip (remove any previous tooltip to avoid duplicates on re-render)
    var existingTip = document.querySelector('.radar-tooltip');
    if (existingTip) existingTip.parentNode.removeChild(existingTip);
    var tooltip = document.createElement('div');
    tooltip.className = 'radar-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    var size = options.size;
    var svg = createSvg('svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('radar-svg');

    var cx = size / 2;
    var cy = size / 2;
    var radius = (size / 2) - options.margin; // available outer radius for labels
    var gridRadius = Math.max(10, Math.round(radius * options.gridScale)); // actual pentagon radius

    var keys = data.labels || data.map(function(d){return d.label;});
    if (!Array.isArray(keys)) keys = Object.keys(data);
    var values = data.values || data.map(function(d){return d.value;});

    var N = keys.length;
    var maxVal = options.maxValue || Math.max.apply(null, (data.map?data.map(function(d){return d.value;}):values)) || 1;

    // Draw grid levels
    for (var level = options.levels; level >= 1; level--) {
      var r = gridRadius * (level / options.levels);
      var pts = [];
      for (var i = 0; i < N; i++) {
        var angle = (360 / N) * i;
        pts.push(polarToCartesian(cx, cy, r, angle));
      }
      var poly = drawPolygon(pts, {
        fill: 'none',
        stroke: options.gridStroke,
        'stroke-width': 1
      });
      svg.appendChild(poly);
    }

    // Draw axis lines
    for (var i = 0; i < N; i++) {
      var angle = (360 / N) * i;
      var p = polarToCartesian(cx, cy, gridRadius, angle);
      svg.appendChild(drawLine(cx, cy, p.x, p.y, { stroke: options.gridStroke, 'stroke-width': 1 }));
    }

    // Draw labels (inside the radar area so they remain visible)
    var labelFontSize = options.labelFontSize || Math.max(10, Math.round(size / 32));
    for (var i = 0; i < N; i++) {
      var angle = (360 / N) * i;
      // place labels just outside the pentagon but inside SVG margin
      var labelR = gridRadius + (radius - gridRadius) * 0.95;
      var p = polarToCartesian(cx, cy, labelR, angle);
      var txt = createSvg('text');
      txt.setAttribute('x', p.x);
      txt.setAttribute('y', p.y);
      txt.setAttribute('fill', options.labelColor || '#333');
      txt.setAttribute('font-size', labelFontSize);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.textContent = keys[i];
      svg.appendChild(txt);
    }

    // Draw data polygon
    var pts = [];
    var pointsForHover = [];
    for (var i = 0; i < N; i++) {
      var v = (data[i] && data[i].value != null) ? data[i].value : (values[i] || 0);
      var ratio = Math.max(0, Math.min(1, v / maxVal));
      var angle = (360 / N) * i;
      var p = polarToCartesian(cx, cy, gridRadius * ratio, angle);
      pts.push(p);
      pointsForHover.push({ p: p, label: keys[i], value: v });
    }

    var dataPoly = drawPolygon(pts, {
      fill: options.fill,
      'fill-opacity': options.fillOpacity,
      stroke: options.stroke,
      'stroke-width': options.strokeWidth,
      'stroke-linejoin': 'round'
    });
    svg.appendChild(dataPoly);

    // Draw small vertices and add hover handlers
    pointsForHover.forEach(function(item, i) {
      var c = createSvg('circle');
      c.setAttribute('cx', item.p.x);
      c.setAttribute('cy', item.p.y);
      c.setAttribute('r', Math.max(3, Math.round(size / 90)));
      c.setAttribute('fill', options.stroke);
      c.setAttribute('stroke', '#ffffff');
      c.setAttribute('stroke-width', 1);
      c.style.cursor = 'default';

      c.addEventListener('mouseenter', function (ev) {
        tooltip.style.display = 'block';
        tooltip.textContent = item.label + ': ' + item.value;
        var rect = ev.target.getBoundingClientRect();
        tooltip.style.left = (rect.left + rect.width/2) + 'px';
        tooltip.style.top = (rect.top - 10) + 'px';
      });
      c.addEventListener('mouseleave', function () { tooltip.style.display = 'none'; });

      svg.appendChild(c);
    });

    // Append SVG and make responsive via CSS
    root.appendChild(svg);

    // Resize observer to keep tooltip positioned if container changes
    // (Tooltip is positioned on hover using client rects; nothing else needed)

    return { svg: svg, tooltip: tooltip };
  };

  // Expose
  global.RadarChart = RadarChart;
})(window);
