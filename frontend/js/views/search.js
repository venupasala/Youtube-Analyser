/* ============================================
   YouTube Analyzer — Search View
   ============================================ */
(function () {
  'use strict';

  let currentTab = 'text'; // 'text' | 'semantic' | 'youtube'
  let lastQuery = '';

  function renderSearch(container) {
    container.innerHTML = `
      <div class="page-hero page-hero-compact animate-in">
        <div class="page-hero-glow accent-purple"></div>
        <div class="page-hero-content">
          <div class="page-hero-badge"><i data-lucide="sparkles"></i> Multi-mode search</div>
          <h1 class="page-hero-title">Search Videos</h1>
          <p class="page-hero-subtitle">
            Full-text, semantic AI, or live YouTube search — find exactly what you need.
          </p>
        </div>
      </div>

      <div class="search-panel animate-in animate-in-delay-1">
        <div class="tab-bar">
          <button class="tab ${currentTab === 'text' ? 'active' : ''}" data-tab="text" onclick="window.Search.switchTab('text')">
            <i data-lucide="file-text"></i>
            Full-Text
          </button>
          <button class="tab ${currentTab === 'semantic' ? 'active' : ''}" data-tab="semantic" onclick="window.Search.switchTab('semantic')">
            <i data-lucide="brain"></i>
            Semantic
          </button>
          <button class="tab ${currentTab === 'youtube' ? 'active' : ''}" data-tab="youtube" onclick="window.Search.switchTab('youtube')">
            <i data-lucide="youtube"></i>
            YouTube
          </button>
        </div>

        <div class="large-search-wrapper">
          <i data-lucide="search" class="search-icon-lg"></i>
          <input type="text"
                 id="search-view-input"
                 class="search-input-lg"
                 placeholder="${getPlaceholder()}"
                 value="${window.VideoCard.escapeHtml(lastQuery)}"
                 onkeydown="if(event.key==='Enter')window.Search.doSearch()">
          <button class="search-submit-btn" onclick="window.Search.doSearch()">
            <i data-lucide="arrow-right"></i>
          </button>
        </div>
      </div>

      <div id="search-results"></div>
    `;

    initIcons(container);

    // Focus the search input
    setTimeout(() => {
      const input = document.getElementById('search-view-input');
      if (input) input.focus();
    }, 100);
  }

  function getPlaceholder() {
    const placeholders = {
      text: 'Search by title, description, or tags...',
      semantic: 'Describe the kind of video you\'re looking for...',
      youtube: 'Search YouTube for new videos...',
    };
    return placeholders[currentTab] || placeholders.text;
  }

  function switchTab(tab) {
    currentTab = tab;
    // Update tab buttons
    document.querySelectorAll('.tab-bar .tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    // Update placeholder
    const input = document.getElementById('search-view-input');
    if (input) {
      input.placeholder = getPlaceholder();
      input.focus();
    }
  }

  async function doSearch() {
    const input = document.getElementById('search-view-input');
    const query = input ? input.value.trim() : '';
    if (!query) {
      window.Loader.showToast('Please enter a search query', 'warning');
      return;
    }

    lastQuery = query;
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    // Show loading skeleton
    resultsContainer.innerHTML = `
      <div class="animate-in">${window.Loader.createSkeletonGrid(8)}</div>
    `;

    try {
      let results;
      let source;

      switch (currentTab) {
        case 'text':
          results = await window.API.searchText(query, 1, 20);
          source = 'es';
          break;
        case 'semantic':
          results = await window.API.searchSemantic(query, 20);
          source = 'vector';
          break;
        case 'youtube':
          results = await window.API.searchYouTube(query, 20);
          source = 'youtube';
          break;
      }

      const videos = extractVideos(results);

      if (videos.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state animate-in">
            <div class="empty-state-icon"><i data-lucide="search-x"></i></div>
            <div class="empty-state-title">No Results Found</div>
            <div class="empty-state-text">
              No videos matched "<strong>${window.VideoCard.escapeHtml(query)}</strong>" in ${getTabName()} search.
              Try a different query or switch search modes.
            </div>
          </div>
        `;
        initIcons(resultsContainer);
        return;
      }

      resultsContainer.innerHTML = `
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h3 class="section-title">${videos.length} Results</h3>
            <span class="section-subtitle">via ${getTabName()} search</span>
          </div>
        </div>
        ${window.VideoCard.createVideoGrid(videos, { source, showSimilarBtn: true })}
      `;

      initIcons(resultsContainer);
      window.Loader.showToast(`Found ${videos.length} videos`, 'success');

    } catch (error) {
      console.error('Search error:', error);
      resultsContainer.innerHTML = `
        <div class="error-state animate-in">
          <div class="error-state-icon"><i data-lucide="alert-circle"></i></div>
          <div class="empty-state-title">Search Failed</div>
          <div class="empty-state-text">${window.VideoCard.escapeHtml(error.message)}</div>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="window.Search.doSearch()">
            <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i> Retry
          </button>
        </div>
      `;
      initIcons(resultsContainer);
      window.Loader.showToast(error.message || 'Search failed', 'error');
    }
  }

  // --- Find similar videos ---
  async function searchForSimilar(videoId, title) {
    // Switch to semantic tab
    currentTab = 'semantic';

    // Re-render the search view with the search active
    const container = document.getElementById('app-content');
    if (container) {
      renderSearch(container);
    }

    const input = document.getElementById('search-view-input');
    if (input) {
      input.value = `Similar to: ${title || videoId}`;
    }

    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="animate-in">${window.Loader.createSkeletonGrid(8)}</div>
    `;

    try {
      const results = await window.API.findSimilar(videoId);
      const videos = extractVideos(results);

      if (videos.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state animate-in">
            <div class="empty-state-icon"><i data-lucide="search-x"></i></div>
            <div class="empty-state-title">No Similar Videos Found</div>
            <div class="empty-state-text">We couldn't find videos similar to this one.</div>
          </div>
        `;
        initIcons(resultsContainer);
        return;
      }

      resultsContainer.innerHTML = `
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h3 class="section-title">${videos.length} Similar Videos</h3>
            <span class="section-subtitle">based on semantic similarity</span>
          </div>
        </div>
        ${window.VideoCard.createVideoGrid(videos, { source: 'vector', showSimilarBtn: true })}
      `;

      initIcons(resultsContainer);
      window.Loader.showToast(`Found ${videos.length} similar videos`, 'success');

    } catch (error) {
      console.error('Similar search error:', error);
      resultsContainer.innerHTML = `
        <div class="error-state animate-in">
          <div class="error-state-icon"><i data-lucide="alert-circle"></i></div>
          <div class="empty-state-title">Search Failed</div>
          <div class="empty-state-text">${window.VideoCard.escapeHtml(error.message)}</div>
        </div>
      `;
      initIcons(resultsContainer);
      window.Loader.showToast(error.message || 'Similar search failed', 'error');
    }
  }

  // --- Extract videos from various response shapes ---
  function extractVideos(results) {
    if (!results) return [];
    if (Array.isArray(results)) return results;
    if (results.videos) return results.videos;
    if (results.results) return results.results;
    if (results.items) return results.items;
    return [];
  }

  function getTabName() {
    const names = { text: 'Full-Text', semantic: 'Semantic', youtube: 'YouTube' };
    return names[currentTab] || 'Search';
  }

  function initIcons(container) {
    if (window.lucide && container) {
      window.lucide.createIcons({ nodes: [container] });
    }
  }

  // Global handler for "Find Similar" from video cards
  window._searchForSimilar = searchForSimilar;

  // --- Expose globally ---
  window.Search = {
    renderSearch,
    switchTab,
    doSearch,
    searchForSimilar,
  };

  window.renderSearch = renderSearch;
})();
