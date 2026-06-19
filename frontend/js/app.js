/* ============================================
   YouTube Analyzer — Main App Controller
   ============================================ */
(function () {
  'use strict';

  // --- State ---
  let currentRoute = '';
  let currentChannel = null;

  // --- Routes ---
  const ROUTES = {
    '': 'dashboard',
    '#dashboard': 'dashboard',
    '#search': 'search',
    '#trending': 'trending',
  };

  // --- Initialize ---
  function init() {
    setupNavigation();
    setupGlobalSearch();
    handleRouteChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleRouteChange);

    // Initialize Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Setup mobile menu
    setupMobileMenu();

    console.log('🎬 YouTube Analyzer initialized');
  }

  // --- Route handling ---
  function handleRouteChange() {
    const hash = window.location.hash || '';
    const route = ROUTES[hash] || 'dashboard';

    if (route === currentRoute && route !== 'dashboard') return;
    currentRoute = route;

    updateActiveNav(hash || '#dashboard');
    renderView(route);
  }

  function renderView(route) {
    const container = document.getElementById('app-content');
    if (!container) return;

    // Destroy old charts
    if (window.Charts) window.Charts.destroyAll();

    // Fade out, then render, then fade in
    container.style.opacity = '0';
    container.style.transform = 'translateY(8px)';

    setTimeout(() => {
      container.innerHTML = '';

      switch (route) {
        case 'dashboard':
          if (window.renderDashboard) window.renderDashboard(container);
          break;
        case 'search':
          if (window.renderSearch) window.renderSearch(container);
          break;
        case 'trending':
          if (window.renderTrending) window.renderTrending(container);
          break;
        default:
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon"><i data-lucide="compass"></i></div>
              <div class="empty-state-title">Page Not Found</div>
              <div class="empty-state-text">The page you're looking for doesn't exist.</div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      }

      // Fade in
      requestAnimationFrame(() => {
        container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
      });
    }, 150);
  }

  // --- Navigation ---
  function setupNavigation() {
    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const route = item.dataset.route;
        window.location.hash = route;
        closeMobileMenu();
      });
    });
  }

  function updateActiveNav(hash) {
    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      const isActive = item.dataset.route === hash ||
                       (hash === '' && item.dataset.route === '#dashboard');
      item.classList.toggle('active', isActive);
    });
  }

  // --- Global search (top bar) ---
  function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          analyzeChannel(query);
        }
      }
    });
  }

  // --- Analyze channel ---
  async function analyzeChannel(query) {
    if (!query) return;

    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = query;

    // Navigate to dashboard
    window.location.hash = '#dashboard';

    const container = document.getElementById('app-content');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="view-section animate-in">${window.Loader.createSkeletonChannelHeader()}</div>
      <div class="view-section animate-in animate-in-delay-1">${window.Loader.createSkeletonStats(4)}</div>
      <div class="view-section animate-in animate-in-delay-2">
        <div class="chart-grid">
          ${window.Loader.createSkeletonChart()}
          ${window.Loader.createSkeletonChart()}
          ${window.Loader.createSkeletonChart()}
          ${window.Loader.createSkeletonChart()}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons({ nodes: [container] });

    try {
      window.Loader.showToast(`Analyzing channel: ${query}`, 'info');
      const data = await window.API.analyzeChannel(query);
      currentChannel = data;
      window.Loader.showToast('Channel analyzed successfully!', 'success');

      // Re-render dashboard with data
      if (window.renderDashboard) {
        window.renderDashboard(container);
      }
    } catch (error) {
      console.error('Channel analysis error:', error);
      currentChannel = null;

      container.innerHTML = `
        <div class="error-state animate-in">
          <div class="error-state-icon"><i data-lucide="alert-circle"></i></div>
          <div class="empty-state-title">Analysis Failed</div>
          <div class="empty-state-text">${window.VideoCard.escapeHtml(error.message)}</div>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="window.App.analyzeChannel('${window.VideoCard.escapeHtml(query).replace(/'/g, "\\'")}')">
            <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i> Retry
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ nodes: [container] });
      window.Loader.showToast(error.message || 'Failed to analyze channel', 'error');
    }
  }

  // --- Mobile menu ---
  function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', closeMobileMenu);
    }
  }

  function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  // --- Expose globally ---
  window.App = {
    get currentChannel() { return currentChannel; },
    set currentChannel(val) { currentChannel = val; },
    analyzeChannel,
    handleRouteChange,
  };

  // --- Boot ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
