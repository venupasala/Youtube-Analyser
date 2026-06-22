/* ============================================
   YouTube Analyzer — Chart.js Helpers
   ============================================ */
(function () {
  'use strict';

  const COLORS = [
    '#ff2d55', '#7c3aed', '#10b981', '#f59e0b',
    '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
  ];

  // Store chart instances for cleanup
  const chartInstances = {};

  // --- Dark theme defaults ---
  function getDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1500,
        easing: 'easeOutQuart',
      },
      plugins: {
        legend: {
          labels: {
            color: '#8b8b9e',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 500 },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(18, 18, 26, 0.95)',
          titleColor: '#f0f0f5',
          bodyColor: '#8b8b9e',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 13, weight: 600 },
          bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          displayColors: true,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#5a5a6e',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
          },
          border: { display: false },
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false,
          },
          ticks: {
            color: '#5a5a6e',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
            callback: function (value) {
              return window.VideoCard ? window.VideoCard.formatNumber(value) : value;
            },
          },
          border: { display: false },
        },
      },
    };
  }

  // --- Destroy a chart instance ---
  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  // --- Create gradient fill ---
  function createGradient(ctx, color, alpha1 = 0.3, alpha2 = 0.01) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, hexToRgba(color, alpha1));
    gradient.addColorStop(1, hexToRgba(color, alpha2));
    return gradient;
  }

  function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // --- Line Chart ---
  function createLineChart(canvasId, labels, datasets, options = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const defaults = getDefaults();
    const chartDatasets = datasets.map((ds, i) => {
      const color = ds.color || COLORS[i % COLORS.length];
      return {
        label: ds.label || `Dataset ${i + 1}`,
        data: ds.data,
        borderColor: color,
        backgroundColor: createGradient(ctx, color),
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#12121a',
        pointHoverBorderWidth: 2,
        ...ds,
      };
    });

    const chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: chartDatasets },
      options: {
        ...defaults,
        ...options,
        plugins: {
          ...defaults.plugins,
          ...(options.plugins || {}),
        },
        scales: {
          ...defaults.scales,
          ...(options.scales || {}),
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      },
    });

    chartInstances[canvasId] = chart;
    return chart;
  }

  // --- Bar Chart ---
  function createBarChart(canvasId, labels, data, options = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const defaults = getDefaults();
    const colors = data.map((_, i) => COLORS[i % COLORS.length]);

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: options.dataLabel || 'Value',
          data,
          backgroundColor: colors.map(c => hexToRgba(c, 0.7)),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 50,
        }],
      },
      options: {
        ...defaults,
        ...options,
        plugins: {
          ...defaults.plugins,
          legend: { display: false },
          ...(options.plugins || {}),
        },
        scales: {
          ...defaults.scales,
          ...(options.scales || {}),
        },
      },
    });

    chartInstances[canvasId] = chart;
    return chart;
  }

  // --- Horizontal Bar Chart ---
  function createHorizontalBarChart(canvasId, labels, data, options = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const defaults = getDefaults();
    const colors = data.map((_, i) => COLORS[i % COLORS.length]);

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: options.dataLabel || 'Views',
          data,
          backgroundColor: colors.map(c => hexToRgba(c, 0.7)),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...defaults,
        indexAxis: 'y',
        ...options,
        plugins: {
          ...defaults.plugins,
          legend: { display: false },
          ...(options.plugins || {}),
        },
        scales: {
          x: {
            ...defaults.scales.x,
            ...(options.scales && options.scales.x || {}),
          },
          y: {
            ...defaults.scales.y,
            ticks: {
              ...defaults.scales.y.ticks,
              callback: function (value) {
                const label = this.getLabelForValue(value);
                return label.length > 30 ? label.substring(0, 30) + '…' : label;
              },
            },
            ...(options.scales && options.scales.y || {}),
          },
        },
      },
    });

    chartInstances[canvasId] = chart;
    return chart;
  }

  // --- Doughnut Chart ---
  function createDoughnutChart(canvasId, labels, data, options = {}) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');

    const colors = labels.map((_, i) => COLORS[i % COLORS.length]);

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => hexToRgba(c, 0.7)),
          borderColor: colors.map(c => hexToRgba(c, 1)),
          borderWidth: 1,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1500, easing: 'easeOutQuart' },
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8b8b9e',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 500 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: getDefaults().plugins.tooltip,
          ...(options.plugins || {}),
        },
      },
    });

    chartInstances[canvasId] = chart;
    return chart;
  }

  // --- Destroy all charts ---
  function destroyAll() {
    Object.keys(chartInstances).forEach(destroyChart);
  }

  // --- Expose globally ---
  window.Charts = {
    createLineChart,
    createBarChart,
    createHorizontalBarChart,
    createDoughnutChart,
    destroyChart,
    destroyAll,
    COLORS,
    hexToRgba,
  };
})();
