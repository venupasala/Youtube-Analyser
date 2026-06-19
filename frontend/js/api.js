/* ============================================
   YouTube Analyzer — API Client
   ============================================ */
(function () {
  'use strict';

  const API_BASE = '/api';

  // --- In-memory cache with TTL ---
  const cache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCacheKey(url, options) {
    return url + (options && options.body ? '|' + options.body : '');
  }

  function getFromCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
      return null;
    }
    return entry.data;
  }

  function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
    // Prune old entries if cache gets large
    if (cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (now - v.timestamp > CACHE_TTL) cache.delete(k);
      }
    }
  }

  function clearCache() {
    cache.clear();
  }

  // --- Fetch wrapper ---
  async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const cacheKey = getCacheKey(url, options);

    // Only cache GET requests
    if (!options.method || options.method === 'GET') {
      const cached = getFromCache(cacheKey);
      if (cached) return cached;
    }

    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    // Remove Content-Type for GET requests without body
    if ((!config.method || config.method === 'GET') && !config.body) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.detail || errorBody.message || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Cache GET responses
      if (!options.method || options.method === 'GET') {
        setCache(cacheKey, data);
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to the server. Please check your connection.');
      }
      throw error;
    }
  }

  // --- Build query string ---
  function qs(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  }

  // --- API Methods ---

  async function analyzeChannel(query) {
    return apiRequest('/channel/analyze', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async function getChannelVideos(channelId, page = 1, perPage = 20) {
    return apiRequest(`/channel/${encodeURIComponent(channelId)}/videos${qs({ page, per_page: perPage })}`);
  }

  async function getChannelAnalytics(channelId) {
    return apiRequest(`/channel/${encodeURIComponent(channelId)}/analytics`);
  }

  async function searchText(query, page = 1, perPage = 20) {
    return apiRequest(`/search/text${qs({ q: query, page, per_page: perPage })}`);
  }

  async function searchSemantic(query, nResults = 20) {
    return apiRequest(`/search/semantic${qs({ q: query, n_results: nResults })}`);
  }

  async function searchYouTube(query, maxResults = 20) {
    return apiRequest(`/search/youtube${qs({ q: query, max_results: maxResults })}`);
  }

  async function findSimilar(videoId) {
    return apiRequest(`/search/similar/${encodeURIComponent(videoId)}`);
  }

  async function getTrending(region = 'US', categoryId = 0, maxResults = 25) {
    return apiRequest(`/trending${qs({ region, category_id: categoryId, max_results: maxResults })}`);
  }

  async function getRegions() {
    return apiRequest('/trending/regions');
  }

  async function getHealth() {
    return apiRequest('/health');
  }

  // --- Expose globally ---
  window.API = {
    analyzeChannel,
    getChannelVideos,
    getChannelAnalytics,
    searchText,
    searchSemantic,
    searchYouTube,
    findSimilar,
    getTrending,
    getRegions,
    getHealth,
    clearCache,
  };
})();
