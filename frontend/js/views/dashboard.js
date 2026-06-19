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
      <div class="welcome-container animate-in">
        <div class="welcome-icon">
          <i data-lucide="play" style="width:36px;height:36px;color:white;"></i>
        </div>
        <h1 class="welcome-title">YouTube Channel Analyzer</h1>
        <p class="welcome-subtitle">
          Enter a YouTube channel URL, @handle, or channel ID in the search bar above to unlock deep analytics, video insights, and performance metrics.
        </p>
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

    container.innerHTML = `
      <div class="view-section animate-in">
        ${renderChannelHeader(channel)}
      </div>
      <div class="view-section animate-in animate-in-delay-1">
        ${renderStatsRow(channel, analytics)}
      </div>
      <div class="view-section animate-in animate-in-delay-2">
        <div class="section-header">
          <h2 class="section-title">Analytics</h2>
        </div>
        <div class="chart-grid">
          <div class="chart-container">
            <div class="chart-title">Views Timeline</div>
            <div class="chart-wrapper"><canvas id="chart-views-timeline"></canvas></div>
          </div>
          <div class="chart-container">
            <div class="chart-title">Top Videos by Views</div>
            <div class="chart-wrapper"><canvas id="chart-top-videos"></canvas></div>
          </div>
          <div class="chart-container">
            <div class="chart-title">Upload Frequency</div>
            <div class="chart-wrapper"><canvas id="chart-upload-freq"></canvas></div>
          </div>
          <div class="chart-container">
            <div class="chart-title">Engagement Distribution</div>
            <div class="chart-wrapper"><canvas id="chart-engagement"></canvas></div>
          </div>
        </div>
      </div>
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

    // Render charts
    renderCharts(analytics, videoList);
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

    // Calculate engagement rate from analytics or estimate
    let engagement = 0;
    if (analytics && analytics.avg_engagement_rate) {
      engagement = analytics.avg_engagement_rate;
    } else if (analytics && analytics.engagement_rate) {
      engagement = analytics.engagement_rate;
    }
    const engagementDisplay = engagement ? (engagement * 100).toFixed(2) + '%' : '—';

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

  // --- Render Charts ---
  function renderCharts(analytics, videos) {
    // Destroy old charts
    window.Charts.destroyAll();

    // 1. Views Timeline
    try {
      if (analytics && analytics.views_timeline) {
        const timeline = analytics.views_timeline;
        const labels = timeline.map(t => t.date || t.label || '');
        const data = timeline.map(t => t.views || t.value || 0);
        window.Charts.createLineChart('chart-views-timeline', labels, [
          { label: 'Views', data, color: '#ff2d55' }
        ]);
      } else if (videos && videos.length > 0) {
        // Fallback: use video view counts in reverse chronological order
        const sorted = [...videos].sort((a, b) => new Date(a.published_at || 0) - new Date(b.published_at || 0));
        const labels = sorted.map(v => {
          const d = new Date(v.published_at);
          return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });
        const data = sorted.map(v => v.view_count || v.views || 0);
        window.Charts.createLineChart('chart-views-timeline', labels, [
          { label: 'Views per Video', data, color: '#ff2d55' }
        ]);
      }
    } catch (e) { console.warn('Views timeline chart error:', e); }

    // 2. Top Videos (horizontal bar)
    try {
      const videoList = videos || [];
      if (videoList.length > 0) {
        const sorted = [...videoList]
          .sort((a, b) => (b.view_count || b.views || 0) - (a.view_count || a.views || 0))
          .slice(0, 8);
        const labels = sorted.map(v => {
          const t = v.title || 'Untitled';
          return t.length > 40 ? t.substring(0, 40) + '…' : t;
        });
        const data = sorted.map(v => v.view_count || v.views || 0);
        window.Charts.createHorizontalBarChart('chart-top-videos', labels, data, { dataLabel: 'Views' });
      }
    } catch (e) { console.warn('Top videos chart error:', e); }

    // 3. Upload Frequency
    try {
      if (analytics && analytics.upload_frequency) {
        const freq = analytics.upload_frequency;
        const labels = Object.keys(freq);
        const data = Object.values(freq);
        window.Charts.createBarChart('chart-upload-freq', labels, data, { dataLabel: 'Videos' });
      } else if (videos && videos.length > 0) {
        // Fallback: group by month
        const monthCounts = {};
        videos.forEach(v => {
          const d = new Date(v.published_at);
          if (!isNaN(d.getTime())) {
            const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            monthCounts[key] = (monthCounts[key] || 0) + 1;
          }
        });
        const labels = Object.keys(monthCounts);
        const data = Object.values(monthCounts);
        window.Charts.createBarChart('chart-upload-freq', labels, data, { dataLabel: 'Uploads' });
      }
    } catch (e) { console.warn('Upload frequency chart error:', e); }

    // 4. Engagement / Category Distribution
    try {
      if (analytics && analytics.category_distribution) {
        const dist = analytics.category_distribution;
        const labels = Object.keys(dist);
        const data = Object.values(dist);
        window.Charts.createDoughnutChart('chart-engagement', labels, data);
      } else if (videos && videos.length > 0) {
        // Fallback: engagement breakdown (likes vs comments vs views ratio)
        const totalLikes = videos.reduce((s, v) => s + (v.like_count || v.likes || 0), 0);
        const totalComments = videos.reduce((s, v) => s + (v.comment_count || v.comments || 0), 0);
        const totalViews = videos.reduce((s, v) => s + (v.view_count || v.views || 0), 0);
        window.Charts.createDoughnutChart('chart-engagement',
          ['Likes', 'Comments', 'Passive Views'],
          [totalLikes, totalComments, Math.max(0, totalViews - totalLikes - totalComments)]
        );
      }
    } catch (e) { console.warn('Engagement chart error:', e); }
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
