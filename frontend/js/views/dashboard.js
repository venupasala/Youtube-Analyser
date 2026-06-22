/* ============================================
   YouTube Analyzer — Dashboard View
   ============================================ */
(function () {
  'use strict';

  // --- Animated count-up ---
  function animateCountUp(element, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      element.textContent = window.VideoCard.formatNumber(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = window.VideoCard.formatNumber(target);
      }
    }

    requestAnimationFrame(update);
  }

  // --- Welcome screen ---
  function renderWelcome(container) {
    container.innerHTML = `
      <div class="page-hero animate-in">
        <div class="page-hero-glow"></div>
        <div class="page-hero-content">
          <div class="welcome-icon">
            <i data-lucide="bar-chart-3" style="width:32px;height:32px;color:white;"></i>
          </div>
          <h1 class="page-hero-title">YouTube Channel Analytics</h1>
          <p class="page-hero-subtitle">
            Deep insights into any channel — subscribers, engagement, upload patterns, and video performance in one dashboard.
          </p>
        </div>
      </div>

      <div class="feature-grid animate-in animate-in-delay-1">
        <div class="feature-card">
          <div class="feature-icon"><i data-lucide="users"></i></div>
          <h3>Channel Metrics</h3>
          <p>Subscribers, total views, video count, and engagement rate at a glance.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon accent-purple"><i data-lucide="line-chart"></i></div>
          <h3>Visual Analytics</h3>
          <p>Interactive charts for views, uploads, top videos, and category breakdown.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon accent-green"><i data-lucide="search"></i></div>
          <h3>Smart Search</h3>
          <p>Full-text and AI semantic search across indexed channel videos.</p>
        </div>
      </div>

      <div class="welcome-container animate-in animate-in-delay-2">
        <p class="welcome-hint">Try a popular channel</p>
        <div class="suggested-channels">
          <button class="suggested-channel" onclick="window.Dashboard.analyzeFromSuggestion('@mkbhd')">@mkbhd</button>
          <button class="suggested-channel" onclick="window.Dashboard.analyzeFromSuggestion('@veritasium')">@veritasium</button>
          <button class="suggested-channel" onclick="window.Dashboard.analyzeFromSuggestion('@fireship')">@fireship</button>
          <button class="suggested-channel" onclick="window.Dashboard.analyzeFromSuggestion('@3blue1brown')">@3blue1brown</button>
          <button class="suggested-channel" onclick="window.Dashboard.analyzeFromSuggestion('@NetworkChuck')">@NetworkChuck</button>
        </div>
      </div>
    `;
    initIcons(container);
  }

  // --- Main render ---
  function renderDashboard(container) {
    const channelData = window.App && window.App.currentChannel;
    if (!channelData) {
      renderWelcome(container);
      return;
    }
    renderChannelDashboard(container, channelData);
  }

  // --- Render full dashboard for a channel ---
  async function renderChannelDashboard(container, channelData) {
    const channel = channelData.channel || channelData;
    const channelId = channel.channel_id || channel.id;

    // Show skeleton while loading
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
      <div class="view-section animate-in animate-in-delay-3">${window.Loader.createSkeletonGrid(4)}</div>
    `;
    initIcons(container);

    // Load analytics and videos in parallel
    let analytics = null;
    let videos = null;

    try {
      const [analyticsRes, videosRes] = await Promise.allSettled([
        window.API.getChannelAnalytics(channelId),
        window.API.getChannelVideos(channelId, 1, 12),
      ]);

      if (analyticsRes.status === 'fulfilled') analytics = analyticsRes.value;
      if (videosRes.status === 'fulfilled') videos = videosRes.value;
    } catch (err) {
      // handled per-section below
    }

    // Build the dashboard
    const videoList = videos?.videos || videos?.items || (Array.isArray(videos) ? videos : []);
    const chartConfigs = buildChartConfigs(analytics, videoList);
    const chartsHtml = chartConfigs.length > 0
      ? `
      <div class="view-section animate-in animate-in-delay-2">
        <div class="section-header">
          <h2 class="section-title">Analytics</h2>
          <span class="section-subtitle">${chartConfigs.length} chart${chartConfigs.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="chart-grid">
          ${chartConfigs.map(c => `
            <div class="chart-container">
              <div class="chart-title">${c.title}</div>
              <div class="chart-wrapper"><canvas id="${c.id}"></canvas></div>
            </div>
          `).join('')}
        </div>
      </div>`
      : '';

    container.innerHTML = `
      <div class="view-section animate-in">
        ${renderChannelHeader(channel)}
      </div>
      <div class="view-section animate-in animate-in-delay-1">
        ${renderStatsRow(channel, analytics)}
      </div>
      ${chartsHtml}
      <div class="view-section animate-in animate-in-delay-3">
        <div class="section-header">
          <h2 class="section-title">Recent Videos</h2>
          <span class="section-subtitle">${videoList.length} videos shown</span>
        </div>
        ${window.VideoCard.createVideoGrid(videoList)}
      </div>
    `;

    initIcons(container);

    // Animate stat numbers
    requestAnimationFrame(() => {
      container.querySelectorAll('.stat-value[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target) || 0;
        animateCountUp(el, target);
      });
    });

    // Render charts (only those with data)
    renderCharts(chartConfigs);
  }

  // --- Channel Header ---
  function renderChannelHeader(channel) {
    const avatar = channel.avatar_url || channel.thumbnail_url || channel.thumbnail || '';
    const name = window.VideoCard.escapeHtml(channel.title || channel.name || '');
    const handle = window.VideoCard.escapeHtml(channel.custom_url || channel.handle || '');
    const desc = window.VideoCard.escapeHtml(channel.description || '');
    const country = channel.country || '';
    const joinDate = channel.published_at || channel.created_at || '';

    return `
      <div class="channel-header">
        <img class="channel-avatar" src="${window.VideoCard.escapeHtml(avatar)}" alt="${name}"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect fill=%22%2312121a%22 width=%2280%22 height=%2280%22 rx=%2240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23ff2d55%22 text-anchor=%22middle%22 dy=%22.35em%22 font-size=%2224%22 font-family=%22sans-serif%22%3EYT%3C/text%3E%3C/svg%3E'">
        <div class="channel-info">
          <div class="channel-name">${name}</div>
          ${handle ? `<div class="channel-handle">${handle}</div>` : ''}
          ${desc ? `<div class="channel-description">${desc}</div>` : ''}
          <div class="channel-badges">
            ${country ? `<span class="badge badge-secondary"><i data-lucide="globe" style="width:12px;height:12px;"></i> ${window.VideoCard.escapeHtml(country)}</span>` : ''}
            ${joinDate ? `<span class="badge badge-primary"><i data-lucide="calendar" style="width:12px;height:12px;"></i> Joined ${window.VideoCard.timeAgo(joinDate)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // --- Stats Row ---
  function renderStatsRow(channel, analytics) {
    const subs = channel.subscriber_count ?? channel.subscribers ?? 0;
    const views = channel.view_count ?? channel.total_views ?? channel.views ?? 0;
    const videoCount = channel.video_count ?? channel.videos ?? 0;

    // Calculate engagement rate from analytics (already a percentage from API)
    let engagementDisplay = '—';
    if (analytics && analytics.engagement_rate != null) {
      engagementDisplay = Number(analytics.engagement_rate).toFixed(2) + '%';
    } else if (analytics && analytics.avg_engagement_rate != null) {
      const rate = analytics.avg_engagement_rate;
      engagementDisplay = (rate <= 1 ? rate * 100 : rate).toFixed(2) + '%';
    }

    return `
      <div class="stats-row stagger-in">
        <div class="stat-card">
          <div class="stat-icon"><i data-lucide="users" style="width:22px;height:22px;"></i></div>
          <div class="stat-value" data-target="${subs}">0</div>
          <div class="stat-label">Subscribers</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon secondary"><i data-lucide="eye" style="width:22px;height:22px;"></i></div>
          <div class="stat-value" data-target="${views}">0</div>
          <div class="stat-label">Total Views</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon success"><i data-lucide="video" style="width:22px;height:22px;"></i></div>
          <div class="stat-value" data-target="${videoCount}">0</div>
          <div class="stat-label">Videos</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon warning"><i data-lucide="trending-up" style="width:22px;height:22px;"></i></div>
          <div class="stat-value">${engagementDisplay}</div>
          <div class="stat-label">Engagement Rate</div>
        </div>
      </div>
    `;
  }

  // --- Chart data helpers ---
  function extractLabelsData(obj) {
    if (!obj) return null;
    if (obj.labels && Array.isArray(obj.data) && obj.labels.length > 0) {
      return { labels: obj.labels, data: obj.data };
    }
    if (Array.isArray(obj) && obj.length > 0) {
      return {
        labels: obj.map(t => t.date || t.label || ''),
        data: obj.map(t => t.views || t.value || 0),
      };
    }
    if (typeof obj === 'object' && !obj.labels) {
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        return { labels: keys, data: Object.values(obj) };
      }
    }
    return null;
  }

  function hasValidChartData(labels, data) {
    return labels && labels.length > 0 && data && data.some(v => Number(v) > 0);
  }

  function buildChartConfigs(analytics, videos) {
    const configs = [];
    const videoList = videos || [];

    // Views timeline
    let timeline = extractLabelsData(analytics?.views_timeline);
    if (!timeline && videoList.length > 0) {
      const sorted = [...videoList].sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0));
      timeline = {
        labels: sorted.map(v => {
          const d = new Date(v.published_at);
          return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }),
        data: sorted.map(v => v.view_count || v.views || 0),
      };
    }
    if (timeline && hasValidChartData(timeline.labels, timeline.data)) {
      configs.push({ id: 'chart-views-timeline', title: 'Views Timeline', type: 'line', ...timeline });
    }

    // Top videos
    if (videoList.length > 0) {
      const sorted = [...videoList]
        .sort((a, b) => (b.view_count || b.views || 0) - (a.view_count || a.views || 0))
        .slice(0, 8);
      const labels = sorted.map(v => {
        const t = v.title || 'Untitled';
        return t.length > 40 ? t.substring(0, 40) + '…' : t;
      });
      const data = sorted.map(v => v.view_count || v.views || 0);
      if (hasValidChartData(labels, data)) {
        configs.push({ id: 'chart-top-videos', title: 'Top Videos by Views', type: 'hbar', labels, data });
      }
    }

    // Upload frequency
    let uploadFreq = extractLabelsData(analytics?.upload_frequency);
    if (!uploadFreq && videoList.length > 0) {
      const monthCounts = {};
      videoList.forEach(v => {
        const d = new Date(v.published_at);
        if (!isNaN(d.getTime())) {
          const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          monthCounts[key] = (monthCounts[key] || 0) + 1;
        }
      });
      uploadFreq = { labels: Object.keys(monthCounts), data: Object.values(monthCounts) };
    }
    if (uploadFreq && hasValidChartData(uploadFreq.labels, uploadFreq.data)) {
      configs.push({ id: 'chart-upload-freq', title: 'Upload Frequency', type: 'bar', ...uploadFreq });
    }

    // Category distribution
    let categories = extractLabelsData(analytics?.category_distribution);
    if (!categories && videoList.length > 0) {
      const totalLikes = videoList.reduce((s, v) => s + (v.like_count || v.likes || 0), 0);
      const totalComments = videoList.reduce((s, v) => s + (v.comment_count || v.comments || 0), 0);
      const totalViews = videoList.reduce((s, v) => s + (v.view_count || v.views || 0), 0);
      const passive = Math.max(0, totalViews - totalLikes - totalComments);
      if (totalLikes + totalComments > 0) {
        categories = {
          labels: ['Likes', 'Comments', 'Passive Views'],
          data: [totalLikes, totalComments, passive],
        };
      }
    }
    if (categories && hasValidChartData(categories.labels, categories.data)) {
      configs.push({ id: 'chart-engagement', title: 'Engagement Distribution', type: 'doughnut', ...categories });
    }

    return configs;
  }

  // --- Render Charts ---
  function renderCharts(chartConfigs) {
    window.Charts.destroyAll();
    if (!chartConfigs || chartConfigs.length === 0) return;

    // Defer until canvas elements are laid out
    requestAnimationFrame(() => {
      chartConfigs.forEach(cfg => {
        try {
          switch (cfg.type) {
            case 'line':
              window.Charts.createLineChart(cfg.id, cfg.labels, [
                { label: 'Views', data: cfg.data, color: '#ff2d55' },
              ]);
              break;
            case 'hbar':
              window.Charts.createHorizontalBarChart(cfg.id, cfg.labels, cfg.data, { dataLabel: 'Views' });
              break;
            case 'bar':
              window.Charts.createBarChart(cfg.id, cfg.labels, cfg.data, { dataLabel: 'Uploads' });
              break;
            case 'doughnut':
              window.Charts.createDoughnutChart(cfg.id, cfg.labels, cfg.data);
              break;
          }
        } catch (e) {
          console.warn(`Chart ${cfg.id} error:`, e);
          const container = document.getElementById(cfg.id)?.closest('.chart-container');
          if (container) container.remove();
        }
      });
    });
  }

  // --- Analyze from suggestion ---
  function analyzeFromSuggestion(query) {
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.value = query;
    }
    if (window.App && window.App.analyzeChannel) {
      window.App.analyzeChannel(query);
    }
  }

  // --- Init icons helper ---
  function initIcons(container) {
    if (window.lucide && container) {
      window.lucide.createIcons({ nodes: [container] });
    }
  }

  // --- Expose globally ---
  window.Dashboard = {
    renderDashboard,
    analyzeFromSuggestion,
  };

  window.renderDashboard = renderDashboard;
})();
