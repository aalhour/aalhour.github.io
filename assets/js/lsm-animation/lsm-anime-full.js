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

  const config = {
    width: 680,
    height: 400,
    colors: {
      bg: '#0d1117',
      memtable: '#22c55e',
      memtableFill: 'rgba(34, 197, 94, 0.12)',
      wal: '#3b82f6',
      walFill: 'rgba(59, 130, 246, 0.12)',
      sst: ['#f97316', '#a855f7', '#ec4899'],
      particle: '#10b981',
      text: '#e5e7eb',
      textMuted: '#6b7280',
      separator: '#374151',
      highlight: '#fbbf24'
    },
    maxMemtableSize: 4,
    layout: {
      memoryPlaneY: 20,
      separatorY: 95,
      persistPlaneY: 110,
      memtable: { x: 340, y: 25, w: 180, h: 60 },
      wal: { x: 40, y: 115, w: 140, h: 130 },
      levels: { x: 340, y: 115, w: 300, levelH: 42, gap: 4 }
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
    return `
      <style>
        .lsm-anime-container {
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          background: linear-gradient(145deg, ${config.colors.bg} 0%, #161b22 100%);
          border-radius: 12px;
          padding: 1.25rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .lsm-anime-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .lsm-anime-title {
          font-size: 1rem;
          font-weight: 700;
          color: ${config.colors.text};
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .lsm-anime-badge {
          font-size: 0.55rem;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: white;
          padding: 0.15rem 0.35rem;
          border-radius: 3px;
          font-weight: 600;
        }
        .lsm-anime-controls {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          align-items: center;
        }
        .lsm-anime-controls input {
          padding: 0.3rem 0.4rem;
          border: 1px solid #30363d;
          background: #21262d;
          color: ${config.colors.text};
          border-radius: 4px;
          width: 55px;
          font-family: inherit;
          font-size: 0.75rem;
        }
        .lsm-anime-controls input:focus {
          outline: none;
          border-color: ${config.colors.memtable};
        }
        .lsm-anime-btn {
          padding: 0.3rem 0.5rem;
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
        .btn-put { background: ${config.colors.memtable}; color: #000; }
        .btn-get { background: ${config.colors.wal}; color: #fff; }
        .btn-compact { background: ${config.colors.sst[1]}; color: #fff; }
        .btn-secondary { background: #374151; color: #fff; }
        .lsm-anime-divider { width: 1px; height: 18px; background: #30363d; }
        .lsm-anime-svg-container {
          background: ${config.colors.bg};
          border-radius: 8px;
          border: 1px solid #30363d;
          margin-bottom: 0.6rem;
        }
        .lsm-anime-footer {
          display: grid;
          grid-template-columns: repeat(4, 1fr) 2fr;
          gap: 0.4rem;
          font-size: 0.7rem;
        }
        @media (max-width: 650px) {
          .lsm-anime-footer { grid-template-columns: repeat(2, 1fr); }
        }
        .lsm-anime-stat {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 5px;
          padding: 0.4rem;
          text-align: center;
        }
        .lsm-anime-stat-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: ${config.colors.text};
        }
        .lsm-anime-stat-label {
          font-size: 0.6rem;
          color: ${config.colors.textMuted};
        }
        .lsm-anime-log-panel {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 5px;
          padding: 0.4rem;
        }
        .lsm-anime-log-title {
          font-size: 0.55rem;
          font-weight: 600;
          color: ${config.colors.textMuted};
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }
        .lsm-anime-log {
          max-height: 50px;
          overflow-y: auto;
          font-size: 0.6rem;
        }
        .lsm-anime-log-entry { padding: 0.1rem 0; color: ${config.colors.textMuted}; }
        .lsm-anime-log-entry.highlight { color: ${config.colors.highlight}; }
        .lsm-anime-log-entry.success { color: ${config.colors.memtable}; }
        .lsm-anime-log-entry.error { color: #ef4444; }
      </style>
      
      <div class="lsm-anime-container">
        <div class="lsm-anime-header">
          <div class="lsm-anime-title">
            ⚡ LSM-Tree Visualizer
            <span class="lsm-anime-badge">Anime.js</span>
          </div>
          <div class="lsm-anime-controls">
            <input type="text" id="anime-key" placeholder="key" maxlength="6">
            <input type="text" id="anime-value" placeholder="value" maxlength="6">
            <button class="lsm-anime-btn btn-put" id="anime-btn-put">↓ Put</button>
            <div class="lsm-anime-divider"></div>
            <input type="text" id="anime-get-key" placeholder="key" maxlength="6">
            <button class="lsm-anime-btn btn-get" id="anime-btn-get">🔍</button>
            <div class="lsm-anime-divider"></div>
            <button class="lsm-anime-btn btn-compact" id="anime-btn-compact">⚡ Compact</button>
            <button class="lsm-anime-btn btn-secondary" id="anime-btn-demo">▶ Demo</button>
            <button class="lsm-anime-btn btn-secondary" id="anime-btn-reset">↺</button>
          </div>
        </div>
        <div class="lsm-anime-svg-container">
          <svg id="anime-svg" viewBox="0 0 ${config.width} ${config.height}" width="100%">
            <defs>
              <linearGradient id="mem-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${config.colors.memtable}" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="${config.colors.memtable}" stop-opacity="0.05"/>
              </linearGradient>
              <linearGradient id="wal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${config.colors.wal}" stop-opacity="0.15"/>
                <stop offset="100%" stop-color="${config.colors.wal}" stop-opacity="0.05"/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${config.colors.textMuted}"/>
              </marker>
              <marker id="arrow-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${config.colors.memtable}"/>
              </marker>
              <marker id="arrow-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${config.colors.wal}"/>
              </marker>
            </defs>
            <rect width="${config.width}" height="${config.height}" fill="${config.colors.bg}"/>
            <g id="static-layer"></g>
            <g id="animation-layer"></g>
            <g id="memtable-group"></g>
            <g id="wal-group"></g>
            <g id="levels-group"></g>
          </svg>
        </div>
        <div class="lsm-anime-footer">
          <div class="lsm-anime-stat">
            <div class="lsm-anime-stat-value" id="stat-ops">0</div>
            <div class="lsm-anime-stat-label">Writes</div>
          </div>
          <div class="lsm-anime-stat">
            <div class="lsm-anime-stat-value" id="stat-mem">0/${config.maxMemtableSize}</div>
            <div class="lsm-anime-stat-label">Memtable</div>
          </div>
          <div class="lsm-anime-stat">
            <div class="lsm-anime-stat-value" id="stat-flush">0</div>
            <div class="lsm-anime-stat-label">Flushes</div>
          </div>
          <div class="lsm-anime-stat">
            <div class="lsm-anime-stat-value" id="stat-compact">0</div>
            <div class="lsm-anime-stat-label">Compactions</div>
          </div>
          <div class="lsm-anime-log-panel">
            <div class="lsm-anime-log-title">Activity</div>
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

    staticLayer.innerHTML = `
      <!-- Memory plane label -->
      <text x="15" y="${memoryPlaneY + 8}" fill="${colors.memtable}" font-size="9" font-weight="600">MEMORY</text>

      <!-- Separator line -->
      <line x1="10" y1="${separatorY}" x2="${width - 10}" y2="${separatorY}" 
            stroke="${colors.separator}" stroke-width="2" stroke-dasharray="8,4"/>

      <!-- Persistence plane label -->
      <text x="15" y="${persistPlaneY + 8}" fill="${colors.wal}" font-size="9" font-weight="600">DISK</text>

      <!-- Write label and fork -->
      <text x="160" y="59" fill="${colors.text}" font-size="10" font-weight="600">Write →</text>
      <circle cx="200" cy="55" r="4" fill="${colors.particle}"/>

      <!-- Arrow to Memtable -->
      <path d="M 205 55 L ${mem.x - 5} 55" stroke="${colors.memtable}" stroke-width="2" fill="none" marker-end="url(#arrow-green)"/>

      <!-- Arrow down to WAL -->
      <path d="M 200 60 L 200 ${wal.y + 30} L ${wal.x + wal.w + 5} ${wal.y + 30}" 
            stroke="${colors.wal}" stroke-width="2" stroke-dasharray="4,2" fill="none" marker-end="url(#arrow-blue)"/>

      <!-- Memtable box -->
      <rect x="${mem.x}" y="${mem.y}" width="${mem.w}" height="${mem.h}" rx="6" 
            fill="url(#mem-grad)" stroke="${colors.memtable}" stroke-width="2"/>
      <text x="${mem.x + mem.w/2}" y="${mem.y + 16}" text-anchor="middle" 
            fill="${colors.memtable}" font-size="10" font-weight="600">Memtable</text>
      <text x="${mem.x + mem.w/2}" y="${mem.y + 28}" text-anchor="middle" 
            fill="${colors.textMuted}" font-size="7">sorted in-memory</text>
      <g id="memtable-entries"></g>
      <rect class="capacity-bg" x="${mem.x + 6}" y="${mem.y + mem.h - 10}" width="${mem.w - 12}" height="4" rx="2" fill="#21262d"/>
      <rect id="capacity-bar" x="${mem.x + 6}" y="${mem.y + mem.h - 10}" width="0" height="4" rx="2" fill="${colors.memtable}"/>

      <!-- WAL box -->
      <rect x="${wal.x}" y="${wal.y}" width="${wal.w}" height="${wal.h}" rx="6" 
            fill="url(#wal-grad)" stroke="${colors.wal}" stroke-width="2"/>
      <text x="${wal.x + wal.w/2}" y="${wal.y + 18}" text-anchor="middle" 
            fill="${colors.wal}" font-size="10" font-weight="600">WAL</text>
      <text x="${wal.x + wal.w/2}" y="${wal.y + 32}" text-anchor="middle" 
            fill="${colors.textMuted}" font-size="7">append-only log</text>
      <text x="${wal.x + wal.w/2}" y="${wal.y + 44}" text-anchor="middle" 
            fill="${colors.textMuted}" font-size="7">(durability)</text>
      <g id="wal-entries"></g>

      <!-- Flush arrow -->
      <path d="M ${mem.x + mem.w/2} ${mem.y + mem.h + 3} L ${mem.x + mem.w/2} ${separatorY - 3}" 
            stroke="${colors.sst[0]}" stroke-width="2" stroke-dasharray="4,2" fill="none" opacity="0.7"/>
      <text x="${mem.x + mem.w/2 + 8}" y="${separatorY - 8}" fill="${colors.sst[0]}" font-size="7">flush ↓</text>

      <!-- SST Level containers -->
      ${[0, 1, 2].map(i => {
        const ly = lvl.y + i * (lvl.levelH + lvl.gap);
        const labels = ['L0', 'L1', 'L2'];
        const descs = ['newest', '', 'oldest'];
        return `
          <rect x="${lvl.x}" y="${ly}" width="${lvl.w}" height="${lvl.levelH}" rx="4"
                fill="none" stroke="${colors.sst[i]}" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>
          <text x="${lvl.x + 8}" y="${ly + 14}" fill="${colors.sst[i]}" font-size="9" font-weight="600">${labels[i]}</text>
          ${descs[i] ? `<text x="${lvl.x + 26}" y="${ly + 14}" fill="${colors.textMuted}" font-size="7">${descs[i]}</text>` : ''}
          <g class="level-${i}-files" transform="translate(${lvl.x + 50}, ${ly + 8})"></g>
          ${i < 2 ? `<path d="M ${lvl.x + lvl.w/2} ${ly + lvl.levelH + 1} L ${lvl.x + lvl.w/2} ${ly + lvl.levelH + lvl.gap - 1}" 
                          stroke="${colors.textMuted}" stroke-width="1" fill="none" marker-end="url(#arrow)" opacity="0.4"/>` : ''}
        `;
      }).join('')}

      <!-- Legend -->
      <text x="15" y="${config.height - 8}" fill="${colors.textMuted}" font-size="7">
        Writes go to Memory + WAL in parallel → Memtable flushes to L0 → Compaction merges L0→L1→L2
      </text>
    `;
  }

  function playEntranceAnimation() {
    createTimeline({ ease: 'out(3)' })
      .add('#static-layer > *', { opacity: [0, 1], translateY: [10, 0], duration: 400, delay: stagger(30) });
  }

  function handlePut() {
    if (state.isAnimating) return;
    const key = container.querySelector('#anime-key').value.trim();
    const value = container.querySelector('#anime-value').value.trim();
    if (!key || !value) { addLog('⚠️ Enter key & value', 'error'); return; }
    put(key, value);
    container.querySelector('#anime-key').value = '';
    container.querySelector('#anime-value').value = '';
  }

  function handleGet() {
    const key = container.querySelector('#anime-get-key').value.trim();
    if (!key) { addLog('⚠️ Enter key', 'error'); return; }
    get(key);
  }

  function handleCompact() {
    if (state.isAnimating) return;
    if (state.levels[0].length < 2) { addLog('⚠️ Need 2+ L0 files', 'error'); return; }
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
    addLog('🎬 Demo...', 'highlight');
    const demo = [['user','Ali'],['age','25'],['city','NYC'],['job','Dev'],['lang','Go'],['db','LSM']];
    for (const [k, v] of demo) {
      container.querySelector('#anime-key').value = k;
      container.querySelector('#anime-value').value = v;
      await put(k, v);
      await delay(100);
    }
    if (state.levels[0].length >= 2) { await delay(200); await compact(); }
    addLog('✅ Done!', 'success');
  }

  async function put(key, value) {
    state.isAnimating = true;
    state.operationCount++;

    const { layout, colors } = config;
    const animLayer = svg.querySelector('#animation-layer');
    const writeX = 200, writeY = 55;

    // Create particle at write point
    const particle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    particle.innerHTML = `
      <circle r="0" fill="${colors.particle}" filter="url(#glow)"/>
      <text text-anchor="middle" dy="3" fill="#000" font-size="7" font-weight="600" opacity="0">${key}</text>
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
    await animate(particle.querySelector('circle'), { r: [0, 10], duration: 150, ease: 'out(3)' });
    animate(particle.querySelector('text'), { opacity: [0, 1], duration: 120 });
    animate(walParticle, { r: [0, 6], duration: 150, ease: 'out(3)' });

    await delay(100);

    // Animate both in parallel
    const memPromise = animate(particle, {
      translateX: layout.memtable.x + 90,
      translateY: layout.memtable.y + 35,
      duration: 280,
      ease: 'inOutQuad'
    });

    const walPromise = animate(walParticle, {
      cx: layout.wal.x + layout.wal.w/2,
      cy: layout.wal.y + 65,
      opacity: 0,
      duration: 350,
      ease: 'inOutQuad'
    });

    await Promise.all([memPromise, walPromise]);
    walParticle.remove();

    // Add to both
    state.wal.push({ key, value });
    const existing = state.memtable.findIndex(e => e.key === key);
    if (existing >= 0) {
      state.memtable[existing].value = value;
    } else {
      state.memtable.push({ key, value });
    }
    addLog(`✅ ${key}=${value}`, 'success');

    await animate(particle, { opacity: 0, duration: 120 });
    particle.remove();
    render();

    if (state.memtable.length >= config.maxMemtableSize) {
      await flush();
    }

    updateStats();
    state.isAnimating = false;
  }

  async function flush() {
    addLog('💫 Flushing to L0...', 'highlight');
    state.flushCount++;

    const entries = svg.querySelectorAll('#memtable-entries .entry');
    await animate(entries, {
      translateX: 50,
      translateY: 50,
      opacity: 0,
      scale: 0.6,
      duration: 280,
      delay: stagger(40, { reversed: true }),
      ease: 'inBack'
    });

    state.sstCounter++;
    const newSST = {
      id: state.sstCounter,
      entries: [...state.memtable].sort((a, b) => a.key.localeCompare(b.key))
    };

    state.levels[0].push(newSST);
    state.memtable = [];
    state.wal = [];

    addLog(`💾 SST-${newSST.id} → L0`, 'highlight');
    render();

    const newSst = svg.querySelector('.level-0-files').lastElementChild;
    if (newSst) {
      animate(newSst, { scale: [0, 1], opacity: [0, 1], duration: 280, ease: 'outBack' });
    }

    updateStats();
  }

  function get(key) {
    const memEntry = state.memtable.find(e => e.key === key);
    if (memEntry) {
      addLog(`🎯 Memtable: ${key}="${memEntry.value}"`, 'success');
      return;
    }
    for (let level = 0; level < state.levels.length; level++) {
      for (let i = state.levels[level].length - 1; i >= 0; i--) {
        const file = state.levels[level][i];
        const entry = file.entries.find(e => e.key === key);
        if (entry) {
          addLog(`🎯 L${level}: ${key}="${entry.value}"`, 'success');
          return;
        }
      }
    }
    addLog(`❌ "${key}" not found`, 'error');
  }

  async function compact() {
    state.isAnimating = true;
    addLog('⚡ Compacting L0→L1...', 'highlight');
    state.compactCount++;

    const l0Files = svg.querySelectorAll('.level-0-files .sst-file');
    await animate(l0Files, {
      translateY: 15,
      scale: 0.7,
      opacity: 0.3,
      duration: 250,
      delay: stagger(30),
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

    const newL1 = svg.querySelector('.level-1-files').lastElementChild;
    if (newL1) {
      animate(newL1, { scale: [0, 1], duration: 280, ease: 'outBack' });
    }

    updateStats();
    state.isAnimating = false;
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
      g.setAttribute('transform', `translate(${mem.x + 6}, ${mem.y + 34 + i * 12})`);
      g.innerHTML = `
        <rect width="${mem.w - 12}" height="10" rx="2" fill="${config.colors.memtable}" opacity="0.15"/>
        <text x="${(mem.w - 12) / 2}" y="8" text-anchor="middle" fill="${config.colors.text}" font-size="8">${entry.key}=${entry.value}</text>
      `;
      entriesGroup.appendChild(g);
    });

    const capacity = state.memtable.length / config.maxMemtableSize;
    const bar = svg.querySelector('#capacity-bar');
    if (bar) {
      animate(bar, {
        width: (mem.w - 12) * capacity,
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
    const recent = state.wal.slice(-4);
    entriesGroup.innerHTML = recent.map((e, i) => 
      `<text x="${wal.x + 8}" y="${wal.y + 60 + i * 14}" fill="${config.colors.wal}" font-size="8" opacity="0.8">${e.key}=${e.value}</text>`
    ).join('');
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
        g.setAttribute('transform', `translate(${i * 50}, 0)`);
        g.innerHTML = `
          <rect width="45" height="26" rx="3" fill="${config.colors.sst[level]}18" stroke="${config.colors.sst[level]}" stroke-width="1.5"/>
          <text x="22" y="11" text-anchor="middle" fill="${config.colors.text}" font-size="7" font-weight="600">SST-${file.id}</text>
          <text x="22" y="21" text-anchor="middle" fill="${config.colors.textMuted}" font-size="6">${file.entries.length}k</text>
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

  window.LSMAnimeFull = { init };
})();
