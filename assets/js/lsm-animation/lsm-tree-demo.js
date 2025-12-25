/**
 * LSM-Tree Interactive Visualization - Anime.js Version
 * 
 * Layout based on RocksDB architecture:
 * - Memory plane (top): Memtable only
 * - Persistence plane (bottom): WAL (left) + SST levels stacked (right)
 * - Writes go to Memtable AND WAL in parallel
 */

(function() {
  'use strict';

  if (typeof anime === 'undefined' || !anime.animate) {
    console.error('LSM Animation: anime.js v4+ is required');
    return;
  }

  // Anime.js v4 API shortcuts
  const { animate, createTimeline, stagger } = anime;

  // Detect light/dark mode (Chirpy uses data-mode on html element)
  const isDarkMode = () => {
    const htmlMode = document.documentElement.getAttribute('data-mode');
    if (htmlMode) return htmlMode === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const darkColors = {
    bg: 'transparent',
    border: 'rgba(255, 255, 255, 0.1)',
    memtable: '#4ade80',
    memtableFill: 'rgba(74, 222, 128, 0.1)',
    wal: '#60a5fa',
    walFill: 'rgba(96, 165, 250, 0.1)',
    sst: ['#a78bfa', '#818cf8', '#a1a1aa'],
    particle: '#4ade80',
    text: '#e5e7eb',
    textMuted: '#9ca3af',
    separator: 'rgba(255, 255, 255, 0.15)',
    highlight: '#fbbf24'
  };

  const lightColors = {
    bg: 'transparent',
    border: 'rgba(0, 0, 0, 0.1)',
    memtable: '#22c55e',
    memtableFill: 'rgba(34, 197, 94, 0.08)',
    wal: '#3b82f6',
    walFill: 'rgba(59, 130, 246, 0.08)',
    sst: ['#9333ea', '#6366f1', '#64748b'],
    particle: '#22c55e',
    text: '#1e293b',
    textMuted: '#64748b',
    separator: 'rgba(0, 0, 0, 0.1)',
    highlight: '#d97706'
  };

  const getColors = () => isDarkMode() ? darkColors : lightColors;

  const config = {
    width: 720,
    height: 540,
    get colors() { return getColors(); },
    maxMemtableSize: 4,
    demoDelay: 400, // Slower demo speed
    layout: {
      memoryPlaneY: 15,
      separatorY: 210,
      persistPlaneY: 235,
      memtable: { x: 280, y: 28, w: 420, h: 150 },
      wal: { x: 20, y: 260, w: 200, h: 250 },
      levels: { x: 250, y: 270, w: 450, levelH: 55, gap: 40 }
    }
  };

  const state = {
    memtable: [],
    wal: [],
    levels: [[], [], []],
    sstCounter: 0,
    operationCount: 0,
    flushCount: 0,
    compactCount: 0,
    isAnimating: false,
    log: []
  };

  let container, svg;

  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = buildHTML();
    svg = container.querySelector('#anime-svg');

    setupControls();
    drawComponents();
    
    addLog('🚀 LSM-Tree ready');
    render();
    playEntranceAnimation();
  }

  function buildHTML() {
    const colors = config.colors;
    const dark = isDarkMode();
    
    return `
      <style>
        .lsm-anime-container {
          font-family: 'Space Grotesk', 'SF Mono', 'Fira Code', monospace;
          background: ${dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'};
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 1.25rem;
        }
        .lsm-anime-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .lsm-anime-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: ${colors.text};
        }
        .lsm-anime-toolbar {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.6rem;
          padding: 0.5rem;
          background: ${dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)'};
          border-radius: 6px;
          flex-wrap: wrap;
        }
        .lsm-anime-toolbar-section {
          display: flex;
          gap: 0.3rem;
          align-items: center;
        }
        .lsm-anime-section-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: ${colors.textMuted};
          text-transform: uppercase;
          margin-right: 0.3rem;
        }
        .lsm-anime-toolbar-divider {
          width: 1px;
          height: 24px;
          background: ${colors.separator};
          margin: 0 0.4rem;
        }
        .lsm-anime-toolbar-divider-small {
          width: 1px;
          height: 18px;
          background: ${colors.separator};
          margin: 0 0.25rem;
          opacity: 0.5;
        }
        .lsm-anime-toolbar input {
          padding: 0.35rem 0.5rem;
          border: 1px solid ${colors.separator};
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)'};
          color: ${colors.text};
          border-radius: 4px;
          width: 50px;
          font-family: inherit;
          font-size: 0.75rem;
        }
        .lsm-anime-toolbar input:focus {
          outline: none;
          border-color: ${colors.memtable};
        }
        .lsm-anime-btn {
          padding: 0.35rem 0.6rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.7rem;
          font-weight: 600;
          transition: all 0.15s;
        }
        .lsm-anime-btn:hover { filter: brightness(1.15); }
        .lsm-anime-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-demo { background: ${colors.highlight}; color: #000; }
        .btn-put { background: ${colors.memtable}; color: ${dark ? '#000' : '#fff'}; }
        .btn-get { background: ${colors.wal}; color: #fff; }
        .btn-compact { background: ${colors.sst[0]}; color: #fff; }
        .btn-secondary { background: ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; color: ${colors.text}; }
        .lsm-anime-svg-container {
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.02)'};
          border-radius: 8px;
          border: 1px solid ${colors.separator};
          overflow: hidden;
          margin-bottom: 0.6rem;
        }
        .lsm-anime-footer {
          display: flex;
          gap: 0.5rem;
          font-size: 0.7rem;
        }
        .lsm-anime-stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .lsm-anime-stat-mini {
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)'};
          border: 1px solid ${colors.separator};
          border-radius: 5px;
          padding: 0.3rem 0.5rem;
          text-align: center;
          min-width: 55px;
        }
        .lsm-anime-stat-mini .lsm-anime-stat-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: ${colors.text};
        }
        .lsm-anime-stat-mini .lsm-anime-stat-label {
          font-size: 0.55rem;
          color: ${colors.textMuted};
        }
        .lsm-anime-activity-panel {
          flex: 1;
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)'};
          border: 1px solid ${colors.separator};
          border-radius: 5px;
          padding: 0.4rem;
          min-height: 70px;
        }
        @media (max-width: 650px) {
          .lsm-anime-footer { flex-direction: column; }
          .lsm-anime-toolbar { flex-direction: column; align-items: flex-start; }
          .lsm-anime-toolbar-divider { width: 100%; height: 1px; margin: 0.3rem 0; }
        }
        .lsm-anime-log-title {
          font-size: 0.6rem;
          font-weight: 600;
          color: ${colors.textMuted};
          text-transform: uppercase;
          margin-bottom: 0.3rem;
        }
        .lsm-anime-log {
          max-height: 55px;
          overflow-y: auto;
          font-size: 0.6rem;
        }
        .lsm-anime-log-entry { padding: 0.1rem 0; color: ${colors.textMuted}; }
        .lsm-anime-log-entry.highlight { color: ${colors.highlight}; }
        .lsm-anime-log-entry.success { color: ${colors.memtable}; }
        .lsm-anime-log-entry.error { color: #ef4444; }
      </style>
      
      <div class="lsm-anime-container">
        <div class="lsm-anime-header">
          <div class="lsm-anime-title">LSM-Tree Demo</div>
          <button class="lsm-anime-btn btn-secondary" id="anime-btn-reset" title="Reset">↺</button>
        </div>
        <div class="lsm-anime-toolbar">
          <div class="lsm-anime-toolbar-section">
            <span class="lsm-anime-section-label">Demo</span>
            <button class="lsm-anime-btn btn-demo" id="anime-btn-demo">▶ Play</button>
          </div>
          <div class="lsm-anime-toolbar-divider"></div>
          <div class="lsm-anime-toolbar-section">
            <span class="lsm-anime-section-label">Put</span>
            <input type="text" id="anime-key" placeholder="key" maxlength="6">
            <input type="text" id="anime-value" placeholder="value" maxlength="6">
            <button class="lsm-anime-btn btn-put" id="anime-btn-put">Put</button>
          </div>
          <div class="lsm-anime-toolbar-divider-small"></div>
          <div class="lsm-anime-toolbar-section">
            <span class="lsm-anime-section-label">Get</span>
            <input type="text" id="anime-get-key" placeholder="key" maxlength="6">
            <button class="lsm-anime-btn btn-get" id="anime-btn-get">Get</button>
          </div>
          <div class="lsm-anime-toolbar-divider-small"></div>
          <div class="lsm-anime-toolbar-section">
            <span class="lsm-anime-section-label">Compact</span>
            <button class="lsm-anime-btn btn-compact" id="anime-btn-compact">Compact</button>
          </div>
        </div>
        <div class="lsm-anime-svg-container">
          <svg id="anime-svg" viewBox="0 0 ${config.width} ${config.height}" width="100%" style="overflow: hidden;">
            <defs>
              <linearGradient id="mem-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colors.memtable}" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="${colors.memtable}" stop-opacity="0.05"/>
              </linearGradient>
              <linearGradient id="wal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colors.wal}" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="${colors.wal}" stop-opacity="0.05"/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${colors.textMuted}"/>
              </marker>
              <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${colors.memtable}"/>
              </marker>
              <marker id="arrow-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${colors.wal}"/>
              </marker>
              <clipPath id="svg-clip">
                <rect width="${config.width}" height="${config.height}"/>
              </clipPath>
            </defs>
            <g clip-path="url(#svg-clip)">
              <rect width="${config.width}" height="${config.height}" fill="transparent"/>
              <g id="static-layer"></g>
              <g id="animation-layer"></g>
              <g id="memtable-group"></g>
              <g id="wal-group"></g>
              <g id="levels-group"></g>
            </g>
          </svg>
        </div>
        <div class="lsm-anime-footer">
          <div class="lsm-anime-stats-grid">
            <div class="lsm-anime-stat-mini">
              <div class="lsm-anime-stat-value" id="stat-ops">0</div>
              <div class="lsm-anime-stat-label">Writes</div>
            </div>
            <div class="lsm-anime-stat-mini">
              <div class="lsm-anime-stat-value" id="stat-mem">0/${config.maxMemtableSize}</div>
              <div class="lsm-anime-stat-label">Memtable</div>
            </div>
            <div class="lsm-anime-stat-mini">
              <div class="lsm-anime-stat-value" id="stat-flush">0</div>
              <div class="lsm-anime-stat-label">Flushes</div>
            </div>
            <div class="lsm-anime-stat-mini">
              <div class="lsm-anime-stat-value" id="stat-compact">0</div>
              <div class="lsm-anime-stat-label">Compacts</div>
            </div>
          </div>
          <div class="lsm-anime-activity-panel">
            <div class="lsm-anime-log-title">Activity Log</div>
            <div class="lsm-anime-log" id="anime-log"></div>
          </div>
        </div>
      </div>
    `;
  }

  function setupControls() {
    container.querySelector('#anime-btn-put').addEventListener('click', handlePut);
    container.querySelector('#anime-btn-get').addEventListener('click', handleGet);
    container.querySelector('#anime-btn-compact').addEventListener('click', handleCompact);
    container.querySelector('#anime-btn-demo').addEventListener('click', runDemo);
    container.querySelector('#anime-btn-reset').addEventListener('click', handleReset);

    container.querySelector('#anime-key').addEventListener('keypress', e => {
      if (e.key === 'Enter') container.querySelector('#anime-value').focus();
    });
    container.querySelector('#anime-value').addEventListener('keypress', e => {
      if (e.key === 'Enter') handlePut();
    });
    container.querySelector('#anime-get-key').addEventListener('keypress', e => {
      if (e.key === 'Enter') handleGet();
    });
  }

  function drawComponents() {
    const { width, layout, colors } = config;
    const staticLayer = svg.querySelector('#static-layer');

    const { memoryPlaneY, separatorY, persistPlaneY } = layout;
    const mem = layout.memtable;
    const wal = layout.wal;
    const lvl = layout.levels;

    const writeX = 120;
    const writeY = 80;

    staticLayer.innerHTML = `
      <!-- Memory plane label with lightning emoji in dotted pill -->
      <rect x="10" y="${memoryPlaneY - 6}" width="90" height="22" rx="11" 
            fill="transparent" stroke="${colors.memtable}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
      <text x="22" y="${memoryPlaneY + 9}" fill="${colors.memtable}" font-size="12">⚡</text>
      <text x="40" y="${memoryPlaneY + 8}" fill="${colors.memtable}" font-size="11" font-weight="600">Memory</text>

      <!-- Separator line -->
      <line x1="10" y1="${separatorY}" x2="${width - 10}" y2="${separatorY}" 
            stroke="${colors.separator}" stroke-width="2" stroke-dasharray="8,4"/>

      <!-- Disk plane label with turtle emoji in dotted pill -->
      <rect x="10" y="${persistPlaneY - 6}" width="70" height="22" rx="11" 
            fill="transparent" stroke="${colors.wal}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
      <text x="22" y="${persistPlaneY + 9}" fill="${colors.wal}" font-size="12">🐢</text>
      <text x="40" y="${persistPlaneY + 8}" fill="${colors.wal}" font-size="11" font-weight="600">Disk</text>

      <!-- Write label and fork point -->
      <text x="${writeX - 100}" y="${writeY + 4}" fill="${colors.text}" font-size="10" font-weight="600">Write →</text>
      <circle cx="${writeX}" cy="${writeY}" r="5" fill="${colors.particle}"/>

      <!-- Arrow to Memtable (horizontal) -->
      <path d="M ${writeX + 6} ${writeY} L ${mem.x - 8} ${writeY}" 
            stroke="${colors.memtable}" stroke-width="2" fill="none" marker-end="url(#arrow-green)"/>

      <!-- Arrow down to WAL (straight down) -->
      <path d="M ${writeX} ${writeY + 6} L ${writeX} ${wal.y - 8}" 
            stroke="${colors.wal}" stroke-width="2" stroke-dasharray="4,2" fill="none" marker-end="url(#arrow-blue)"/>

      <!-- Memtable box (table-like) -->
      <rect x="${mem.x}" y="${mem.y}" width="${mem.w}" height="${mem.h}" rx="6" 
            fill="url(#mem-grad)" stroke="${colors.memtable}" stroke-width="2"/>
      <text x="${mem.x + mem.w/2}" y="${mem.y + 18}" text-anchor="middle" 
            fill="${colors.memtable}" font-size="12" font-weight="600">Memtable</text>
      <text x="${mem.x + mem.w/2}" y="${mem.y + 32}" text-anchor="middle" 
            fill="${colors.textMuted}" font-size="8">sorted in-memory buffer</text>
      <!-- Table header -->
      <line x1="${mem.x + 10}" y1="${mem.y + 42}" x2="${mem.x + mem.w - 10}" y2="${mem.y + 42}" 
            stroke="${colors.memtable}" stroke-width="1" opacity="0.3"/>
      <text x="${mem.x + 20}" y="${mem.y + 55}" fill="${colors.textMuted}" font-size="8" font-weight="500">KEY</text>
      <text x="${mem.x + mem.w/2 + 20}" y="${mem.y + 55}" fill="${colors.textMuted}" font-size="8" font-weight="500">VALUE</text>
      <line x1="${mem.x + 10}" y1="${mem.y + 60}" x2="${mem.x + mem.w - 10}" y2="${mem.y + 60}" 
            stroke="${colors.memtable}" stroke-width="1" opacity="0.3"/>
      <g id="memtable-entries"></g>
      <rect class="capacity-bg" x="${mem.x + 10}" y="${mem.y + mem.h - 14}" width="${mem.w - 20}" height="6" rx="3" fill="${colors.separator}"/>
      <rect id="capacity-bar" x="${mem.x + 10}" y="${mem.y + mem.h - 14}" width="0" height="6" rx="3" fill="${colors.memtable}"/>

      <!-- WAL box -->
      <rect x="${wal.x}" y="${wal.y}" width="${wal.w}" height="${wal.h}" rx="6" 
            fill="url(#wal-grad)" stroke="${colors.wal}" stroke-width="2"/>
      <text x="${wal.x + wal.w/2}" y="${wal.y + 22}" text-anchor="middle" 
            fill="${colors.wal}" font-size="11" font-weight="600">WAL</text>
      <text x="${wal.x + wal.w/2}" y="${wal.y + 38}" text-anchor="middle" 
            fill="${colors.textMuted}" font-size="7">append-only log (durability)</text>
      <line x1="${wal.x + 15}" y1="${wal.y + 50}" x2="${wal.x + wal.w - 15}" y2="${wal.y + 50}" 
            stroke="${colors.wal}" stroke-width="1" opacity="0.3"/>
      <g id="wal-entries"></g>

      <!-- Flush arrow from Memtable to L0 (more visible) -->
      <path d="M ${mem.x + mem.w/2} ${mem.y + mem.h + 5} L ${mem.x + mem.w/2} ${lvl.y - 8}" 
            stroke="${colors.sst[0]}" stroke-width="2.5" stroke-dasharray="6,3" fill="none" marker-end="url(#arrow)"/>
      <text x="${mem.x + mem.w/2 + 12}" y="${separatorY + 5}" fill="${colors.sst[0]}" font-size="9" font-weight="500">flush ↓</text>

      <!-- SST Level containers -->
      ${[0, 1, 2].map(i => {
        const ly = lvl.y + i * (lvl.levelH + lvl.gap);
        const labels = ['L0', 'L1', 'L2'];
        const descs = ['newest', '', 'oldest'];
        return `
          <rect x="${lvl.x}" y="${ly}" width="${lvl.w}" height="${lvl.levelH}" rx="6"
                fill="none" stroke="${colors.sst[i]}" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.7"/>
          <text x="${lvl.x + 12}" y="${ly + 20}" fill="${colors.sst[i]}" font-size="11" font-weight="600">${labels[i]}</text>
          ${descs[i] ? `<text x="${lvl.x + lvl.w - 12}" y="${ly + 20}" text-anchor="end" fill="${colors.textMuted}" font-size="8">${descs[i]}</text>` : ''}
          <g class="level-${i}-files" transform="translate(${lvl.x + 45}, ${ly + 14})"></g>
          ${i < 2 ? `<path d="M ${lvl.x + lvl.w/2} ${ly + lvl.levelH + 3} L ${lvl.x + lvl.w/2} ${ly + lvl.levelH + lvl.gap - 3}" 
                          stroke="${colors.textMuted}" stroke-width="2" fill="none" marker-end="url(#arrow)" opacity="0.6"/>
                    <text x="${lvl.x + lvl.w/2 + 8}" y="${ly + lvl.levelH + lvl.gap/2 + 3}" fill="${colors.textMuted}" font-size="7">compact</text>` : ''}
        `;
      }).join('')}

      <!-- Legend -->
      <text x="15" y="${config.height - 8}" fill="${colors.textMuted}" font-size="7">
        Writes → Memory + WAL in parallel | Memtable flushes to L0 | Compaction merges L0→L1→L2
      </text>
    `;
  }

  function playEntranceAnimation() {
    // Only animate opacity to avoid messing with SVG transform attributes
    createTimeline({ ease: 'out(3)' })
      .add('#static-layer > *:not(.level-0-files):not(.level-1-files):not(.level-2-files)', 
           { opacity: [0, 1], duration: 400, delay: stagger(30) });
  }

  function setButtonsLocked(locked) {
    const buttons = container.querySelectorAll('.lsm-anime-btn');
    const inputs = container.querySelectorAll('input');
    buttons.forEach(btn => btn.disabled = locked);
    inputs.forEach(inp => inp.disabled = locked);
  }

  function handlePut() {
    if (state.isAnimating) return;
    const key = container.querySelector('#anime-key').value.trim();
    const value = container.querySelector('#anime-value').value.trim();
    if (!key || !value) { addLog('⚠️ Enter key & value', 'error'); return; }
    setButtonsLocked(true);
    put(key, value);
    container.querySelector('#anime-key').value = '';
    container.querySelector('#anime-value').value = '';
  }

  function handleGet() {
    if (state.isAnimating) return;
    const key = container.querySelector('#anime-get-key').value.trim();
    if (!key) { addLog('⚠️ Enter key', 'error'); return; }
    setButtonsLocked(true);
    getAnimated(key);
  }

  function handleCompact() {
    if (state.isAnimating) return;
    if (state.levels[0].length < 2) { addLog('⚠️ Need 2+ L0 files', 'error'); return; }
    setButtonsLocked(true);
    compact();
  }

  function handleReset() {
    state.memtable = [];
    state.wal = [];
    state.levels = [[], [], []];
    state.sstCounter = 0;
    state.operationCount = 0;
    state.flushCount = 0;
    state.compactCount = 0;
    state.log = [];
    addLog('🔄 Reset');
    render();
    updateStats();
    playEntranceAnimation();
  }

  async function runDemo() {
    if (state.isAnimating) return;
    setButtonsLocked(true);
    addLog('🎬 Demo...', 'highlight');
    const demo = [['user','Ali'],['age','25'],['city','NYC'],['job','Dev'],['lang','Go'],['db','LSM']];
    for (const [k, v] of demo) {
      container.querySelector('#anime-key').value = k;
      container.querySelector('#anime-value').value = v;
      await put(k, v);
      await delay(config.demoDelay);
    }
    if (state.levels[0].length >= 2) { await delay(config.demoDelay); await compact(); }
    addLog('✅ Done!', 'success');
    setButtonsLocked(false);
  }

  async function put(key, value) {
    state.isAnimating = true;
    state.operationCount++;

    const { layout, colors } = config;
    const animLayer = svg.querySelector('#animation-layer');
    const wal = layout.wal;
    const mem = layout.memtable;
    const writeX = 120;
    const writeY = 80;

    // Create particle at write point
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    particle.innerHTML = `
      <circle r="0" fill="${colors.particle}" filter="url(#glow)"/>
      <text text-anchor="middle" dy="3" fill="#000" font-size="8" font-weight="600" opacity="0">${key}</text>
    `;
    particle.setAttribute('transform', `translate(${writeX}, ${writeY})`);
    animLayer.appendChild(particle);

    // Create WAL particle
    const walParticle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    walParticle.setAttribute('cx', writeX);
    walParticle.setAttribute('cy', writeY);
    walParticle.setAttribute('r', '0');
    walParticle.setAttribute('fill', colors.wal);
    walParticle.setAttribute('opacity', '0.8');
    animLayer.appendChild(walParticle);

    // Appear
    await animate(particle.querySelector('circle'), { r: [0, 12], duration: 200, ease: 'out(3)' });
    animate(particle.querySelector('text'), { opacity: [0, 1], duration: 150 });
    animate(walParticle, { r: [0, 8], duration: 200, ease: 'out(3)' });

    await delay(150);

    // Animate both in parallel
    const memPromise = animate(particle, {
      translateX: mem.x + mem.w/2,
      translateY: mem.y + mem.h/2,
      duration: 400,
      ease: 'inOutQuad'
    });

    const walPromise = animate(walParticle, {
      cx: wal.x + wal.w/2,
      cy: wal.y + wal.h - 20,
      opacity: 0,
      duration: 500,
      ease: 'inOutQuad'
    });

    await Promise.all([memPromise, walPromise]);
    walParticle.remove();

    // Add to both - WAL uses operation format, Memtable just stores key-value
    state.wal.push({ op: 'PUT', key, value });
    const existing = state.memtable.findIndex(e => e.key === key);
    if (existing >= 0) {
      state.memtable[existing].value = value;
    } else {
      state.memtable.push({ key, value });
    }
    addLog(`✅ PUT ${key}=${value}`, 'success');

    await animate(particle, { opacity: 0, duration: 120 });
    particle.remove();
    render();

    if (state.memtable.length >= config.maxMemtableSize) {
      await flush();
    }

    updateStats();
    state.isAnimating = false;
    setButtonsLocked(false);
  }

  async function flush() {
    addLog('💫 Flushing to L0...', 'highlight');
    state.flushCount++;

    const entries = svg.querySelectorAll('#memtable-entries .entry');
    await animate(entries, {
      opacity: 0,
      duration: 350,
      delay: stagger(50, { reversed: true }),
      ease: 'inQuad'
    });

    state.sstCounter++;
    const newSST = {
      id: state.sstCounter,
      entries: [...state.memtable].sort((a, b) => a.key.localeCompare(b.key))
    };

    state.levels[0].push(newSST);
    state.memtable = [];
    // WAL is NOT cleared on flush - it's an append-only log

    addLog(`💾 SST-${newSST.id} → L0`, 'highlight');
    render();
    updateStats();
  }

  function get(key) {
    const memEntry = state.memtable.find(e => e.key === key);
    if (memEntry) {
      addLog(`🎯 Memtable: ${key}="${memEntry.value}"`, 'success');
      return memEntry;
    }
    for (let level = 0; level < state.levels.length; level++) {
      for (let i = state.levels[level].length - 1; i >= 0; i--) {
        const file = state.levels[level][i];
        const entry = file.entries.find(e => e.key === key);
        if (entry) {
          addLog(`🎯 L${level}: ${key}="${entry.value}"`, 'success');
          return { ...entry, level, fileIdx: i };
        }
      }
    }
    addLog(`❌ "${key}" not found`, 'error');
    return null;
  }

  async function getAnimated(key) {
    state.isAnimating = true;
    addLog(`🔍 GET ${key}...`, 'highlight');
    
    const { layout, colors } = config;
    const mem = layout.memtable;
    const lvl = layout.levels;
    const animLayer = svg.querySelector('#animation-layer');
    
    // Create scanning indicator
    const scanLine = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    scanLine.setAttribute('width', '4');
    scanLine.setAttribute('height', '0');
    scanLine.setAttribute('rx', '2');
    scanLine.setAttribute('fill', colors.highlight);
    scanLine.setAttribute('opacity', '0.8');
    animLayer.appendChild(scanLine);
    
    // Scan Memtable
    scanLine.setAttribute('x', mem.x + 5);
    scanLine.setAttribute('y', mem.y + 45);
    await animate(scanLine, { height: [0, mem.h - 60], duration: 300, ease: 'out(2)' });
    
    const memEntry = state.memtable.find(e => e.key === key);
    if (memEntry) {
      // Found in memtable - flash success
      await animate(scanLine, { fill: colors.memtable, opacity: [0.8, 1, 0.8], duration: 200 });
      addLog(`🎯 Memtable: ${key}="${memEntry.value}"`, 'success');
      await animate(scanLine, { opacity: 0, duration: 150 });
      scanLine.remove();
      state.isAnimating = false;
      setButtonsLocked(false);
      return;
    }
    
    addLog(`📋 Not in Memtable, scanning disk...`, 'highlight');
    await animate(scanLine, { opacity: 0, duration: 100 });
    
    // Scan each level
    for (let level = 0; level < state.levels.length; level++) {
      const ly = lvl.y + level * (lvl.levelH + lvl.gap);
      scanLine.setAttribute('x', lvl.x + 5);
      scanLine.setAttribute('y', ly + 5);
      scanLine.setAttribute('height', '4');
      await animate(scanLine, { opacity: [0, 0.8], width: [4, lvl.w - 10], duration: 250, ease: 'out(2)' });
      
      for (let i = state.levels[level].length - 1; i >= 0; i--) {
        const file = state.levels[level][i];
        const entry = file.entries.find(e => e.key === key);
        if (entry) {
          // Found - flash the SST file
          const sstFile = svg.querySelectorAll(`.level-${level}-files .sst-file`)[i];
          if (sstFile) {
            await animate(sstFile, { opacity: [1, 0.5, 1], duration: 200 });
          }
          await animate(scanLine, { fill: colors.sst[level], opacity: [0.8, 1, 0.8], duration: 200 });
          addLog(`🎯 L${level}: ${key}="${entry.value}"`, 'success');
          await animate(scanLine, { opacity: 0, duration: 150 });
          scanLine.remove();
          state.isAnimating = false;
          setButtonsLocked(false);
          return;
        }
      }
      
      await animate(scanLine, { opacity: 0, width: 4, duration: 100 });
    }
    
    // Not found
    addLog(`❌ "${key}" not found`, 'error');
    scanLine.remove();
    state.isAnimating = false;
    setButtonsLocked(false);
  }

  async function compact() {
    state.isAnimating = true;
    addLog('⚡ Compacting L0→L1...', 'highlight');
    state.compactCount++;

    // Add COMPACT entry to WAL
    state.wal.push({ op: 'COMPACT' });

    const l0Files = svg.querySelectorAll('.level-0-files .sst-file');
    await animate(l0Files, {
      opacity: 0,
      duration: 350,
      delay: stagger(50),
      ease: 'inQuad'
    });

    const merged = new Map();
    for (const file of state.levels[0]) {
      for (const entry of file.entries) {
        merged.set(entry.key, entry.value);
      }
    }

    state.sstCounter++;
    const newSST = {
      id: state.sstCounter,
      entries: Array.from(merged, ([k, v]) => ({ key: k, value: v })).sort((a, b) => a.key.localeCompare(b.key))
    };

    state.levels[0] = [];
    state.levels[1].push(newSST);

    addLog(`✨ → SST-${newSST.id} (L1)`, 'highlight');
    render();
    updateStats();
    state.isAnimating = false;
    setButtonsLocked(false);
  }

  function render() {
    renderMemtable();
    renderWAL();
    renderLevels();
  }

  function renderMemtable() {
    const { memtable: mem } = config.layout;
    const entriesGroup = svg.querySelector('#memtable-entries');
    if (!entriesGroup) return;
    entriesGroup.innerHTML = '';

    state.memtable.forEach((entry, i) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.classList.add('entry');
      const rowY = mem.y + 65 + i * 16;
      g.setAttribute('transform', `translate(${mem.x + 10}, ${rowY})`);
      g.innerHTML = `
        <rect width="${mem.w - 20}" height="14" rx="3" fill="${config.colors.memtable}" opacity="0.1"/>
        <text x="10" y="11" fill="${config.colors.text}" font-size="9">${entry.key}</text>
        <text x="${mem.w/2 + 10}" y="11" fill="${config.colors.text}" font-size="9">${entry.value}</text>
      `;
      entriesGroup.appendChild(g);
    });

    const capacity = state.memtable.length / config.maxMemtableSize;
    const bar = svg.querySelector('#capacity-bar');
    if (bar) {
      animate(bar, {
        width: (mem.w - 20) * capacity,
        fill: capacity >= 1 ? '#ef4444' : config.colors.memtable,
        duration: 180,
        ease: 'outQuad'
      });
    }
  }

  function renderWAL() {
    const { wal } = config.layout;
    const entriesGroup = svg.querySelector('#wal-entries');
    if (!entriesGroup) return;
    // Show newest entries at the bottom (tail), keep last 8 entries visible
    const maxVisible = 8;
    const start = Math.max(0, state.wal.length - maxVisible);
    const visible = state.wal.slice(start);
    entriesGroup.innerHTML = visible.map((e, i) => {
      const opText = e.op === 'COMPACT' ? 'COMPACT' : 
                     e.op === 'DELETE' ? `DEL key: ${e.key}` :
                     `PUT key: ${e.key}, val: ${e.value}`;
      return `<text x="${wal.x + 15}" y="${wal.y + 68 + i * 16}" fill="${config.colors.wal}" font-size="9" opacity="0.85">${opText}</text>`;
    }).join('');
  }

  function renderLevels() {
    if (!svg) return;
    for (let level = 0; level < 3; level++) {
      const filesGroup = svg.querySelector(`.level-${level}-files`);
      if (!filesGroup) continue;
      filesGroup.innerHTML = '';

      state.levels[level].forEach((file, i) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('sst-file');
        g.setAttribute('transform', `translate(${i * 52}, 0)`);
        g.innerHTML = `
          <rect width="48" height="28" rx="4" fill="${config.colors.sst[level]}18" stroke="${config.colors.sst[level]}" stroke-width="1.5"/>
          <text x="24" y="12" text-anchor="middle" fill="${config.colors.text}" font-size="8" font-weight="600">SST-${file.id}</text>
          <text x="24" y="23" text-anchor="middle" fill="${config.colors.textMuted}" font-size="7">${file.entries.length}k</text>
        `;
        filesGroup.appendChild(g);
      });
    }
  }

  function updateStats() {
    const ops = container.querySelector('#stat-ops');
    const mem = container.querySelector('#stat-mem');
    const flush = container.querySelector('#stat-flush');
    const compact = container.querySelector('#stat-compact');
    if (ops) ops.textContent = state.operationCount;
    if (mem) mem.textContent = `${state.memtable.length}/${config.maxMemtableSize}`;
    if (flush) flush.textContent = state.flushCount;
    if (compact) compact.textContent = state.compactCount;
  }

  function addLog(message, type = '') {
    state.log.unshift({ message, type });
    if (state.log.length > 15) state.log.pop();

    const logContainer = container ? container.querySelector('#anime-log') : null;
    if (logContainer) {
      logContainer.innerHTML = state.log.slice(0, 6).map(e => 
        `<div class="lsm-anime-log-entry ${e.type}">${e.message}</div>`
      ).join('');
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  window.LSMTreeDemo = { init };
})();
