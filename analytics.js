// ============================================================
// analytics.js - Historical Growth Tracking & Visualizations
// ============================================================

window.addEventListener('DOMContentLoaded', function() {
  var growthCtx = document.getElementById('growthChart');
  var commitCtx = document.getElementById('commitChart');
  var langCtx   = document.getElementById('langChart');
  
  if (!growthCtx || !commitCtx || !langCtx) return;

  var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  // --- Generation of Mock Snapshots for Growth & Commit Metrics ---
  function generateAnalyticsData(days) {
    var labels = [];
    var stars = [];
    var followers = [];
    var commits = [];
    
    var baseStars = 142;
    var baseFollowers = 87;

    for (var i = days; i >= 0; i--) {
      var d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      
      baseStars += Math.floor(Math.random() * 4);
      baseFollowers += Math.floor(Math.random() * 2);
      
      stars.push(baseStars);
      followers.push(baseFollowers);
      commits.push(Math.floor(Math.random() * 12));
    }

    return {
      labels: labels,
      stars: stars,
      followers: followers,
      commits: commits
    };
  }

  var activeDays = 30;
  var data = generateAnalyticsData(activeDays);

  // --- Chart.js Configurations ---
  var getChartColors = function(theme) {
    var isDark = theme === 'dark';
    return {
      text: isDark ? '#ffffff' : '#000000',
      grid: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
      primary: '#0ea5e9',
      secondary: '#f59e0b',
      accent: '#10b981'
    };
  };

  var colors = getChartColors(currentTheme);

  // 1. Line Chart: Stars & Followers Trajectory
  var growthChart = new Chart(growthCtx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'GitHub Stars',
          data: data.stars,
          borderColor: colors.primary,
          backgroundColor: 'rgba(14, 165, 233, 0.15)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Followers Growth',
          data: data.followers,
          borderColor: colors.secondary,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: colors.text, font: { family: 'inherit' } } }
      },
      scales: {
        x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
        y: { grid: { color: colors.grid }, ticks: { color: colors.text } }
      }
    }
  });

  // 2. Bar Chart: Commit Frequency
  var commitChart = new Chart(commitCtx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Commits per Day',
        data: data.commits,
        backgroundColor: colors.accent,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: colors.text, font: { family: 'inherit' } } }
      },
      scales: {
        x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
        y: { grid: { color: colors.grid }, ticks: { color: colors.text } }
      }
    }
  });

  // 3. Doughnut Chart: Languages distribution
  var langChart = new Chart(langCtx, {
    type: 'doughnut',
    data: {
      labels: ['JavaScript', 'TypeScript', 'Python', 'CSS', 'HTML'],
      datasets: [{
        data: [42, 28, 15, 10, 5],
        backgroundColor: ['#f1e05a', '#3178c6', '#3572a5', '#563d7c', '#e34c26'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: colors.text, font: { family: 'inherit' } } }
      }
    }
  });

  // --- Dynamic Theme Syncing ---
  window.updateChartsTheme = function(theme) {
    var newColors = getChartColors(theme);
    
    growthChart.options.plugins.legend.labels.color = newColors.text;
    growthChart.options.scales.x.grid.color = newColors.grid;
    growthChart.options.scales.x.ticks.color = newColors.text;
    growthChart.options.scales.y.grid.color = newColors.grid;
    growthChart.options.scales.y.ticks.color = newColors.text;
    growthChart.update();

    commitChart.options.plugins.legend.labels.color = newColors.text;
    commitChart.options.scales.x.grid.color = newColors.grid;
    commitChart.options.scales.x.ticks.color = newColors.text;
    commitChart.options.scales.y.grid.color = newColors.grid;
    commitChart.options.scales.y.ticks.color = newColors.text;
    commitChart.update();

    langChart.options.plugins.legend.labels.color = newColors.text;
    langChart.update();
  };

  // --- Range Selection Filter ---
  document.querySelectorAll('.range-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.range-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var days = parseInt(btn.getAttribute('data-days')) || 30;
      var newData = generateAnalyticsData(days);

      // Update trajectory
      growthChart.data.labels = newData.labels;
      growthChart.data.datasets[0].data = newData.stars;
      growthChart.data.datasets[1].data = newData.followers;
      growthChart.update();

      // Update commits
      commitChart.data.labels = newData.labels;
      commitChart.data.datasets[0].data = newData.commits;
      commitChart.update();
    });
  });

  // --- Exporters (JSON & CSV downloading handlers) ---
  document.getElementById('export-json-btn').addEventListener('click', function() {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generateAnalyticsData(30)));
    var dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     dataStr);
    dlAnchorElem.setAttribute("download", "xaytheon_analytics_snapshot.json");
    dlAnchorElem.click();
  });

  document.getElementById('export-csv-btn').addEventListener('click', function() {
    var csvContent = "data:text/csv;charset=utf-8,Date,Stars,Followers,Commits\n";
    var currentData = generateAnalyticsData(30);
    for (var i = 0; i < currentData.labels.length; i++) {
      csvContent += currentData.labels[i] + "," + currentData.stars[i] + "," + currentData.followers[i] + "," + currentData.commits[i] + "\n";
    }
    var dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href",     encodeURI(csvContent));
    dlAnchorElem.setAttribute("download", "xaytheon_analytics_snapshot.csv");
    dlAnchorElem.click();
  });
});
