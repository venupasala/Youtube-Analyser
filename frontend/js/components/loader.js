/* ============================================
   YouTube Analyzer — Loading & Toast Components
   ============================================ */
(function () {
  'use strict';

  // --- Skeleton Cards ---
  function createSkeletonCard() {
    return `
      <div class="skeleton-card">
        <div class="skeleton skeleton-thumbnail"></div>
        <div class="skeleton-card-body">
          <div class="skeleton skeleton-text w-75"></div>
          <div class="skeleton skeleton-text w-50"></div>
          <div style="margin-top:12px;">
            <div class="skeleton skeleton-text w-40"></div>
          </div>
        </div>
      </div>
    `;
  }

  function createSkeletonGrid(count = 8) {
    let cards = '';
    for (let i = 0; i < count; i++) {
      cards += createSkeletonCard();
    }
    return `<div class="video-grid">${cards}</div>`;
  }

  function createSkeletonStats(count = 4) {
    let stats = '';
    for (let i = 0; i < count; i++) {
      stats += `
        <div class="skeleton-stat">
          <div class="skeleton skeleton-circle" style="width:48px;height:48px;margin:0 auto 16px;"></div>
          <div class="skeleton skeleton-text w-50" style="margin:0 auto 8px;height:28px;"></div>
          <div class="skeleton skeleton-text w-40" style="margin:0 auto;"></div>
        </div>
      `;
    }
    return `<div class="stats-row">${stats}</div>`;
  }

  function createSkeletonChart() {
    return `
      <div class="skeleton-chart">
        <div class="skeleton skeleton-title" style="width:40%;"></div>
        <div class="skeleton" style="width:100%;height:220px;margin-top:16px;border-radius:var(--radius-sm);"></div>
      </div>
    `;
  }

  function createSkeletonChannelHeader() {
    return `
      <div class="channel-header">
        <div class="skeleton skeleton-circle" style="width:80px;height:80px;flex-shrink:0;"></div>
        <div class="channel-info" style="flex:1;">
          <div class="skeleton skeleton-title" style="width:200px;"></div>
          <div class="skeleton skeleton-text w-30" style="margin-top:4px;"></div>
          <div class="skeleton skeleton-text w-75" style="margin-top:12px;"></div>
        </div>
      </div>
    `;
  }

  // --- Toast Notifications ---
  let toastCounter = 0;

  function getToastIcon(type) {
    const icons = {
      success: '<i data-lucide="check-circle"></i>',
      error: '<i data-lucide="alert-circle"></i>',
      warning: '<i data-lucide="alert-triangle"></i>',
      info: '<i data-lucide="info"></i>',
    };
    return icons[type] || icons.info;
  }

  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + (++toastCounter);
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.id = id;
    toast.innerHTML = `
      <span class="toast-icon">${getToastIcon(type)}</span>
      <div class="toast-content">
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="window.Loader.dismissToast('${id}')" aria-label="Close">
        <i data-lucide="x"></i>
      </button>
    `;

    container.appendChild(toast);

    // Initialize lucide icons inside the toast
    if (window.lucide) {
      window.lucide.createIcons({ nodes: [toast] });
    }

    // Auto-dismiss
    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);

    toast._timer = timer;
  }

  function dismissToast(id) {
    const toast = document.getElementById(id);
    if (!toast) return;
    if (toast._timer) clearTimeout(toast._timer);
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Loading Spinner ---
  function showLoading(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;
    container.innerHTML = `
      <div class="loading-spinner-container">
        <div class="loading-spinner"></div>
      </div>
    `;
  }

  function hideLoading(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;
    const spinner = container.querySelector('.loading-spinner-container');
    if (spinner) spinner.remove();
  }

  // --- Expose globally ---
  window.Loader = {
    createSkeletonCard,
    createSkeletonGrid,
    createSkeletonStats,
    createSkeletonChart,
    createSkeletonChannelHeader,
    showToast,
    dismissToast,
    showLoading,
    hideLoading,
  };
})();
