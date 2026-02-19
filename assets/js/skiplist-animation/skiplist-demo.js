/**
 * Skip List Interactive Visualization
 * @author: Ahmad Alhour (github.com/aalhour)
 * @license: MIT, see: LICENCE file at root dir of the project.
 * 
 * Demonstrates the skip list data structure:
 * - Probabilistic levels (express lanes)
 * - O(log n) search via skipping
 * - Pointer rewiring on insert
 */

(function() {
  'use strict';

  if (typeof anime === 'undefined' || !anime.animate) {
    console.error('SkipList Animation: anime.js v4+ is required');
    return;
  }

  const { animate, stagger } = anime;

  const isDarkMode = () => {
    const htmlMode = document.documentElement.getAttribute('data-mode');
    if (htmlMode) return htmlMode === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const darkColors = {
    bg: 'transparent',
    border: 'rgba(255, 255, 255, 0.1)',
    node: '#4ade80',
    nodeFill: 'rgba(74, 222, 128, 0.15)',
    nodeStroke: '#4ade80',
    head: '#60a5fa',
    headFill: 'rgba(96, 165, 250, 0.15)',
    pointer: '#a78bfa',
    pointerActive: '#fbbf24',
    insert: '#22d3ee',
    insertGlow: 'rgba(34, 211, 238, 0.5)',
    search: '#fbbf24',
    searchPath: 'rgba(251, 191, 36, 0.4)',
    searchGlow: 'rgba(251, 191, 36, 0.5)',
    delete: '#f43f5e',
    deleteGlow: 'rgba(244, 63, 94, 0.5)',
    level0: '#4ade80',
    level1: '#60a5fa',
    level2: '#a78bfa',
    level3: '#f472b6',
    text: '#e5e7eb',
    textMuted: '#9ca3af',
    textDim: '#6b7280',
    separator: 'rgba(255, 255, 255, 0.15)',
    highlight: '#fbbf24',
    success: '#22c55e',
    nil: '#ef4444'
  };

  const lightColors = {
    bg: 'transparent',
    border: 'rgba(0, 0, 0, 0.1)',
    node: '#22c55e',
    nodeFill: 'rgba(34, 197, 94, 0.1)',
    nodeStroke: '#22c55e',
    head: '#3b82f6',
    headFill: 'rgba(59, 130, 246, 0.1)',
    pointer: '#8b5cf6',
    pointerActive: '#d97706',
    insert: '#0891b2',
    insertGlow: 'rgba(8, 145, 178, 0.4)',
    search: '#d97706',
    searchPath: 'rgba(217, 119, 6, 0.3)',
    searchGlow: 'rgba(217, 119, 6, 0.4)',
    delete: '#e11d48',
    deleteGlow: 'rgba(225, 29, 72, 0.4)',
    level0: '#22c55e',
    level1: '#3b82f6',
    level2: '#8b5cf6',
    level3: '#ec4899',
    text: '#1e293b',
    textMuted: '#64748b',
    textDim: '#94a3b8',
    separator: 'rgba(0, 0, 0, 0.1)',
    highlight: '#d97706',
    success: '#15803d',
    nil: '#dc2626'
  };

  const getColors = () => isDarkMode() ? darkColors : lightColors;

  const config = {
    width: 780,
    height: 300,
    get colors() { return getColors(); },
    maxLevel: 4,
    maxNodes: 12,
    nodeHeight: 29,
    levelHeight: 50,
    headX: 50,
    headWidth: 55,
    startX: 120,
    nilWidth: 32,
    nilMargin: 12,
    probability: 0.50,
    animDuration: 300,
    minNodeWidth: 40,
    maxNodeWidth: 60,
    minGap: 10,
    maxGap: 20
  };

  function getNodeLayout() {
    const count = Math.max(1, state.nodes.length);
    const availableWidth = config.width - config.startX - config.nilWidth - config.nilMargin - 10;
    
    const totalNeeded = count * (config.maxNodeWidth + config.maxGap);
    
    if (totalNeeded <= availableWidth) {
      return {
        nodeWidth: config.maxNodeWidth,
        gap: config.maxGap,
        totalSlot: config.maxNodeWidth + config.maxGap
      };
    }
    
    const totalSlot = availableWidth / count;
    const gap = Math.max(config.minGap, Math.min(config.maxGap, totalSlot * 0.));
    const nodeWidth = Math.max(config.minNodeWidth, totalSlot - gap);
    
    return { nodeWidth, gap, totalSlot };
  }

  const state = {
    nodes: [],
    maxLevel: 0,
    isAnimating: false,
    log: [],
    seqNo: 0,
    spinnerInterval: null,
    currentOp: null
  };

  let container, svg;
  let themeObserver = null;

  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = buildHTML();
    svg = container.querySelector('#skiplist-svg');

    setupControls();
    render();

    addLog('🚀 Skip List ready');

    if (!themeObserver) {
      themeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'data-mode') {
            rebuildForTheme();
          }
        }
      });
      themeObserver.observe(document.documentElement, { attributes: true });
    }
  }

  function rebuildForTheme() {
    if (!container) return;
    container.innerHTML = buildHTML();
    svg = container.querySelector('#skiplist-svg');
    setupControls();
    render();
  }

  function buildHTML() {
    const c = config.colors;
    const dark = isDarkMode();
    
    return `
      <style>
        .skiplist-container {
          font-family: 'Space Grotesk', 'SF Mono', monospace;
          background: ${dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'};
          border: 1px solid ${c.border};
          border-radius: 12px;
          padding: 1.25rem;
        }
        .skiplist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .skiplist-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: ${c.text};
        }
        .skiplist-toolbar {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.6rem;
          padding: 0.5rem;
          background: ${dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)'};
          border-radius: 6px;
          flex-wrap: wrap;
        }
        .skiplist-toolbar-section {
          display: flex;
          gap: 0.3rem;
          align-items: center;
        }
        .skiplist-section-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: ${c.textMuted};
          text-transform: uppercase;
          margin-right: 0.3rem;
        }
        .skiplist-toolbar-divider {
          width: 1px;
          height: 24px;
          background: ${c.separator};
          margin: 0 0.4rem;
        }
        .skiplist-toolbar input {
          padding: 0.35rem 0.5rem;
          border: 1px solid ${c.separator};
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)'};
          color: ${c.text};
          border-radius: 4px;
          width: 60px;
          font-family: inherit;
          font-size: 0.75rem;
        }
        .skiplist-toolbar input:focus {
          outline: none;
          border-color: ${c.node};
        }
        .skiplist-btn {
          padding: 0.35rem 0.6rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.7rem;
          font-weight: 600;
          transition: all 0.15s;
        }
        .skiplist-btn:hover { filter: brightness(1.15); }
        .skiplist-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-insert { background: ${c.insert}; color: ${dark ? '#000' : '#fff'}; }
        .btn-search { background: ${c.search}; color: ${dark ? '#000' : '#fff'}; }
        .btn-delete { background: ${c.delete}; color: #fff; }
        .btn-demo { background: ${c.highlight}; color: #000; }
        .btn-secondary { background: ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}; color: ${c.text}; }
        .skiplist-svg-container {
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.02)'};
          border-radius: 8px;
          border: 1px solid ${c.separator};
          overflow: hidden;
          margin-bottom: 0.6rem;
        }
        .skiplist-footer {
          display: flex;
          gap: 0.5rem;
          font-size: 0.7rem;
        }
        .skiplist-stats {
          display: flex;
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .skiplist-stat {
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)'};
          border: 1px solid ${c.separator};
          border-radius: 5px;
          padding: 0.3rem 0.5rem;
          text-align: center;
          min-width: 70px;
        }
        .skiplist-stat-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: ${c.text};
        }
        .skiplist-stat-label {
          font-size: 0.55rem;
          color: ${c.textMuted};
        }
        .skiplist-log-panel {
          flex: 1;
          background: ${dark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)'};
          border: 1px solid ${c.separator};
          border-radius: 5px;
          padding: 0.4rem;
          min-height: 60px;
        }
        .skiplist-log-title {
          font-size: 0.6rem;
          font-weight: 600;
          color: ${c.textMuted};
          text-transform: uppercase;
          margin-bottom: 0.3rem;
        }
        .skiplist-log {
          max-height: 45px;
          overflow-y: auto;
          font-size: 0.6rem;
        }
        .skiplist-log-entry { padding: 0.1rem 0; color: ${c.textMuted}; }
        .skiplist-log-entry.highlight { color: ${c.highlight}; }
        .skiplist-log-entry.success { color: ${c.success}; }
        .skiplist-log-entry.error { color: ${c.nil}; }
        .skiplist-legend {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: ${dark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)'};
          border-radius: 6px;
          font-size: 0.65rem;
          color: ${c.textMuted};
          flex-wrap: wrap;
        }
        .skiplist-legend-item {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .skiplist-legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        @media (max-width: 650px) {
          .skiplist-footer { flex-direction: column; }
          .skiplist-toolbar { flex-direction: column; align-items: flex-start; }
          .skiplist-toolbar-divider { width: 100%; height: 1px; margin: 0.3rem 0; }
        }
      </style>
      
      <div class="skiplist-container">
        <div class="skiplist-header">
          <div class="skiplist-title">Skip List Demo</div>
          <button class="skiplist-btn btn-secondary" id="skiplist-reset" title="Reset">↺</button>
        </div>
        
        <div class="skiplist-toolbar">
          <div class="skiplist-toolbar-section">
            <span class="skiplist-section-label">Demo</span>
            <button class="skiplist-btn btn-demo" id="skiplist-demo">▶ Play</button>
          </div>
          <div class="skiplist-toolbar-divider"></div>
          <div class="skiplist-toolbar-section">
            <span class="skiplist-section-label">Insert</span>
            <input type="text" id="skiplist-key" placeholder="key" maxlength="5">
            <button class="skiplist-btn btn-insert" id="skiplist-insert">Insert</button>
          </div>
          <div class="skiplist-toolbar-divider"></div>
          <div class="skiplist-toolbar-section">
            <span class="skiplist-section-label">Search</span>
            <input type="text" id="skiplist-search-key" placeholder="key" maxlength="6">
            <button class="skiplist-btn btn-search" id="skiplist-search">Search</button>
          </div>
          <div class="skiplist-toolbar-divider"></div>
          <div class="skiplist-toolbar-section">
            <span class="skiplist-section-label">Delete</span>
            <input type="text" id="skiplist-delete-key" placeholder="key" maxlength="5">
            <button class="skiplist-btn btn-delete" id="skiplist-delete">Delete</button>
          </div>
        </div>
        
        <div class="skiplist-svg-container">
          <svg id="skiplist-svg" viewBox="0 0 ${config.width} ${config.height}" width="100%">
            <defs>
              <marker id="ptr-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${c.pointer}"/>
              </marker>
              <marker id="ptr-arrow-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${c.pointerActive}"/>
              </marker>
              <marker id="ptr-arrow-search" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="${c.search}"/>
              </marker>
              <filter id="node-glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="${c.node}" flood-opacity="0.5"/>
                <feComposite in2="blur" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="insert-glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="${c.insert}" flood-opacity="0.6"/>
                <feComposite in2="blur" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="search-glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="${c.search}" flood-opacity="0.6"/>
                <feComposite in2="blur" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="delete-glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feFlood flood-color="${c.delete}" flood-opacity="0.6"/>
                <feComposite in2="blur" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <g id="status-layer"></g>
            <g id="level-labels"></g>
            <g id="pointers-layer"></g>
            <g id="nodes-layer"></g>
            <g id="animation-layer"></g>
          </svg>
        </div>
        
        <div class="skiplist-footer">
          <div class="skiplist-stats">
            <div class="skiplist-stat">
              <div class="skiplist-stat-value" id="stat-nodes">0/${config.maxNodes}</div>
              <div class="skiplist-stat-label">Nodes</div>
            </div>
            <div class="skiplist-stat">
              <div class="skiplist-stat-value" id="stat-height">0/${config.maxLevel}</div>
              <div class="skiplist-stat-label">Height</div>
            </div>
            <div class="skiplist-stat">
              <div class="skiplist-stat-value" id="stat-prob">p=${config.probability}</div>
              <div class="skiplist-stat-label">Level-up prob is 0.5</div>
            </div>
          </div>
          <div class="skiplist-log-panel">
            <div class="skiplist-log-title">Activity Log</div>
            <div class="skiplist-log" id="skiplist-log"></div>
          </div>
        </div>
        
        <div class="skiplist-legend">
          <div class="skiplist-legend-item">
            <div class="skiplist-legend-color" style="background: ${c.level0};"></div>
            <span>L0 (base)</span>
          </div>
          <div class="skiplist-legend-item">
            <div class="skiplist-legend-color" style="background: ${c.level1};"></div>
            <span>L1</span>
          </div>
          <div class="skiplist-legend-item">
            <div class="skiplist-legend-color" style="background: ${c.level2};"></div>
            <span>L2</span>
          </div>
          <div class="skiplist-legend-item">
            <div class="skiplist-legend-color" style="background: ${c.level3};"></div>
            <span>L3 (express)</span>
          </div>
          <div class="skiplist-legend-item" style="margin-left: auto;">
            <span style="color: ${c.textDim};">Demo limit: ${config.maxNodes} nodes, ${config.maxLevel} levels</span>
          </div>
        </div>
      </div>
    `;
  }

  function setupControls() {
    container.querySelector('#skiplist-insert').addEventListener('click', handleInsert);
    container.querySelector('#skiplist-search').addEventListener('click', handleSearch);
    container.querySelector('#skiplist-delete').addEventListener('click', handleDelete);
    container.querySelector('#skiplist-demo').addEventListener('click', runDemo);
    container.querySelector('#skiplist-reset').addEventListener('click', handleReset);

    container.querySelector('#skiplist-key').addEventListener('keypress', e => {
      if (e.key === 'Enter') handleInsert();
    });
    container.querySelector('#skiplist-search-key').addEventListener('keypress', e => {
      if (e.key === 'Enter') handleSearch();
    });
    container.querySelector('#skiplist-delete-key').addEventListener('keypress', e => {
      if (e.key === 'Enter') handleDelete();
    });
  }

  function setButtonsLocked(locked) {
    const buttons = container.querySelectorAll('.skiplist-btn');
    const inputs = container.querySelectorAll('input');
    buttons.forEach(btn => btn.disabled = locked);
    inputs.forEach(inp => inp.disabled = locked);
  }

  function randomLevel(p = config.probability) {
    let level = 1;
    while (Math.random() < p && level < config.maxLevel) {
      level++;
    }
    return Math.min(level, config.maxLevel);
  }

  function handleInsert() {
    if (state.isAnimating) return;
    let key = container.querySelector('#skiplist-key').value.trim();
    if (!key) { addLog('⚠️ Enter a key', 'error'); return; }
    if (key.length > 5) key = key.slice(0, 5);
    if (state.nodes.length >= config.maxNodes) { 
      addLog(`⚠️ Max ${config.maxNodes} nodes`, 'error'); 
      return; 
    }
    
    setButtonsLocked(true);
    insert(key);
    container.querySelector('#skiplist-key').value = '';
  }

  function handleSearch() {
    if (state.isAnimating) return;
    const key = container.querySelector('#skiplist-search-key').value.trim();
    if (!key) { addLog('⚠️ Enter a key', 'error'); return; }
    
    setButtonsLocked(true);
    search(key);
  }

  function handleDelete() {
    if (state.isAnimating) return;
    let key = container.querySelector('#skiplist-delete-key').value.trim();
    if (!key) { addLog('⚠️ Enter a key', 'error'); return; }
    if (key.length > 5) key = key.slice(0, 5);    
    setButtonsLocked(true);
    deleteNode(key);
    container.querySelector('#skiplist-delete-key').value = '';
  }

  function handleReset() {
    hideOperationStatus();
    state.nodes = [];
    state.maxLevel = 0;
    state.log = [];
    state.seqNo = 0;
    state.isAnimating = false;
    addLog('🔄 Reset');
    render();
    updateStats();
    
    const animLayer = svg.querySelector('#animation-layer');
    if (animLayer) animLayer.innerHTML = '';
  }

  async function runDemo() {
    if (state.isAnimating) return;
    setButtonsLocked(true);
    addLog('🎬 Demo starting...', 'highlight');
    
    const demoKeys = ['cat', 'dog', 'ant', 'fox', 'bee', 'owl'];
    
    const keysToInsert = demoKeys.filter(k => !state.nodes.find(n => n.key === k));
    
    if (keysToInsert.length === 0) {
      addLog('ℹ️ All demo keys already inserted', 'highlight');
      addLog('🔍 Searching for "fox"...', 'highlight');
      await delay(300);
      await search('fox');
      addLog('✅ Demo complete!', 'success');
      setButtonsLocked(false);
      return;
    }
    
    for (const key of keysToInsert) {
      if (state.nodes.length >= config.maxNodes) {
        addLog(`⚠️ Max ${config.maxNodes} nodes reached`, 'error');
        break;
      }
      container.querySelector('#skiplist-key').value = key;
      await insert(key, { probability: 0.5 });
      await delay(600);
    }
    
    addLog('🔍 Searching for "fox"...', 'highlight');
    await delay(300);
    await search('fox');
    
    addLog('✅ Demo complete!', 'success');
    setButtonsLocked(false);
  }

  async function insert(key, { probability } = {}) {
    state.isAnimating = true;
    state.seqNo++;
    
    const existingIdx = state.nodes.findIndex(n => n.key === key);
    if (existingIdx === -1 && state.nodes.length >= config.maxNodes) {
      addLog(`⚠️ Max ${config.maxNodes} nodes — cannot insert "${key}"`, 'error');
      state.isAnimating = false;
      setButtonsLocked(false);
      return;
    }
    
    showOperationStatus('insert', key);
    
    const level = randomLevel(probability);
    const boundedLevel = Math.min(level, config.maxLevel);
    const levelStr = '█'.repeat(boundedLevel);
    addLog(`📥 Insert "${key}" (level ${boundedLevel}) ${levelStr}`, 'highlight');
    
    if (boundedLevel > state.maxLevel) {
      state.maxLevel = Math.min(boundedLevel, config.maxLevel);
    }
    
    if (existingIdx >= 0) {
      const newLevel = Math.min(Math.max(state.nodes[existingIdx].level, boundedLevel), config.maxLevel);
      state.nodes[existingIdx].level = newLevel;
      addLog(`↻ Updated "${key}" level to ${state.nodes[existingIdx].level}`, 'success');
    } else {
      state.nodes.push({ key, level: boundedLevel, seqNo: state.seqNo });
      state.nodes.sort((a, b) => a.key.localeCompare(b.key));
    }
    
    render();
    
    const nodeIdx = state.nodes.findIndex(n => n.key === key);
    const nodeEl = svg.querySelector(`#node-${nodeIdx}`);
    
    if (nodeEl) {
      nodeEl.style.opacity = '0';
      await animate(nodeEl, {
        opacity: [0, 1],
        scale: [0.5, 1],
        duration: 400,
        ease: 'out(3)'
      });
      
      await animate(nodeEl, {
        filter: ['url(#insert-glow)', 'none'],
        duration: 300
      });
    }
    
    hideOperationStatus();
    addLog(`✅ "${key}" inserted at position ${nodeIdx}`, 'success');
    updateStats();
    state.isAnimating = false;
    setButtonsLocked(false);
  }

  async function search(key) {
    state.isAnimating = true;
    const c = config.colors;
    
    showOperationStatus('search', key);
    addLog(`🔍 Searching for "${key}"...`, 'highlight');
    
    const animLayer = svg.querySelector('#animation-layer');
    animLayer.innerHTML = '';
    
    const targetIdx = state.nodes.findIndex(n => n.key === key);
    const layout = getNodeLayout();
    
    let currentLevel = state.maxLevel - 1;
    let currentX = config.headX + config.headWidth / 2;
    let stepsCount = 0;
    
    const baseY = config.height - 60;
    
    const searchDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    searchDot.setAttribute('r', '8');
    searchDot.setAttribute('fill', c.search);
    searchDot.setAttribute('cx', currentX);
    searchDot.setAttribute('cy', baseY - currentLevel * config.levelHeight);
    searchDot.setAttribute('filter', 'url(#search-glow)');
    animLayer.appendChild(searchDot);
    
    await animate(searchDot, {
      scale: [0, 1],
      duration: 200
    });
    
    while (currentLevel >= 0) {
      const levelY = baseY - currentLevel * config.levelHeight;
      
      await animate(searchDot, {
        cy: levelY,
        duration: 150,
        ease: 'inOutQuad'
      });
      
      let movedRight = false;
      let lastValidIdx = -1;
      
      for (let i = 0; i < state.nodes.length; i++) {
        const node = state.nodes[i];
        const nodeX = config.startX + i * layout.totalSlot + layout.nodeWidth / 2;
        const atLevel = node.level > currentLevel;
        const cmp = node.key.localeCompare(key);
        
        if (atLevel) {
          if (cmp < 0 && nodeX > currentX) {
            lastValidIdx = i;
          } else if (cmp === 0 && nodeX > currentX) {
            lastValidIdx = i;
            break;
          } else if (cmp > 0) {
            break;
          }
        }
      }
      
      if (lastValidIdx >= 0) {
        const node = state.nodes[lastValidIdx];
        const nodeX = config.startX + lastValidIdx * layout.totalSlot + layout.nodeWidth / 2;
        
        stepsCount++;
        addLog(`  → Level ${currentLevel}: skip to "${node.key}"`, 'highlight');
        
        const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        pathLine.setAttribute('x1', currentX);
        pathLine.setAttribute('y1', levelY);
        pathLine.setAttribute('x2', nodeX);
        pathLine.setAttribute('y2', levelY);
        pathLine.setAttribute('stroke', c.searchPath);
        pathLine.setAttribute('stroke-width', '3');
        pathLine.setAttribute('stroke-linecap', 'round');
        animLayer.insertBefore(pathLine, searchDot);
        
        await animate(searchDot, {
          cx: nodeX,
          duration: 250,
          ease: 'inOutQuad'
        });
        
        currentX = nodeX;
        movedRight = true;
        
        if (node.key === key) {
          hideOperationStatus();
          addLog(`🎯 Found "${key}" in ${stepsCount} steps!`, 'success');
          
          const nodeEl = svg.querySelector(`#node-${lastValidIdx}`);
          if (nodeEl) {
            await animate(nodeEl, {
              filter: 'url(#search-glow)',
              duration: 200
            });
            await animate(searchDot, {
              scale: [1, 1.5, 1],
              duration: 300
            });
            await delay(500);
            animate(nodeEl, {
              filter: 'none',
              duration: 300
            });
          }
          
          await animate(searchDot, {
            opacity: 0,
            scale: 0,
            duration: 200
          });
          animLayer.innerHTML = '';
          
          state.isAnimating = false;
          setButtonsLocked(false);
          updateStats();
          return;
        }
      }
      
      if (!movedRight) {
        addLog(`  ↓ Level ${currentLevel}: drop down`, 'highlight');
      }
      
      currentLevel--;
    }
    
    hideOperationStatus();
    addLog(`❌ "${key}" not found (${stepsCount} steps)`, 'error');
    
    await animate(searchDot, {
      fill: c.nil,
      scale: [1, 0.5],
      opacity: 0,
      duration: 300
    });
    animLayer.innerHTML = '';
    
    state.isAnimating = false;
    setButtonsLocked(false);
    updateStats();
  }

  async function deleteNode(key) {
    state.isAnimating = true;
    const c = config.colors;
    
    showOperationStatus('delete', key);
    
    const nodeIdx = state.nodes.findIndex(n => n.key === key);
    
    if (nodeIdx === -1) {
      hideOperationStatus();
      addLog(`❌ "${key}" not found — cannot delete`, 'error');
      state.isAnimating = false;
      setButtonsLocked(false);
      return;
    }
    
    addLog(`🗑️ Deleting "${key}"...`, 'highlight');
    
    const nodeEl = svg.querySelector(`#node-${nodeIdx}`);
    
    if (nodeEl) {
      await animate(nodeEl, {
        filter: 'url(#delete-glow)',
        duration: 200
      });
      
      await delay(300);
      
      await animate(nodeEl, {
        opacity: [1, 0],
        scale: [1, 0.5],
        duration: 400,
        ease: 'in(2)'
      });
    }
    
    state.nodes.splice(nodeIdx, 1);
    
    if (state.nodes.length === 0) {
      state.maxLevel = 0;
    } else {
      const computedMax = Math.max(...state.nodes.map(n => n.level));
      state.maxLevel = Math.min(computedMax, config.maxLevel);
    }
    
    render();
    
    hideOperationStatus();
    addLog(`✅ "${key}" deleted — pointers rewired`, 'success');
    updateStats();
    state.isAnimating = false;
    setButtonsLocked(false);
  }

  function render() {
    renderLevelLabels();
    renderNodes();
    renderPointers();
  }

  function renderLevelLabels() {
    const c = config.colors;
    const labelGroup = svg.querySelector('#level-labels');
    labelGroup.innerHTML = '';
    
    const baseY = config.height - 60;
    const levelColors = [c.level0, c.level1, c.level2, c.level3];
    const nilX = config.width - config.nilWidth - config.nilMargin;
    const activeLevels = config.maxLevel;
    
    for (let i = 0; i < activeLevels; i++) {
      const y = baseY - i * config.levelHeight;
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '10');
      line.setAttribute('y1', y);
      line.setAttribute('x2', config.width - 10);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', c.separator);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4,4');
      line.setAttribute('opacity', '0.5');
      labelGroup.appendChild(line);
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '15');
      label.setAttribute('y', y - 5);
      label.setAttribute('fill', levelColors[i]);
      label.setAttribute('font-size', '10');
      label.setAttribute('font-weight', '500');
      label.textContent = `L${i}`;
      labelGroup.appendChild(label);
    }
    
    for (let i = 0; i < activeLevels; i++) {
      const y = baseY - i * config.levelHeight;
      
      const nilBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      nilBox.setAttribute('x', nilX);
      nilBox.setAttribute('y', y - config.nodeHeight / 2);
      nilBox.setAttribute('width', config.nilWidth);
      nilBox.setAttribute('height', config.nodeHeight);
      nilBox.setAttribute('rx', '4');
      nilBox.setAttribute('fill', 'none');
      nilBox.setAttribute('stroke', c.nil);
      nilBox.setAttribute('stroke-width', '1.5');
      nilBox.setAttribute('stroke-dasharray', '3,2');
      labelGroup.appendChild(nilBox);
      
      if (i === 0) {
        const nilLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nilLabel.setAttribute('x', nilX + config.nilWidth / 2);
        nilLabel.setAttribute('y', y + 4);
        nilLabel.setAttribute('fill', c.nil);
        nilLabel.setAttribute('font-size', '9');
        nilLabel.setAttribute('font-weight', '600');
        nilLabel.setAttribute('text-anchor', 'middle');
        nilLabel.textContent = 'NIL';
        labelGroup.appendChild(nilLabel);
      }
    }
  }

  function renderNodes() {
    const c = config.colors;
    const nodesGroup = svg.querySelector('#nodes-layer');
    nodesGroup.innerHTML = '';
    
    const baseY = config.height - 60;
    const levelColors = [c.level0, c.level1, c.level2, c.level3];
    const layout = getNodeLayout();
    
    const headG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    headG.setAttribute('id', 'head-node');
    
    const maxH = Math.max(1, state.maxLevel) * config.levelHeight;
    const headRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    headRect.setAttribute('x', config.headX);
    headRect.setAttribute('y', baseY - maxH + config.levelHeight / 2);
    headRect.setAttribute('width', config.headWidth);
    headRect.setAttribute('height', maxH);
    headRect.setAttribute('rx', '6');
    headRect.setAttribute('fill', c.headFill);
    headRect.setAttribute('stroke', c.head);
    headRect.setAttribute('stroke-width', '2');
    headG.appendChild(headRect);
    
    const headLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    headLabel.setAttribute('x', config.headX + config.headWidth / 2);
    headLabel.setAttribute('y', baseY - maxH / 2 + config.levelHeight / 2 + 5);
    headLabel.setAttribute('fill', c.head);
    headLabel.setAttribute('font-size', '11');
    headLabel.setAttribute('font-weight', '700');
    headLabel.setAttribute('text-anchor', 'middle');
    headLabel.textContent = 'HEAD';
    headG.appendChild(headLabel);
    
    nodesGroup.appendChild(headG);
    
    state.nodes.forEach((node, idx) => {
      const x = config.startX + idx * layout.totalSlot;
      const nodeH = node.level * config.levelHeight;
      const nodeY = baseY - nodeH + config.levelHeight / 2;
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', `node-${idx}`);
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', nodeY);
      rect.setAttribute('width', layout.nodeWidth);
      rect.setAttribute('height', nodeH);
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', c.nodeFill);
      rect.setAttribute('stroke', levelColors[Math.min(node.level - 1, 3)]);
      rect.setAttribute('stroke-width', '2');
      g.appendChild(rect);
      
      const fontSize = layout.nodeWidth < 50 ? '10' : '12';
      const keyLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      keyLabel.setAttribute('x', x + layout.nodeWidth / 2);
      keyLabel.setAttribute('y', baseY + 4);
      keyLabel.setAttribute('fill', c.text);
      keyLabel.setAttribute('font-size', fontSize);
      keyLabel.setAttribute('font-weight', '600');
      keyLabel.setAttribute('text-anchor', 'middle');
      keyLabel.textContent = node.key;
      g.appendChild(keyLabel);
      
      const dotRadius = layout.nodeWidth < 50 ? 3 : 4;
      const dotOffset = layout.nodeWidth < 50 ? 6 : 8;
      for (let lvl = 0; lvl < node.level; lvl++) {
        const dotY = baseY - lvl * config.levelHeight;
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x + layout.nodeWidth - dotOffset);
        dot.setAttribute('cy', dotY);
        dot.setAttribute('r', dotRadius);
        dot.setAttribute('fill', levelColors[lvl]);
        g.appendChild(dot);
      }
      
      nodesGroup.appendChild(g);
    });
  }

  function renderPointers() {
    const c = config.colors;
    const pointersGroup = svg.querySelector('#pointers-layer');
    pointersGroup.innerHTML = '';
    
    if (state.nodes.length === 0) return;
    
    const baseY = config.height - 60;
    const nilX = config.width - config.nilWidth - config.nilMargin;
    const layout = getNodeLayout();
    
    for (let lvl = 0; lvl < state.maxLevel; lvl++) {
      const y = baseY - lvl * config.levelHeight;
      let prevX = config.headX + config.headWidth;
      
      for (let i = 0; i < state.nodes.length; i++) {
        const node = state.nodes[i];
        if (node.level > lvl) {
          const nodeX = config.startX + i * layout.totalSlot;
          
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', prevX);
          line.setAttribute('y1', y);
          line.setAttribute('x2', nodeX - 2);
          line.setAttribute('y2', y);
          line.setAttribute('stroke', c.pointer);
          line.setAttribute('stroke-width', '1.5');
          line.setAttribute('marker-end', 'url(#ptr-arrow)');
          line.setAttribute('opacity', '0.7');
          pointersGroup.appendChild(line);
          
          prevX = nodeX + layout.nodeWidth;
        }
      }
      
      const toNilLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      toNilLine.setAttribute('x1', prevX);
      toNilLine.setAttribute('y1', y);
      toNilLine.setAttribute('x2', nilX - 2);
      toNilLine.setAttribute('y2', y);
      toNilLine.setAttribute('stroke', c.pointer);
      toNilLine.setAttribute('stroke-width', '1.5');
      toNilLine.setAttribute('marker-end', 'url(#ptr-arrow)');
      toNilLine.setAttribute('opacity', '0.4');
      toNilLine.setAttribute('stroke-dasharray', '4,3');
      pointersGroup.appendChild(toNilLine);
    }
  }

  function updateStats() {
    const nodesEl = container.querySelector('#stat-nodes');
    const heightEl = container.querySelector('#stat-height');
    if (nodesEl) nodesEl.textContent = `${state.nodes.length}/${config.maxNodes}`;
    if (heightEl) heightEl.textContent = `${state.maxLevel}/${config.maxLevel}`;
  }

  function addLog(message, type = '') {
    state.log.unshift({ message, type });
    if (state.log.length > 15) state.log.pop();

    const logContainer = container ? container.querySelector('#skiplist-log') : null;
    if (logContainer) {
      logContainer.innerHTML = state.log.slice(0, 5).map(e => 
        `<div class="skiplist-log-entry ${e.type}">${e.message}</div>`
      ).join('');
    }
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function showOperationStatus(type, key) {
    const c = config.colors;
    const statusLayer = svg.querySelector('#status-layer');
    statusLayer.innerHTML = '';
    
    state.currentOp = { type, key };
    
    let color, text;
    if (type === 'insert') {
      color = c.insert;
      text = `inserting "${key}"`;
    } else if (type === 'delete') {
      color = c.delete;
      text = `deleting "${key}"`;
    } else {
      color = c.search;
      text = `searching for "${key}"`;
    }
    
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'op-status');
    
    const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    spinner.setAttribute('id', 'op-spinner');
    spinner.setAttribute('x', '50');
    spinner.setAttribute('y', '24');
    spinner.setAttribute('fill', color);
    spinner.setAttribute('font-size', '14');
    spinner.textContent = '◐';
    g.appendChild(spinner);
    
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', '68');
    label.setAttribute('y', '24');
    label.setAttribute('fill', c.textMuted);
    label.setAttribute('font-size', '12');
    label.setAttribute('font-weight', '500');
    label.textContent = text;
    g.appendChild(label);
    
    const dots = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dots.setAttribute('id', 'op-dots');
    dots.setAttribute('x', String(68 + text.length * 7 + 2));
    dots.setAttribute('y', '24');
    dots.setAttribute('fill', c.textMuted);
    dots.setAttribute('font-size', '12');
    dots.textContent = '';
    g.appendChild(dots);
    
    statusLayer.appendChild(g);
    
    if (state.spinnerInterval) {
      clearInterval(state.spinnerInterval);
    }
    
    const spinnerChars = ['◐', '◓', '◑', '◒'];
    let spinIdx = 0;
    let dotCount = 0;
    state.spinnerInterval = setInterval(() => {
      const sp = svg.querySelector('#op-spinner');
      const dt = svg.querySelector('#op-dots');
      if (sp) {
        spinIdx = (spinIdx + 1) % spinnerChars.length;
        sp.textContent = spinnerChars[spinIdx];
      }
      if (dt) {
        dotCount = (dotCount + 1) % 4;
        dt.textContent = '.'.repeat(dotCount);
      }
    }, 150);
  }

  function hideOperationStatus() {
    if (state.spinnerInterval) {
      clearInterval(state.spinnerInterval);
      state.spinnerInterval = null;
    }
    state.currentOp = null;
    
    const statusLayer = svg.querySelector('#status-layer');
    if (statusLayer) {
      statusLayer.innerHTML = '';
    }
  }

  window.SkipListDemo = { init };
})();
