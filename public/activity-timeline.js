/**
 * Activity Timeline — Real-time unified event feed
 * 
 * Combines sessions, trades, alerts, services, and system health
 * into one chronological, filterable timeline at the top of the dashboard.
 * 
 * Injected into the dashboard automatically on page load.
 */

(function() {
  'use strict';

  // ============== Configuration ==============
  const CONFIG = {
    refreshInterval: 15000,   // 15 seconds
    maxEvents: 200,           // max events to display
    timelineApi: '/api/timeline'
  };

  // ============== State ==============
  let allEvents = [];
  let refreshTimer = null;
  let panelVisible = false;
  let currentFilter = 'all';

  // ============== Injection ==============
  function injectStyles() {
    if (document.getElementById('timeline-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'timeline-panel-styles';
    style.textContent = `
      /* ===== Activity Timeline Panel ===== */
      .timeline-panel {
        background: #16213e;
        border-radius: 10px;
        margin-bottom: 30px;
        border: 2px solid #0f3460;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      .timeline-panel:hover {
        border-color: #7c5cfc;
      }
      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
        cursor: pointer;
        background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
        user-select: none;
        border-bottom: 1px solid #0f3460;
      }
      .timeline-header:hover {
        background: linear-gradient(135deg, #1a1a3e 0%, #1e1e3e 100%);
      }
      .timeline-body {
        display: none;
        padding: 16px 20px;
        max-height: 600px;
        overflow-y: auto;
      }
      .timeline-body.active {
        display: block;
      }
      .timeline-badge {
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
        background: rgba(124, 92, 252, 0.2);
        color: #7c5cfc;
        border: 1px solid #7c5cfc;
      }
      .timeline-filters {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
        padding: 8px 0;
        border-bottom: 1px solid #0f3460;
      }
      .timeline-filter-btn {
        background: #1a1a2e;
        border: 1px solid #0f3460;
        color: #a9a9a9;
        padding: 4px 12px;
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.75rem;
        transition: all 0.2s;
      }
      .timeline-filter-btn:hover {
        border-color: #7c5cfc;
        color: #e6e6e6;
      }
      .timeline-filter-btn.active {
        background: rgba(124, 92, 252, 0.2);
        border-color: #7c5cfc;
        color: #7c5cfc;
      }
      .timeline-clear-btn {
        margin-left: auto;
        background: transparent;
        border: 1px solid #555;
        color: #888;
        padding: 4px 10px;
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.7rem;
        transition: all 0.2s;
      }
      .timeline-clear-btn:hover {
        border-color: #f05454;
        color: #f05454;
      }
      .timeline-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        position: relative;
      }
      /* Vertical line */
      .timeline-list::before {
        content: '';
        position: absolute;
        left: 24px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #0f3460;
        z-index: 0;
      }
      .timeline-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 6px 8px 6px 0;
        border-radius: 6px;
        transition: all 0.15s;
        position: relative;
        z-index: 1;
        background: transparent;
        margin-left: 6px;
      }
      .timeline-item:hover {
        background: rgba(15, 52, 96, 0.4);
      }
      .timeline-dot {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.6rem;
        position: relative;
        z-index: 2;
        border: 2px solid #16213e;
      }
      .timeline-dot.session { background: #7c5cfc; box-shadow: 0 0 8px rgba(124, 92, 252, 0.5); }
      .timeline-dot.trade { background: #2ed573; box-shadow: 0 0 8px rgba(46, 213, 115, 0.5); }
      .timeline-dot.alert { background: #f05454; box-shadow: 0 0 8px rgba(240, 84, 84, 0.5); }
      .timeline-dot.service { background: #4cc9f0; box-shadow: 0 0 8px rgba(76, 201, 240, 0.5); }
      .timeline-dot.system { background: #ffa502; box-shadow: 0 0 8px rgba(255, 165, 2, 0.5); }
      .timeline-dot.report { background: #f0a04c; box-shadow: 0 0 8px rgba(240, 160, 76, 0.5); }

      .timeline-content {
        flex: 1;
        min-width: 0;
        padding-top: 1px;
      }
      .timeline-title {
        color: #e6e6e6;
        font-size: 0.82rem;
        line-height: 1.3;
        margin-bottom: 1px;
      }
      .timeline-title strong {
        color: #ffffff;
      }
      .timeline-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.68rem;
        color: #666;
      }
      .timeline-tag {
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .timeline-tag.session { background: rgba(124, 92, 252, 0.15); color: #7c5cfc; }
      .timeline-tag.trade { background: rgba(46, 213, 115, 0.15); color: #2ed573; }
      .timeline-tag.alert { background: rgba(240, 84, 84, 0.15); color: #f05454; }
      .timeline-tag.service { background: rgba(76, 201, 240, 0.15); color: #4cc9f0; }
      .timeline-tag.system { background: rgba(255, 165, 2, 0.15); color: #ffa502; }
      .timeline-tag.report { background: rgba(240, 160, 76, 0.15); color: #f0a04c; }
      
      .timeline-ago {
        color: #555;
        white-space: nowrap;
      }
      .timeline-empty {
        text-align: center;
        padding: 30px;
        color: #555;
        font-style: italic;
      }
      .timeline-error {
        text-align: center;
        padding: 20px;
        color: #f05454;
        background: rgba(240, 84, 84, 0.08);
        border-radius: 6px;
      }
      .timeline-refresh-btn {
        background: #0f3460;
        border: 1px solid #0f3460;
        color: #7c5cfc;
        padding: 3px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.72rem;
        transition: all 0.2s;
      }
      .timeline-refresh-btn:hover {
        border-color: #7c5cfc;
        background: #16213e;
      }
    `;
    document.head.appendChild(style);
  }

  function injectPanel() {
    const container = document.querySelector('.container');
    if (!container) return;

    // Don't inject twice
    if (document.getElementById('timeline-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'timeline-panel';
    panel.className = 'timeline-panel';
    panel.innerHTML = `
      <div class="timeline-header" id="timeline-header" onclick="ActivityTimeline.toggle()">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.3rem;">📡</span>
          <h3 style="color: #7c5cfc; margin: 0;">Activity Timeline</h3>
          <span id="timeline-badge" class="timeline-badge">Загрузка...</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span id="timeline-summary-text" style="color: #a9a9a9; font-size: 0.82rem;"></span>
          <span id="timeline-toggle-icon" style="color: #7c5cfc; font-size: 1.2rem;">▼</span>
        </div>
      </div>
      <div class="timeline-body" id="timeline-body">
        <div class="timeline-filters" id="timeline-filters">
          <button class="timeline-filter-btn active" data-filter="all" onclick="ActivityTimeline.setFilter('all')">📋 Все</button>
          <button class="timeline-filter-btn" data-filter="session" onclick="ActivityTimeline.setFilter('session')">🔌 Сессии</button>
          <button class="timeline-filter-btn" data-filter="trade" onclick="ActivityTimeline.setFilter('trade')">💹 Торги</button>
          <button class="timeline-filter-btn" data-filter="alert" onclick="ActivityTimeline.setFilter('alert')">🔔 Оповещения</button>
          <button class="timeline-filter-btn" data-filter="service" onclick="ActivityTimeline.setFilter('service')">⚙️ Сервисы</button>
          <button class="timeline-filter-btn" data-filter="system" onclick="ActivityTimeline.setFilter('system')">🖥️ Система</button>
          <button class="timeline-filter-btn" data-filter="report" onclick="ActivityTimeline.setFilter('report')">📊 Отчеты</button>
          <button class="timeline-clear-btn" onclick="ActivityTimeline.clearCache()">🗑️ Очистить кэш</button>
        </div>
        <div id="timeline-list" class="timeline-list">
          <div class="timeline-empty">⏳ Загрузка событий...</div>
        </div>
      </div>
    `;

    // Insert right after the header
    const header = container.querySelector('header');
    if (header && header.nextSibling) {
      container.insertBefore(panel, header.nextSibling);
    } else {
      container.insertBefore(panel, container.firstChild);
    }
  }

  // ============== Data Fetching ==============
  async function fetchJson(url) {
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    if (diff < 0) return 'только что';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return sec + 'с назад';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'м назад';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'ч назад';
    return Math.floor(hr / 24) + 'д назад';
  }

  // ============== Timeline Core ==============
  let currentFilter = 'all';
  let allEvents = [];

  // Use the server-side consolidated /api/timeline endpoint (single HTTP call)
  async function fetchTimelineFromServer() {
    const data = await fetchJson(CONFIG.timelineApi);
    if (!data || !data.success || !data.events) return [];
    return data.events.map(function(e) {
      return {
        type: e.type,
        ts: e.timestamp,
        title: (e.emoji || '•') + ' ' + e.title,
        meta: e.meta || '',
        tag: e.type
      };
    });
  }

  async function refreshTimeline() {
    try {
      const serverEvents = await fetchTimelineFromServer();
      if (serverEvents.length > 0) {
        allEvents = serverEvents;
      }
      renderTimeline();
    } catch (err) {
      console.error('[ActivityTimeline] Error refreshing:', err);
    }
  }

  function renderTimeline() {
    const badge = document.getElementById('timeline-badge');
    const summaryText = document.getElementById('timeline-summary-text');
    const listEl = document.getElementById('timeline-list');
    if (!listEl) return;

    var filtered = currentFilter === 'all'
      ? allEvents
      : allEvents.filter(function(e) { return e.type === currentFilter; });

    var total = allEvents.length;
    var recentCount = allEvents.filter(function(e) { return (Date.now() - e.ts) < 3600000; }).length;
    badge.textContent = total + ' events';
    summaryText.textContent = recentCount > 0 ? ('\uD83D\uDD50 ' + recentCount + ' last hour') : (total + ' total');

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="timeline-empty">\uD83D\uDCED No events to display</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < Math.min(filtered.length, 100); i++) {
      var evt = filtered[i];
      var dotClass = evt.type;
      var ago = timeAgo(evt.ts);
      html += '<div class="timeline-item">' +
        '<div class="timeline-dot ' + dotClass + '"></div>' +
        '<div class="timeline-content">' +
        '<div class="timeline-title">' + evt.title + '</div>' +
        '<div class="timeline-meta">' +
        '<span class="timeline-tag ' + (evt.tag || evt.type) + '">' + evt.type + '</span>';
      if (evt.meta) html += '<span>' + evt.meta + '</span>';
      html += '<span class="timeline-ago">' + ago + '</span>' +
        '</div></div></div>';
    }

    listEl.innerHTML = html +
      '<div style="margin-top: 10px; text-align: center; padding: 8px 0; border-top: 1px solid #0f3460;">' +
      '<button class="timeline-refresh-btn" onclick="ActivityTimeline.refresh()">\uD83D\uDD04 Refresh</button>' +
      '<span style="color: #555; font-size: 0.68rem; margin-left: 10px;">Auto-refresh every ' + (CONFIG.refreshInterval / 1000) + 's</span></div>';
  }

  // ============== Public API ==============
  window.ActivityTimeline = {
    async init() {
      injectStyles();
      injectPanel();
      await refreshTimeline();
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(refreshTimeline, CONFIG.refreshInterval);
    },

    toggle() {
      const body = document.getElementById('timeline-body');
      const icon = document.getElementById('timeline-toggle-icon');
      if (!body || !icon) return;
      panelVisible = !panelVisible;
      body.classList.toggle('active', panelVisible);
      icon.textContent = panelVisible ? '▲' : '▼';
    },

    setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.timeline-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
      });
      renderTimeline();
    },

    async refresh() {
      await refreshTimeline();
    },

    clearCache() {
      allEvents = [];
      renderTimeline();
      // Show brief visual confirmation
      const btn = document.querySelector('.timeline-clear-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Очищено';
        btn.style.borderColor = '#2ed573';
        btn.style.color = '#2ed573';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.borderColor = '#555';
          btn.style.color = '#888';
        }, 1500);
      }
    }
  };

  // ============== Auto-Initialize ==============
  // Wait for the dashboard to load, then initialize after a short delay
  const origInit = window.initDashboard;
  if (typeof origInit === 'function') {
    const origBody = document.body;
    const observer = new MutationObserver((mutations, obs) => {
      const container = document.querySelector('.container');
      if (container) {
        obs.disconnect();
        setTimeout(() => ActivityTimeline.init(), 500);
      }
    });
    if (document.querySelector('.container')) {
      setTimeout(() => ActivityTimeline.init(), 500);
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

})();
