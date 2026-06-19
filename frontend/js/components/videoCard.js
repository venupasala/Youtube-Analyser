/* ============================================
   YouTube Analyzer — Video Card Component
   ============================================ */
(function () {
  'use strict';

  // --- Number Formatting ---
  function formatNumber(num) {
    if (num === null || num === undefined) return '—';
    num = Number(num);
    if (isNaN(num)) return '—';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
  }

  // --- Relative Time ---
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(days / 365);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }

  // --- Duration Formatting ---
  function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '';
    seconds = Math.floor(Number(seconds));
    if (isNaN(seconds) || seconds < 0) return '';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatDurationISO(isoDuration) {
    if (!isoDuration) return '';
    // Parse ISO 8601 duration like PT1H2M3S
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return isoDuration;
    const h = parseInt(match[1]) || 0;
    const m = parseInt(match[2]) || 0;
    const s = parseInt(match[3]) || 0;
    return formatDuration(h * 3600 + m * 60 + s);
  }

  // --- Escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Get thumbnail URL ---
  function getThumbnail(video) {
    // Try multiple thumbnail fields
    if (video.thumbnail_url) return video.thumbnail_url;
    if (video.thumbnail) return video.thumbnail;
    if (video.thumbnails) {
      // Could be an object with default/medium/high
      if (typeof video.thumbnails === 'object') {
        return (video.thumbnails.high && video.thumbnails.high.url) ||
               (video.thumbnails.medium && video.thumbnails.medium.url) ||
               (video.thumbnails.default && video.thumbnails.default.url) || '';
      }
      return video.thumbnails;
    }
    // Construct from video ID
    if (video.video_id) {
      return `https://i.ytimg.com/vi/${video.video_id}/mqdefault.jpg`;
    }
    return '';
  }

  // --- Get video ID ---
  function getVideoId(video) {
    return video.video_id || video.id || video.videoId || '';
  }

  // --- Create a single video card ---
  function createVideoCard(video, options = {}) {
    const { rank, source, showSimilarBtn } = options;
    const videoId = getVideoId(video);
    const thumbnail = getThumbnail(video);
    const title = escapeHtml(video.title || 'Untitled');
    const channelName = escapeHtml(video.channel_title || video.channel_name || video.channelTitle || '');
    const viewCount = video.view_count ?? video.views ?? video.viewCount;
    const likeCount = video.like_count ?? video.likes ?? video.likeCount;
    const publishedAt = video.published_at || video.publishedAt || video.publish_date || '';
    const duration = video.duration || video.duration_seconds;

    let durationDisplay = '';
    if (typeof duration === 'string' && duration.startsWith('PT')) {
      durationDisplay = formatDurationISO(duration);
    } else if (typeof duration === 'number') {
      durationDisplay = formatDuration(duration);
    }

    let sourceLabel = '';
    if (source) {
      const sourceMap = { es: 'Full-Text', vector: 'Semantic', youtube: 'YouTube' };
      sourceLabel = `<span class="source-badge ${source}">${sourceMap[source] || source}</span>`;
    }

    return `
      <div class="video-card hoverable animate-in"
           onclick="window.VideoCard.openVideo('${escapeHtml(videoId)}')"
           role="button" tabindex="0"
           aria-label="${title}">
        ${rank ? `<div class="rank-badge">#${rank}</div>` : ''}
        <div class="thumbnail-wrapper">
          <img class="thumbnail"
               src="${escapeHtml(thumbnail)}"
               alt="${title}"
               loading="lazy"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 320 180%22%3E%3Crect fill=%22%2312121a%22 width=%22320%22 height=%22180%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%235a5a6e%22 text-anchor=%22middle%22 dy=%22.3em%22 font-family=%22sans-serif%22%3ENo Thumbnail%3C/text%3E%3C/svg%3E'">
          ${durationDisplay ? `<span class="duration-badge">${durationDisplay}</span>` : ''}
        </div>
        <div class="video-info">
          <div class="video-title">${title}</div>
          ${channelName ? `<div class="video-channel">${channelName} ${sourceLabel}</div>` : (sourceLabel ? `<div class="video-channel">${sourceLabel}</div>` : '')}
          <div class="video-meta">
            ${viewCount !== undefined && viewCount !== null ? `<span>${formatNumber(viewCount)} views</span>` : ''}
            ${viewCount !== undefined && publishedAt ? '<span class="meta-dot"></span>' : ''}
            ${publishedAt ? `<span>${timeAgo(publishedAt)}</span>` : ''}
            ${likeCount !== undefined && likeCount !== null ? `<span class="meta-dot"></span><span><i data-lucide="thumbs-up" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:2px;"></i>${formatNumber(likeCount)}</span>` : ''}
          </div>
        </div>
        ${showSimilarBtn && videoId ? `
          <div class="video-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="window.VideoCard.onFindSimilar('${escapeHtml(videoId)}', '${escapeHtml(title)}')">
              <i data-lucide="sparkles" style="width:14px;height:14px;"></i> Find Similar
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --- Create a grid of video cards ---
  function createVideoGrid(videos, options = {}) {
    if (!videos || videos.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="video-off"></i></div>
          <div class="empty-state-title">No Videos Found</div>
          <div class="empty-state-text">${escapeHtml(options.emptyMessage || 'Try adjusting your search or filters.')}</div>
        </div>
      `;
    }

    const cards = videos.map((video, index) => {
      const cardOptions = { ...options };
      if (options.showRank) cardOptions.rank = index + 1;
      return createVideoCard(video, cardOptions);
    }).join('');

    return `<div class="video-grid stagger-in">${cards}</div>`;
  }

  // --- Open video in new tab ---
  function openVideo(videoId) {
    if (videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
    }
  }

  // --- Find similar handler (set by search view) ---
  let findSimilarCallback = null;

  function onFindSimilar(videoId, title) {
    if (findSimilarCallback) {
      findSimilarCallback(videoId, title);
    } else {
      // Navigate to search with a similar query
      window.location.hash = '#search';
      setTimeout(() => {
        if (window._searchForSimilar) {
          window._searchForSimilar(videoId, title);
        }
      }, 100);
    }
  }

  function setFindSimilarCallback(fn) {
    findSimilarCallback = fn;
  }

  // --- Initialize Lucide icons in a container ---
  function initIcons(container) {
    if (window.lucide && container) {
      window.lucide.createIcons({ nodes: [container] });
    }
  }

  // --- Expose globally ---
  window.VideoCard = {
    createVideoCard,
    createVideoGrid,
    openVideo,
    onFindSimilar,
    setFindSimilarCallback,
    initIcons,
    formatNumber,
    timeAgo,
    formatDuration,
    escapeHtml,
  };
})();
