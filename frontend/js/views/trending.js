/* ============================================
   YouTube Analyzer — Trending View
   ============================================ */
(function () {
  'use strict';

  const REGIONS = [
    { code: 'US', name: 'United States' },
    { code: 'IN', name: 'India' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'JP', name: 'Japan' },
    { code: 'BR', name: 'Brazil' },
    { code: 'AU', name: 'Australia' },
    { code: 'KR', name: 'South Korea' },
  ];

  const CATEGORIES = [
    { id: 0, name: 'All' },
    { id: 10, name: 'Music' },
    { id: 20, name: 'Gaming' },
    { id: 17, name: 'Sports' },
    { id: 24, name: 'Entertainment' },
    { id: 27, name: 'Education' },
    { id: 28, name: 'Science' },
    { id: 23, name: 'Comedy' },
    { id: 25, name: 'News' },
    { id: 26, name: 'How-to' },
  ];

  let currentRegion = 'US';
  let currentCategory = 0;
  let isLoading = false;

  function renderTrending(container) {
    container.innerHTML = `
      <div class="view-section animate-in">
        <div class="section-header" style="margin-bottom:8px;">
          <h2 class="section-title">
            <i data-lucide="trending-up" style="width:24px;height:24px;display:inline;vertical-align:middle;margin-right:8px;color:var(--primary);"></i>
            Trending Videos
          </h2>
        </div>
        <p style="color:var(--text-secondary);font-size:0.9375rem;margin-bottom:20px;">
          Discover what's trending on YouTube across different regions and categories
        </p>

        <div style="margin-bottom:16px;">
          <div class="filter-label" style="margin-bottom:8px;">Region</div>
          <div class="filter-row" id="region-filters">
            ${REGIONS.map(r => `
              <button class="region-pill ${r.code === currentRegion ? 'active' : ''}"
                      data-region="${r.code}"
                      onclick="window.Trending.setRegion('${r.code}')">
                ${r.name}
              </button>
            `).join('')}
          </div>
        </div>

        <div>
          <div class="filter-label" style="margin-bottom:8px;">Category</div>
          <div class="filter-row" id="category-filters">
            ${CATEGORIES.map(c => `
              <button class="category-pill ${c.id === currentCategory ? 'active' : ''}"
                      data-category="${c.id}"
                      onclick="window.Trending.setCategory(${c.id})">
                ${c.name}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div id="trending-results" class="view-section">
        ${window.Loader.createSkeletonGrid(8)}
      </div>
    `;

    initIcons(container);

    // Auto-load trending
    loadTrending();
  }

  function setRegion(regionCode) {
    if (regionCode === currentRegion) return;
    currentRegion = regionCode;

    // Update UI
    document.querySelectorAll('#region-filters .region-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.region === regionCode);
    });

    loadTrending();
  }

  function setCategory(categoryId) {
    categoryId = Number(categoryId);
    if (categoryId === currentCategory) return;
    currentCategory = categoryId;

    // Update UI
    document.querySelectorAll('#category-filters .category-pill').forEach(pill => {
      pill.classList.toggle('active', Number(pill.dataset.category) === categoryId);
    });

    loadTrending();
  }

  async function loadTrending() {
    if (isLoading) return;
    isLoading = true;

    const resultsContainer = document.getElementById('trending-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
      <div class="animate-in">${window.Loader.createSkeletonGrid(8)}</div>
    `;

    try {
      const results = await window.API.getTrending(currentRegion, currentCategory, 25);
      const videos = extractVideos(results);

      if (videos.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state animate-in">
            <div class="empty-state-icon"><i data-lucide="trending-up"></i></div>
            <div class="empty-state-title">No Trending Videos</div>
            <div class="empty-state-text">
              No trending videos found for this region and category combination. Try a different selection.
            </div>
          </div>
        `;
        initIcons(resultsContainer);
        return;
      }

      const regionName = REGIONS.find(r => r.code === currentRegion)?.name || currentRegion;
      const categoryName = CATEGORIES.find(c => c.id === currentCategory)?.name || 'All';

      resultsContainer.innerHTML = `
        <div class="section-header" style="margin-bottom:20px;">
          <div>
            <h3 class="section-title">${videos.length} Trending Videos</h3>
            <span class="section-subtitle">${regionName} · ${categoryName}</span>
          </div>
        </div>
        ${window.VideoCard.createVideoGrid(videos, { showRank: true })}
      `;

      initIcons(resultsContainer);

    } catch (error) {
      console.error('Trending error:', error);
      resultsContainer.innerHTML = `
        <div class="error-state animate-in">
          <div class="error-state-icon"><i data-lucide="alert-circle"></i></div>
          <div class="empty-state-title">Failed to Load Trending</div>
          <div class="empty-state-text">${window.VideoCard.escapeHtml(error.message)}</div>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="window.Trending.loadTrending()">
            <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i> Retry
          </button>
        </div>
      `;
      initIcons(resultsContainer);
      window.Loader.showToast(error.message || 'Failed to load trending', 'error');
    } finally {
      isLoading = false;
    }
  }

  function extractVideos(results) {
    if (!results) return [];
    if (Array.isArray(results)) return results;
    if (results.videos) return results.videos;
    if (results.items) return results.items;
    if (results.results) return results.results;
    return [];
  }

  function initIcons(container) {
    if (window.lucide && container) {
      window.lucide.createIcons({ nodes: [container] });
    }
  }

  // --- Expose globally ---
  window.Trending = {
    renderTrending,
    setRegion,
    setCategory,
    loadTrending,
  };

  window.renderTrending = renderTrending;
})();
