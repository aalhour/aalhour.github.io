/**
 * fsync() Durability Animation - Deep Dive Edition
 * @author: Ahmad Alhour (github.com/aalhour)
 * @license: MIT, see: LICENCE file at root dir of the project.
 * 
 * Visualizes what happens when a Go program calls file.Sync() / fsync():
 * - User Space: Go runtime, goroutine scheduling, syscall interface
 * - Kernel Space: VFS, filesystem, block layer, I/O scheduler
 * - Hardware (SSD): NVMe controller, FTL, NAND flash programming
 */

(function() {
  'use strict';

  if (typeof anime === 'undefined' || !anime.animate) {
    console.error('fsync Animation: anime.js v4+ is required');
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
    
    // User Space - Greens
    userZone: 'rgba(34, 197, 94, 0.08)',
    userZoneBorder: '#22c55e',
    goroutine: '#4ade80',
    goroutineFill: 'rgba(74, 222, 128, 0.15)',
    runtime: '#86efac',
    codeBg: 'rgba(0, 0, 0, 0.4)',
    codeText: '#e5e7eb',
    codeKeyword: '#c084fc',
    codeString: '#fbbf24',
    codeComment: '#6b7280',
    goIcon: '#00ADD8',
    
    // Kernel Space - Blues/Purples  
    kernelZone: 'rgba(99, 102, 241, 0.08)',
    kernelZoneBorder: '#6366f1',
    vfs: '#60a5fa',
    vfsFill: 'rgba(96, 165, 250, 0.12)',
    fs: '#a78bfa',
    fsFill: 'rgba(167, 139, 250, 0.12)',
    block: '#c084fc',
    blockFill: 'rgba(192, 132, 252, 0.12)',
    
    // Hardware - Oranges/Ambers
    hwZone: 'rgba(251, 146, 60, 0.08)',
    hwZoneBorder: '#fb923c',
    controller: '#fbbf24',
    controllerFill: 'rgba(251, 191, 36, 0.12)',
    ftl: '#f59e0b',
    ftlFill: 'rgba(245, 158, 11, 0.12)',
    nand: '#ef4444',
    nandFill: 'rgba(239, 68, 68, 0.12)',
    
    data: '#4ade80',
    dataGlow: 'rgba(74, 222, 128, 0.4)',
    success: '#22c55e',
    warning: '#fbbf24',
    error: '#ef4444',
    text: '#f3f4f6',
    textMuted: '#9ca3af',
    textDim: '#6b7280',
    separator: 'rgba(255, 255, 255, 0.1)',
    arrow: '#6b7280',
    queueItem: 'rgba(74, 222, 128, 0.3)',
    queueEmpty: 'rgba(255, 255, 255, 0.05)',
    dimmed: 'rgba(255, 255, 255, 0.3)'
  };

  const lightColors = {
    bg: 'transparent',
    border: 'rgba(0, 0, 0, 0.1)',
    
    userZone: 'rgba(34, 197, 94, 0.06)',
    userZoneBorder: '#16a34a',
    goroutine: '#22c55e',
    goroutineFill: 'rgba(34, 197, 94, 0.1)',
    runtime: '#15803d',
    codeBg: 'rgba(0, 0, 0, 0.05)',
    codeText: '#1e293b',
    codeKeyword: '#7c3aed',
    codeString: '#b45309',
    codeComment: '#64748b',
    goIcon: '#00ADD8',
    
    kernelZone: 'rgba(99, 102, 241, 0.06)',
    kernelZoneBorder: '#4f46e5',
    vfs: '#3b82f6',
    vfsFill: 'rgba(59, 130, 246, 0.08)',
    fs: '#8b5cf6',
    fsFill: 'rgba(139, 92, 246, 0.08)',
    block: '#a855f7',
    blockFill: 'rgba(168, 85, 247, 0.08)',
    
    hwZone: 'rgba(251, 146, 60, 0.06)',
    hwZoneBorder: '#ea580c',
    controller: '#d97706',
    controllerFill: 'rgba(217, 119, 6, 0.08)',
    ftl: '#b45309',
    ftlFill: 'rgba(180, 83, 9, 0.08)',
    nand: '#dc2626',
    nandFill: 'rgba(220, 38, 38, 0.08)',
    
    data: '#16a34a',
    dataGlow: 'rgba(22, 163, 74, 0.3)',
    success: '#15803d',
    warning: '#d97706',
    error: '#dc2626',
    text: '#1e293b',
    textMuted: '#64748b',
    textDim: '#94a3b8',
    separator: 'rgba(0, 0, 0, 0.08)',
    arrow: '#94a3b8',
    queueItem: 'rgba(22, 163, 74, 0.2)',
    queueEmpty: 'rgba(0, 0, 0, 0.03)',
    dimmed: 'rgba(0, 0, 0, 0.4)'
  };

  const getColors = () => isDarkMode() ? darkColors : lightColors;

    const config = {
      width: 820,
      height: 1483,
    get colors() { return getColors(); },
    stepDelay: 600,
    zones: {
      user:   { y: 20,  h: 250, label: 'USER SPACE' },
      kernel: { y: 320, h: 440, label: 'KERNEL SPACE' },
      hw:     { y: 824, h: 643, label: 'HARDWARE (SSD)' }
    }
  };

  const state = {
    isAnimating: false,
    currentStep: -1,
    hasRun: false
  };

  // Component IDs for highlighting
  const componentIds = [
    'comp-userspace',
    'comp-vfs',
    'comp-filesystem', 
    'comp-block',
    'comp-nvme',
    'comp-ftl',
    'comp-nand'
  ];

  let container, svg;
  let themeObserver = null;

  function init(containerId) {
    container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = buildHTML();
    svg = container.querySelector('#fsync-svg');

    setupControls();
    renderStaticComponents();
    setupThemeObserver();
    playEntranceAnimation();
  }

  function buildHTML() {
    const c = config.colors;
    return `
      <div class="fsync-animation" style="
        font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
        background: ${c.bg};
        border: 1px solid ${c.border};
        border-radius: 12px;
        padding: 20px;
        max-width: ${config.width}px;
        margin: 0 auto;
      ">
        <div class="fsync-header" style="
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid ${c.separator};
        ">
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; color: ${c.text}; font-weight: 600;">
              The Journey of fsync(): From Goroutine to NAND Flash
            </h3>
            <p style="margin: 4px 0 0; font-size: 0.8rem; color: ${c.textMuted};">
              Tracing a single syscall through the entire I/O stack
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="fsync-play-btn" style="
              padding: 10px 18px;
              border-radius: 6px;
              border: 1px solid ${c.goroutine};
              background: transparent;
              color: ${c.goroutine};
              font-size: 0.85rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            ">▶ file.Sync()</button>
            <button id="fsync-reset-btn" style="
              padding: 10px 14px;
              border-radius: 6px;
              border: 1px solid ${c.border};
              background: transparent;
              color: ${c.textMuted};
              font-size: 0.85rem;
              cursor: pointer;
            ">Reset</button>
          </div>
        </div>
        
        <svg id="fsync-svg" viewBox="0 0 ${config.width} ${config.height}" 
             style="width: 100%; height: auto; display: block;">
          <defs>
            <marker id="arrow-down" markerWidth="8" markerHeight="6" 
                    refX="4" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="${c.arrow}"/>
            </marker>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feFlood flood-color="${c.data}" flood-opacity="0.6"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <filter id="glow-active">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feFlood flood-color="${c.warning}" flood-opacity="0.4"/>
              <feComposite in2="blur" operator="in"/>
              <feMerge>
                <feMergeNode/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g id="zones-layer"></g>
          <g id="static-layer"></g>
          <g id="animation-layer"></g>
        </svg>
        
        <div id="fsync-status" style="
          margin-top: 16px;
          padding: 14px 16px;
          background: ${isDarkMode() ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)'};
          border-radius: 8px;
          border-left: 3px solid ${c.textDim};
          font-size: 0.85rem;
          color: ${c.text};
          min-height: 60px;
          line-height: 1.6;
        ">
          <span id="fsync-status-text">Click <strong>file.Sync()</strong> to trace the fsync journey through the I/O stack</span>
        </div>
        
        <div style="
          margin-top: 12px;
          padding: 10px 12px;
          background: ${isDarkMode() ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
          border-radius: 6px;
          font-size: 0.7rem;
          color: ${c.textDim};
        ">
          <strong>References:</strong> 
          <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/" target="_blank" style="color: ${c.vfs};">OSTEP</a> · 
          <a href="https://www.kernel.org/doc/html/latest/filesystems/" target="_blank" style="color: ${c.vfs};">Linux VFS</a> · 
          <a href="https://nvmexpress.org/specifications/" target="_blank" style="color: ${c.controller};">NVMe Spec</a> · 
          <a href="https://codecapsule.com/2014/02/12/coding-for-ssds-part-1-introduction-and-table-of-contents/" target="_blank" style="color: ${c.nand};">Coding for SSDs</a>
        </div>
      </div>
    `;
  }

  function renderStaticComponents() {
    const c = config.colors;
    const zonesLayer = svg.querySelector('#zones-layer');
    const staticLayer = svg.querySelector('#static-layer');
    zonesLayer.innerHTML = '';
    staticLayer.innerHTML = '';

    const zoneX = 15;
    const zoneW = config.width - 30;
    const contentX = 30;
    const contentW = config.width - 60;

    // ========== ZONE BACKGROUNDS ==========
    drawZoneBox(zonesLayer, zoneX, config.zones.user.y, zoneW, config.zones.user.h,
                c.userZone, c.userZoneBorder, config.zones.user.label);
    drawZoneBox(zonesLayer, zoneX, config.zones.kernel.y, zoneW, config.zones.kernel.h,
                c.kernelZone, c.kernelZoneBorder, config.zones.kernel.label);
    drawZoneBox(zonesLayer, zoneX, config.zones.hw.y, zoneW, config.zones.hw.h,
                c.hwZone, c.hwZoneBorder, config.zones.hw.label);

    // ========== USER SPACE ==========
    const userY = config.zones.user.y + 45;
    renderUserSpaceSection(staticLayer, contentX, userY, contentW);

    drawArrowWithLabel(staticLayer, contentX + contentW / 2, config.zones.user.y + config.zones.user.h - 5,
                       contentX + contentW / 2, config.zones.kernel.y + 8,
                       'SYSCALL instruction (Ring 3 → Ring 0)', c.arrow);

    // ========== KERNEL SPACE ==========
    const kernelY = config.zones.kernel.y + 40;
    
    renderVFSBlock(staticLayer, contentX, kernelY, contentW, 100);
    drawArrow(staticLayer, contentX + contentW / 2, kernelY + 100,
              contentX + contentW / 2, kernelY + 118, c.arrow);
    
    renderFilesystemBlock(staticLayer, contentX, kernelY + 118, contentW, 110);
    drawArrow(staticLayer, contentX + contentW / 2, kernelY + 228,
              contentX + contentW / 2, kernelY + 246, c.arrow);
    
    renderBlockLayerBlock(staticLayer, contentX, kernelY + 246, contentW, 130);
    drawArrowWithLabel(staticLayer, contentX + contentW / 2, config.zones.kernel.y + config.zones.kernel.h - 5,
                       contentX + contentW / 2, config.zones.hw.y + 8,
                       'PCIe / NVMe', c.arrow);

    // ========== HARDWARE ==========
    const hwY = config.zones.hw.y + 40;
    
    renderNVMeBlock(staticLayer, contentX, hwY, contentW, 120);
    drawArrow(staticLayer, contentX + contentW / 2, hwY + 120,
              contentX + contentW / 2, hwY + 140, c.arrow);
    
    renderFTLBlock(staticLayer, contentX, hwY + 140, contentW, 130);
    drawArrow(staticLayer, contentX + contentW / 2, hwY + 270,
              contentX + contentW / 2, hwY + 290, c.arrow);
    
    renderNANDBlock(staticLayer, contentX, hwY + 290, contentW, 293);
  }

  function drawZoneBox(parent, x, y, w, h, fill, stroke, label) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('stroke-dasharray', '6,3');
    parent.appendChild(rect);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + 12);
    text.setAttribute('y', y + 16);
    text.setAttribute('fill', stroke);
    text.setAttribute('font-size', '13');
    text.setAttribute('font-weight', '700');
    text.setAttribute('letter-spacing', '1.5');
    text.textContent = label;
    parent.appendChild(text);
  }

  // ========== HIGHLIGHT FUNCTIONS ==========

  function highlightComponent(activeId) {
    componentIds.forEach(id => {
      const comp = svg.querySelector(`#${id}`);
      if (!comp) return;
      
      if (id === activeId) {
        // Highlight active component
        animate(comp, {
          opacity: 1,
          filter: 'url(#glow-active)',
          duration: 400,
          ease: 'outQuad'
        });
      } else {
        // Dim other components
        animate(comp, {
          opacity: 0.3,
          filter: 'none',
          duration: 400,
          ease: 'outQuad'
        });
      }
    });
  }

  function resetHighlights() {
    componentIds.forEach(id => {
      const comp = svg.querySelector(`#${id}`);
      if (comp) {
        comp.style.opacity = '1';
        comp.style.filter = 'none';
      }
    });
  }

  // ========== USER SPACE LAYOUT ==========

  function renderUserSpaceSection(parent, x, y, w) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-userspace');

    const codeBlockW = 380;
    const stateBlockW = w - codeBlockW - 20;
    const codeBlockH = 180;

    // ===== LEFT SIDE: Code File =====
    const fileX = x;
    const fileY = y;

    const fileContainer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fileContainer.setAttribute('x', fileX);
    fileContainer.setAttribute('y', fileY);
    fileContainer.setAttribute('width', codeBlockW);
    fileContainer.setAttribute('height', codeBlockH);
    fileContainer.setAttribute('rx', '8');
    fileContainer.setAttribute('fill', c.codeBg);
    fileContainer.setAttribute('stroke', c.textDim);
    fileContainer.setAttribute('stroke-width', '1');
    g.appendChild(fileContainer);

    const headerBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    headerBar.setAttribute('x', fileX);
    headerBar.setAttribute('y', fileY);
    headerBar.setAttribute('width', codeBlockW);
    headerBar.setAttribute('height', 28);
    headerBar.setAttribute('rx', '8');
    headerBar.setAttribute('fill', isDarkMode() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
    g.appendChild(headerBar);
    
    const headerCover = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    headerCover.setAttribute('x', fileX);
    headerCover.setAttribute('y', fileY + 20);
    headerCover.setAttribute('width', codeBlockW);
    headerCover.setAttribute('height', 10);
    headerCover.setAttribute('fill', isDarkMode() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
    g.appendChild(headerCover);

    const goIcon = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    goIcon.setAttribute('cx', fileX + 18);
    goIcon.setAttribute('cy', fileY + 14);
    goIcon.setAttribute('r', '8');
    goIcon.setAttribute('fill', c.goIcon);
    g.appendChild(goIcon);
    
    const goText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    goText.setAttribute('x', fileX + 18);
    goText.setAttribute('y', fileY + 18);
    goText.setAttribute('fill', '#ffffff');
    goText.setAttribute('font-size', '11');
    goText.setAttribute('font-weight', '700');
    goText.setAttribute('text-anchor', 'middle');
    goText.textContent = 'Go';
    g.appendChild(goText);

    addText(g, fileX + 35, fileY + 18, 'main.go', c.text, '11', '600');

    const codeStartY = fileY + 45;
    const codeX = fileX + 15;
    const lineHeight = 16;

    const indentPx = 20; // pixels per indent level
    const codeLines = [
      { text: 'package main', color: c.codeKeyword, indent: 0 },
      { text: '', color: c.codeText, indent: 0 },
      { text: 'func writeWAL(entry []byte) error {', color: c.codeText, indent: 0 },
      { text: 'f, _ := os.OpenFile("wal.log",', color: c.codeText, indent: 1 },
      { text: 'os.O_WRONLY|os.O_SYNC, 0644)', color: c.codeText, indent: 2 },
      { text: 'f.Write(entry)', color: c.codeText, indent: 1 },
      { text: 'f.Sync()', color: c.codeText, indent: 1, highlight: true, comment: '// ← blocks here' },
      { text: 'return nil', color: c.codeText, indent: 1 },
      { text: '}', color: c.codeText, indent: 0 }
    ];

    codeLines.forEach((line, i) => {
      if (line.text === '') return;
      
      const lineY = codeStartY + i * lineHeight;
      const lineX = codeX + (line.indent || 0) * indentPx;
      
      if (line.highlight) {
        const highlightBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlightBg.setAttribute('id', 'code-highlight');
        highlightBg.setAttribute('x', fileX + 5);
        highlightBg.setAttribute('y', lineY - 11);
        highlightBg.setAttribute('width', codeBlockW - 10);
        highlightBg.setAttribute('height', 16);
        highlightBg.setAttribute('fill', 'rgba(74, 222, 128, 0.15)');
        highlightBg.setAttribute('rx', '2');
        highlightBg.setAttribute('opacity', '0'); // Hidden by default
        g.appendChild(highlightBg);
      }

      const codeLine = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      codeLine.setAttribute('x', lineX);
      codeLine.setAttribute('y', lineY);
      codeLine.setAttribute('fill', line.color);
      codeLine.setAttribute('font-size', '11');
      codeLine.setAttribute('font-family', 'monospace');
      codeLine.textContent = line.text;
      g.appendChild(codeLine);

      if (line.comment) {
        const comment = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        comment.setAttribute('x', lineX + line.text.length * 6.6 + 5);
        comment.setAttribute('y', lineY);
        comment.setAttribute('fill', c.codeComment);
        comment.setAttribute('font-size', '11');
        comment.setAttribute('font-family', 'monospace');
        comment.textContent = line.comment;
        g.appendChild(comment);
      }
    });

    // ===== RIGHT SIDE: Goroutine State & Scheduler =====
    const stateX = fileX + codeBlockW + 20;
    const stateY = y;

    const stateContainer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stateContainer.setAttribute('x', stateX);
    stateContainer.setAttribute('y', stateY);
    stateContainer.setAttribute('width', stateBlockW);
    stateContainer.setAttribute('height', codeBlockH);
    stateContainer.setAttribute('rx', '8');
    stateContainer.setAttribute('fill', c.goroutineFill);
    stateContainer.setAttribute('stroke', c.goroutine);
    stateContainer.setAttribute('stroke-width', '1.5');
    g.appendChild(stateContainer);

    addText(g, stateX + 12, stateY + 20, '🧵 Goroutine State', c.goroutine, '11', '600');

    const stateBoxY = stateY + 35;
    const states = [
      { label: 'Running', x: stateX + 15, w: 75 },
      { label: 'Gsyscall', x: stateX + 105, w: 75 },
      { label: 'Waiting', x: stateX + 195, w: 70 }
    ];

    states.forEach((s, i) => {
      const stateBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      stateBox.setAttribute('id', `goroutine-state-${i}`);
      stateBox.setAttribute('x', s.x);
      stateBox.setAttribute('y', stateBoxY);
      stateBox.setAttribute('width', s.w);
      stateBox.setAttribute('height', 26);
      stateBox.setAttribute('rx', '4');
      // All states unselected by default
      stateBox.setAttribute('fill', c.queueEmpty);
      stateBox.setAttribute('stroke', c.textDim);
      stateBox.setAttribute('stroke-width', '1');
      g.appendChild(stateBox);

      const stateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      stateLabel.setAttribute('id', `goroutine-state-label-${i}`);
      stateLabel.setAttribute('x', s.x + s.w/2);
      stateLabel.setAttribute('y', stateBoxY + 17);
      stateLabel.setAttribute('fill', c.textMuted);
      stateLabel.setAttribute('font-size', '11');
      stateLabel.setAttribute('font-weight', '500');
      stateLabel.setAttribute('text-anchor', 'middle');
      stateLabel.textContent = s.label;
      g.appendChild(stateLabel);

      if (i < states.length - 1) {
        const arrowX1 = s.x + s.w + 3;
        const arrowX2 = states[i+1].x - 3;
        const arrowY = stateBoxY + 13;
        drawSmallArrow(g, arrowX1, arrowY, arrowX2, arrowY, c.textDim);
      }
    });

    const dividerY = stateBoxY + 40;
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', stateX + 10);
    divider.setAttribute('y1', dividerY);
    divider.setAttribute('x2', stateX + stateBlockW - 10);
    divider.setAttribute('y2', dividerY);
    divider.setAttribute('stroke', c.separator);
    divider.setAttribute('stroke-width', '1');
    g.appendChild(divider);

    addText(g, stateX + 12, dividerY + 20, '⚙️ Go Runtime Scheduler', c.runtime, '11', '600');

    const gmpY = dividerY + 35;
    
    const pBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    pBox.setAttribute('x', stateX + 15);
    pBox.setAttribute('y', gmpY);
    pBox.setAttribute('width', 110);
    pBox.setAttribute('height', 45);
    pBox.setAttribute('rx', '4');
    pBox.setAttribute('fill', c.queueEmpty);
    pBox.setAttribute('stroke', c.textDim);
    g.appendChild(pBox);
    
    addText(g, stateX + 70, gmpY + 14, 'P (Processor)', c.textMuted, '11', '500', 'middle');
    addText(g, stateX + 25, gmpY + 30, 'runq:', c.textDim, '11');
    
    for (let i = 0; i < 3; i++) {
      const qItem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      qItem.setAttribute('x', stateX + 55 + i * 18);
      qItem.setAttribute('y', gmpY + 23);
      qItem.setAttribute('width', 14);
      qItem.setAttribute('height', 14);
      qItem.setAttribute('rx', '2');
      qItem.setAttribute('fill', c.queueEmpty);
      qItem.setAttribute('stroke', c.textDim);
      qItem.setAttribute('stroke-width', '0.5');
      g.appendChild(qItem);
    }

    const syscallY = gmpY + 5;
    addText(g, stateX + 140, syscallY + 10, '⏳ Syscall', c.textMuted, '11', '500');
    
    const spinner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    spinner.setAttribute('id', 'runtime-spinner');
    spinner.setAttribute('x', stateX + stateBlockW - 25);
    spinner.setAttribute('y', syscallY + 11);
    spinner.setAttribute('fill', c.warning);
    spinner.setAttribute('font-size', '14');
    spinner.setAttribute('opacity', '0');
    spinner.textContent = '⟳';
    g.appendChild(spinner);

    addText(g, stateX + 140, syscallY + 26, 'SYS_FSYNC (74)', c.textDim, '11', '400', 'start', 'monospace');
    addText(g, stateX + 140, syscallY + 40, 'M handoff: other', c.textDim, '11');
    addText(g, stateX + 140, syscallY + 52, 'G\'s can run', c.textDim, '11');

    parent.appendChild(g);
  }

  // ========== KERNEL COMPONENTS ==========

  function renderVFSBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-vfs');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.vfsFill);
    rect.setAttribute('stroke', c.vfs);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 20, 'Virtual File System (VFS)', c.vfs, '12', '600');

    const tableX = x + 20;
    const tableY = y + 35;
    
    addText(g, tableX, tableY + 10, 'fd table:', c.textMuted, '11');
    
    const fds = ['0: stdin', '1: stdout', '2: stderr', '3: wal.log ←'];
    const fdWidths = [75, 80, 80, 110]; // wal.log wider
    let fdX = tableX + 60;
    fds.forEach((fd, i) => {
      const isTarget = i === 3;
      const fdBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      fdBox.setAttribute('id', isTarget ? 'vfs-fd-target' : `vfs-fd-${i}`);
      fdBox.setAttribute('x', fdX);
      fdBox.setAttribute('y', tableY);
      fdBox.setAttribute('width', fdWidths[i]);
      fdBox.setAttribute('height', 22);
      fdBox.setAttribute('rx', '3');
      // All unselected by default
      fdBox.setAttribute('fill', c.queueEmpty);
      fdBox.setAttribute('stroke', c.textDim);
      fdBox.setAttribute('stroke-width', '0.5');
      g.appendChild(fdBox);
      
      const fdLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      fdLabel.setAttribute('id', isTarget ? 'vfs-fd-target-label' : `vfs-fd-label-${i}`);
      fdLabel.setAttribute('x', fdX + fdWidths[i] / 2);
      fdLabel.setAttribute('y', tableY + 15);
      fdLabel.setAttribute('fill', c.textDim);
      fdLabel.setAttribute('font-size', '11');
      fdLabel.setAttribute('font-weight', '400');
      fdLabel.setAttribute('text-anchor', 'middle');
      fdLabel.setAttribute('font-family', 'monospace');
      fdLabel.textContent = fd;
      g.appendChild(fdLabel);
      
      fdX += fdWidths[i] + 8;
    });

    addText(g, tableX, tableY + 45, '📋 file_operations→fsync() dispatch to filesystem handler', c.textMuted, '11');

    parent.appendChild(g);
  }

  function renderFilesystemBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-filesystem');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.fsFill);
    rect.setAttribute('stroke', c.fs);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 20, 'Filesystem: ext4 + jbd2 Journal', c.fs, '12', '600');

    const journalX = x + 20;
    const journalY = y + 38;
    
    addText(g, journalX, journalY + 10, 'Journal Transaction:', c.textMuted, '11');
    
    const entries = ['T1', 'T2', 'T3', 'T4', 'T5'];
    entries.forEach((t, i) => {
      const entryBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      entryBox.setAttribute('id', `journal-entry-${i}`);
      entryBox.setAttribute('x', journalX + 120 + i * 45);
      entryBox.setAttribute('y', journalY);
      entryBox.setAttribute('width', 40);
      entryBox.setAttribute('height', 24);
      entryBox.setAttribute('rx', '3');
      // All unselected by default
      entryBox.setAttribute('fill', c.queueEmpty);
      entryBox.setAttribute('stroke', c.textDim);
      entryBox.setAttribute('stroke-width', '0.5');
      g.appendChild(entryBox);
      
      const entryLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      entryLabel.setAttribute('id', `journal-entry-label-${i}`);
      entryLabel.setAttribute('x', journalX + 140 + i * 45);
      entryLabel.setAttribute('y', journalY + 16);
      entryLabel.setAttribute('fill', c.textDim);
      entryLabel.setAttribute('font-size', '11');
      entryLabel.setAttribute('font-weight', '500');
      entryLabel.setAttribute('text-anchor', 'middle');
      entryLabel.textContent = t;
      g.appendChild(entryLabel);
    });

    const commitSpinner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    commitSpinner.setAttribute('id', 'journal-commit-spinner');
    commitSpinner.setAttribute('x', journalX + 360);
    commitSpinner.setAttribute('y', journalY + 16);
    commitSpinner.setAttribute('fill', c.warning);
    commitSpinner.setAttribute('font-size', '12');
    commitSpinner.setAttribute('opacity', '0');
    commitSpinner.textContent = '⏳';
    g.appendChild(commitSpinner);

    addText(g, journalX, journalY + 45, '💾 Page Cache → Dirty pages flush: filemap_write_and_wait_range()', c.textMuted, '11');

    const progressBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progressBg.setAttribute('x', journalX);
    progressBg.setAttribute('y', journalY + 55);
    progressBg.setAttribute('width', w - 50);
    progressBg.setAttribute('height', 8);
    progressBg.setAttribute('rx', '4');
    progressBg.setAttribute('fill', c.queueEmpty);
    g.appendChild(progressBg);

    const progress = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    progress.setAttribute('id', 'fs-progress');
    progress.setAttribute('x', journalX);
    progress.setAttribute('y', journalY + 55);
    progress.setAttribute('width', 0);
    progress.setAttribute('height', 8);
    progress.setAttribute('rx', '4');
    progress.setAttribute('fill', c.fs);
    g.appendChild(progress);

    parent.appendChild(g);
  }

  function renderBlockLayerBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-block');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.blockFill);
    rect.setAttribute('stroke', c.block);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 20, 'Block Layer + I/O Scheduler (mq-deadline)', c.block, '12', '600');

    const queueX = x + 20;
    const queueY = y + 38;
    
    addText(g, queueX, queueY + 10, '📥 Request Queue:', c.textMuted, '11');
    
    for (let i = 0; i < 8; i++) {
      const slot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      slot.setAttribute('id', `io-queue-slot-${i}`);
      slot.setAttribute('x', queueX + 110 + i * 55);
      slot.setAttribute('y', queueY);
      slot.setAttribute('width', 50);
      slot.setAttribute('height', 26);
      slot.setAttribute('rx', '3');
      slot.setAttribute('fill', c.queueEmpty);
      slot.setAttribute('stroke', c.textDim);
      slot.setAttribute('stroke-width', '0.5');
      g.appendChild(slot);
    }

    const schedY = queueY + 40;
    addText(g, queueX, schedY + 10, '⏰ Scheduler:', c.textMuted, '11');
    
    const clockX = queueX + 80;
    const clockCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    clockCircle.setAttribute('cx', clockX + 15);
    clockCircle.setAttribute('cy', schedY + 6);
    clockCircle.setAttribute('r', '12');
    clockCircle.setAttribute('fill', 'none');
    clockCircle.setAttribute('stroke', c.textDim);
    clockCircle.setAttribute('stroke-width', '1.5');
    g.appendChild(clockCircle);

    const clockHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    clockHand.setAttribute('id', 'scheduler-clock-hand');
    clockHand.setAttribute('x1', clockX + 15);
    clockHand.setAttribute('y1', schedY + 6);
    clockHand.setAttribute('x2', clockX + 15);
    clockHand.setAttribute('y2', schedY - 2);
    clockHand.setAttribute('stroke', c.block);
    clockHand.setAttribute('stroke-width', '2');
    clockHand.setAttribute('stroke-linecap', 'round');
    g.appendChild(clockHand);

    addText(g, clockX + 40, schedY + 10, 'Merge/Reorder requests • Deadline: 500ms reads, 5s writes', c.textMuted, '11');
    addText(g, queueX, schedY + 35, '🔄 struct bio → struct request → blk_mq_submit_bio()', c.textMuted, '11');

    parent.appendChild(g);
  }

  // ========== HARDWARE COMPONENTS ==========

  function renderNVMeBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-nvme');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.controllerFill);
    rect.setAttribute('stroke', c.controller);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 20, 'NVMe Controller', c.controller, '12', '600');

    const sqX = x + 20;
    const sqY = y + 38;
    
    addText(g, sqX, sqY + 10, 'Submission Queue (SQ):', c.textMuted, '11');
    
    const queueSlots = 8;
    const queueStartX = sqX + 180;
    const availableWidth = w - 210;
    const slotWidth = (availableWidth - (queueSlots - 1) * 6) / queueSlots;
    
    for (let i = 0; i < queueSlots; i++) {
      const slot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      slot.setAttribute('id', `nvme-sq-${i}`);
      slot.setAttribute('x', queueStartX + i * (slotWidth + 6));
      slot.setAttribute('y', sqY);
      slot.setAttribute('width', slotWidth);
      slot.setAttribute('height', 22);
      slot.setAttribute('rx', '3');
      slot.setAttribute('fill', c.queueEmpty);
      slot.setAttribute('stroke', c.textDim);
      slot.setAttribute('stroke-width', '0.5');
      g.appendChild(slot);
    }

    const cqY = sqY + 32;
    addText(g, sqX, cqY + 10, 'Completion Queue (CQ):', c.textMuted, '11');
    
    for (let i = 0; i < queueSlots; i++) {
      const slot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      slot.setAttribute('id', `nvme-cq-${i}`);
      slot.setAttribute('x', queueStartX + i * (slotWidth + 6));
      slot.setAttribute('y', cqY);
      slot.setAttribute('width', slotWidth);
      slot.setAttribute('height', 22);
      slot.setAttribute('rx', '3');
      slot.setAttribute('fill', c.queueEmpty);
      slot.setAttribute('stroke', c.textDim);
      slot.setAttribute('stroke-width', '0.5');
      g.appendChild(slot);
    }

    addText(g, sqX, cqY + 38, '⚡ Flush Command (opcode 0x00) • DMA: Host RAM → Controller DRAM', c.textMuted, '11');

    parent.appendChild(g);
  }

  function renderFTLBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-ftl');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.ftlFill);
    rect.setAttribute('stroke', c.ftl);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 20, 'Flash Translation Layer (FTL)', c.ftl, '12', '600');

    const mapX = x + 20;
    const mapY = y + 38;
    
    addText(g, mapX, mapY + 10, 'LBA → PPA Mapping:', c.textMuted, '11');
    
    const mappings = [
      { lba: '0x1000', ppa: '→ B2:P47' },
      { lba: '0x1001', ppa: '→ B2:P48' },
      { lba: '0x1002', ppa: '→ B5:P12' },
      { lba: '...', ppa: '' }
    ];
    
    const mappingWidths = [120, 120, 120, 60]; // Wider to fit text
    let entryX = mapX + 130;
    mappings.forEach((m, i) => {
      const entryBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      entryBox.setAttribute('id', `ftl-mapping-${i}`);
      entryBox.setAttribute('x', entryX);
      entryBox.setAttribute('y', mapY);
      entryBox.setAttribute('width', mappingWidths[i]);
      entryBox.setAttribute('height', 22);
      entryBox.setAttribute('rx', '3');
      // All unselected by default
      entryBox.setAttribute('fill', c.queueEmpty);
      entryBox.setAttribute('stroke', c.textDim);
      entryBox.setAttribute('stroke-width', '0.5');
      g.appendChild(entryBox);
      
      const mappingLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      mappingLabel.setAttribute('id', `ftl-mapping-label-${i}`);
      mappingLabel.setAttribute('x', entryX + mappingWidths[i] / 2);
      mappingLabel.setAttribute('y', mapY + 15);
      mappingLabel.setAttribute('fill', c.textDim);
      mappingLabel.setAttribute('font-size', '11');
      mappingLabel.setAttribute('font-weight', '400');
      mappingLabel.setAttribute('text-anchor', 'middle');
      mappingLabel.setAttribute('font-family', 'monospace');
      mappingLabel.textContent = `${m.lba} ${m.ppa}`;
      g.appendChild(mappingLabel);
      
      entryX += mappingWidths[i] + 8;
    });

    const bufY = mapY + 35;
    addText(g, mapX, bufY + 10, '📝 Write Buffer:', c.textMuted, '11');
    
    const bufBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bufBox.setAttribute('id', 'ftl-write-buffer');
    bufBox.setAttribute('x', mapX + 100);
    bufBox.setAttribute('y', bufY);
    bufBox.setAttribute('width', w - 140);
    bufBox.setAttribute('height', 22);
    bufBox.setAttribute('rx', '3');
    bufBox.setAttribute('fill', c.queueEmpty);
    bufBox.setAttribute('stroke', c.textDim);
    g.appendChild(bufBox);

    const bufFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bufFill.setAttribute('id', 'ftl-buffer-fill');
    bufFill.setAttribute('x', mapX + 101);
    bufFill.setAttribute('y', bufY + 1);
    bufFill.setAttribute('width', 0);
    bufFill.setAttribute('height', 20);
    bufFill.setAttribute('rx', '2');
    bufFill.setAttribute('fill', c.ftl);
    bufFill.setAttribute('opacity', '0.6');
    g.appendChild(bufFill);

    addText(g, mapX, bufY + 45, '⚖️ Wear Leveling + Garbage Collection active', c.textMuted, '11');

    parent.appendChild(g);
  }

  function renderNANDBlock(parent, x, y, w, h) {
    const c = config.colors;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', 'comp-nand');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', c.nandFill);
    rect.setAttribute('stroke', c.nand);
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    addText(g, x + 12, y + 18, 'NAND Flash Array (3D TLC)', c.nand, '12', '600');

    const nandX = x + 15;
    const nandY = y + 32;
    const contentW = w - 30;
    
    // === PAGE GRID - spans full width ===
    addText(g, nandX, nandY + 12, 'Block 2 (256 pages):', c.textMuted, '11');
    
    const pagesPerRow = 10;
    const pageSpacing = 6;
    const pagesStartX = nandX + 150;
    const pagesWidth = contentW - 160;
    const pageW = (pagesWidth - (pagesPerRow - 1) * pageSpacing) / pagesPerRow;
    const pageH = 28;
    const numPages = 20;
    
    for (let i = 0; i < numPages; i++) {
      const col = i % pagesPerRow;
      const row = Math.floor(i / pagesPerRow);
      const px = pagesStartX + col * (pageW + pageSpacing);
      const py = nandY + row * (pageH + 5);
      
      const page = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      page.setAttribute('id', `nand-page-${i}`);
      page.setAttribute('x', px);
      page.setAttribute('y', py);
      page.setAttribute('width', pageW);
      page.setAttribute('height', pageH);
      page.setAttribute('rx', '3');
      page.setAttribute('fill', c.queueEmpty);
      page.setAttribute('stroke', c.textDim);
      page.setAttribute('stroke-width', '1');
      g.appendChild(page);
      
      addText(g, px + pageW/2, py + pageH/2 + 4, `P${i}`, c.textDim, '11', '500', 'middle');
    }

    // Divider
    const dividerY = nandY + 72;
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', nandX);
    divider.setAttribute('y1', dividerY);
    divider.setAttribute('x2', nandX + contentW);
    divider.setAttribute('y2', dividerY);
    divider.setAttribute('stroke', c.separator);
    g.appendChild(divider);

    // === GATE DIAGRAM - uses full width ===
    const electronY = dividerY + 10;
    addText(g, nandX, electronY + 14, '⚡ How TLC NAND Programming Works:', c.text, '11', '600');
    
    const gateX = nandX + 10;
    const gateY = electronY + 32;
    const gateW = 280;
    
    // Control gate
    const controlGate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    controlGate.setAttribute('x', gateX);
    controlGate.setAttribute('y', gateY);
    controlGate.setAttribute('width', gateW);
    controlGate.setAttribute('height', 28);
    controlGate.setAttribute('rx', '4');
    controlGate.setAttribute('fill', c.textDim);
    g.appendChild(controlGate);
    addText(g, gateX + gateW/2, gateY + 18, 'Control Gate (Word Line)', isDarkMode() ? '#1a1a1a' : '#fff', '11', '600', 'middle');
    
    // Oxide 1
    const oxide1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    oxide1.setAttribute('x', gateX + 20);
    oxide1.setAttribute('y', gateY + 30);
    oxide1.setAttribute('width', gateW - 40);
    oxide1.setAttribute('height', 8);
    oxide1.setAttribute('fill', c.queueEmpty);
    oxide1.setAttribute('stroke', c.textDim);
    oxide1.setAttribute('stroke-width', '0.5');
    g.appendChild(oxide1);
    addText(g, gateX + gateW + 15, gateY + 38, '← Oxide (insulator)', c.textMuted, '11');

    // Floating gate - THE IMPORTANT ONE
    const floatingGate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    floatingGate.setAttribute('id', 'floating-gate');
    floatingGate.setAttribute('x', gateX + 20);
    floatingGate.setAttribute('y', gateY + 40);
    floatingGate.setAttribute('width', gateW - 40);
    floatingGate.setAttribute('height', 32);
    floatingGate.setAttribute('rx', '4');
    floatingGate.setAttribute('fill', c.queueEmpty);
    floatingGate.setAttribute('stroke', c.nand);
    floatingGate.setAttribute('stroke-width', '2');
    g.appendChild(floatingGate);
    addText(g, gateX + gateW/2, gateY + 60, 'Floating Gate', c.text, '12', '600', 'middle');
    addText(g, gateX + gateW + 15, gateY + 60, '← Traps electrons!', c.nand, '11', '600');

    // Tunnel oxide
    const oxide2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    oxide2.setAttribute('x', gateX + 20);
    oxide2.setAttribute('y', gateY + 74);
    oxide2.setAttribute('width', gateW - 40);
    oxide2.setAttribute('height', 8);
    oxide2.setAttribute('fill', c.queueEmpty);
    oxide2.setAttribute('stroke', c.textDim);
    oxide2.setAttribute('stroke-width', '0.5');
    g.appendChild(oxide2);
    addText(g, gateX + gateW + 15, gateY + 82, '← Tunnel oxide', c.textMuted, '11');

    // Channel
    const substrate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    substrate.setAttribute('x', gateX);
    substrate.setAttribute('y', gateY + 84);
    substrate.setAttribute('width', gateW);
    substrate.setAttribute('height', 26);
    substrate.setAttribute('rx', '4');
    substrate.setAttribute('fill', c.textDim);
    substrate.setAttribute('opacity', '0.7');
    g.appendChild(substrate);
    addText(g, gateX + gateW/2, gateY + 100, 'Channel (Silicon)', isDarkMode() ? '#d1d5db' : '#374151', '11', '600', 'middle');

    // Electrons - spread across the wider gate
    for (let i = 0; i < 8; i++) {
      const electron = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      electron.setAttribute('id', `electron-${i}`);
      electron.setAttribute('cx', gateX + 45 + i * 28);
      electron.setAttribute('cy', gateY + 95);
      electron.setAttribute('r', '5');
      electron.setAttribute('fill', c.warning);
      electron.setAttribute('stroke', '#000');
      electron.setAttribute('stroke-width', '1');
      electron.setAttribute('opacity', '0');
      g.appendChild(electron);
    }

    // === SPECS - right side ===
    const specsX = gateX + gateW + 160;
    const specsY = electronY + 30;
    
    addText(g, specsX, specsY, '📊 Performance:', c.text, '11', '600');
    addText(g, specsX, specsY + 18, '• Read: ~25μs', c.textMuted, '11');
    addText(g, specsX, specsY + 34, '• Program: ~200μs', c.textMuted, '11');
    addText(g, specsX, specsY + 50, '• Block Erase: ~2ms', c.textMuted, '11');
    
    addText(g, specsX, specsY + 76, '📐 TLC Architecture:', c.text, '11', '600');
    addText(g, specsX, specsY + 94, '• 3 bits/cell', c.textMuted, '11');
    addText(g, specsX, specsY + 110, '• 8 voltage levels', c.textMuted, '11');
    addText(g, specsX, specsY + 126, '• Page: 16KB', c.textMuted, '11');

    parent.appendChild(g);
  }

  // ========== HELPER FUNCTIONS ==========

  function addText(parent, x, y, content, fill, size, weight = '400', anchor = 'start', family = null) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('fill', fill);
    text.setAttribute('font-size', size);
    text.setAttribute('font-weight', weight);
    text.setAttribute('text-anchor', anchor);
    if (family) text.setAttribute('font-family', family);
    text.textContent = content;
    parent.appendChild(text);
    return text;
  }

  function drawArrow(parent, x1, y1, x2, y2, color) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('marker-end', 'url(#arrow-down)');
    line.setAttribute('opacity', '0.6');
    parent.appendChild(line);
  }

  function drawArrowWithLabel(parent, x1, y1, x2, y2, label, color) {
    drawArrow(parent, x1, y1, x2, y2, color);
    
    const midY = (y1 + y2) / 2;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x1 + 10);
    text.setAttribute('y', midY);
    text.setAttribute('fill', color);
    text.setAttribute('font-size', '9');
    text.setAttribute('opacity', '0.8');
    text.textContent = label;
    parent.appendChild(text);
  }

  function drawSmallArrow(parent, x1, y1, x2, y2, color) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1');
    line.setAttribute('marker-end', 'url(#arrow-down)');
    parent.appendChild(line);
  }

  // ========== SELECTION HELPERS ==========
  
  function selectGoroutineState(index) {
    const c = config.colors;
    // Deselect all first
    for (let i = 0; i < 3; i++) {
      const box = svg.querySelector(`#goroutine-state-${i}`);
      const label = svg.querySelector(`#goroutine-state-label-${i}`);
      if (box && label) {
        box.setAttribute('fill', c.queueEmpty);
        box.setAttribute('stroke', c.textDim);
        label.setAttribute('fill', c.textMuted);
      }
    }
    // Select the target
    const box = svg.querySelector(`#goroutine-state-${index}`);
    const label = svg.querySelector(`#goroutine-state-label-${index}`);
    if (box && label) {
      box.setAttribute('fill', c.data);
      box.setAttribute('stroke', c.data);
      label.setAttribute('fill', isDarkMode() ? '#1a1a1a' : '#fff');
    }
  }

  function selectCodeHighlight(show) {
    const highlight = svg.querySelector('#code-highlight');
    if (highlight) {
      highlight.setAttribute('opacity', show ? '1' : '0');
    }
  }

  function selectWalLogFd(selected) {
    const c = config.colors;
    const box = svg.querySelector('#vfs-fd-target');
    const label = svg.querySelector('#vfs-fd-target-label');
    if (box && label) {
      box.setAttribute('fill', selected ? c.queueItem : c.queueEmpty);
      box.setAttribute('stroke', selected ? c.data : c.textDim);
      box.setAttribute('stroke-width', selected ? '1.5' : '0.5');
      label.setAttribute('fill', selected ? c.data : c.textDim);
      label.setAttribute('font-weight', selected ? '600' : '400');
    }
  }

  function selectJournalT5(selected) {
    const c = config.colors;
    const box = svg.querySelector('#journal-entry-4');
    const label = svg.querySelector('#journal-entry-label-4');
    if (box && label) {
      box.setAttribute('fill', selected ? c.queueItem : c.queueEmpty);
      box.setAttribute('stroke', selected ? c.warning : c.textDim);
      box.setAttribute('stroke-width', selected ? '1.5' : '0.5');
      label.setAttribute('fill', selected ? c.warning : c.textDim);
    }
  }

  function selectFtlMapping0(selected) {
    const c = config.colors;
    const box = svg.querySelector('#ftl-mapping-0');
    const label = svg.querySelector('#ftl-mapping-label-0');
    if (box && label) {
      box.setAttribute('fill', selected ? c.queueItem : c.queueEmpty);
      box.setAttribute('stroke', selected ? c.ftl : c.textDim);
      box.setAttribute('stroke-width', selected ? '1.5' : '0.5');
      label.setAttribute('fill', selected ? c.ftl : c.textDim);
    }
  }

  function fillNVMeCompletionQueue() {
    const c = config.colors;
    const cqSlot = svg.querySelector('#nvme-cq-0');
    if (cqSlot) {
      cqSlot.setAttribute('fill', c.success);
      cqSlot.setAttribute('stroke', c.success);
    }
  }

  function resetSelectableElements() {
    selectCodeHighlight(false);
    // Goroutine states - all unselected
    const c = config.colors;
    for (let i = 0; i < 3; i++) {
      const box = svg.querySelector(`#goroutine-state-${i}`);
      const label = svg.querySelector(`#goroutine-state-label-${i}`);
      if (box && label) {
        box.setAttribute('fill', c.queueEmpty);
        box.setAttribute('stroke', c.textDim);
        label.setAttribute('fill', c.textMuted);
      }
    }
    selectWalLogFd(false);
    selectJournalT5(false);
    selectFtlMapping0(false);
    // Reset NVMe CQ
    const cqSlot = svg.querySelector('#nvme-cq-0');
    if (cqSlot) {
      cqSlot.setAttribute('fill', c.queueEmpty);
      cqSlot.setAttribute('stroke', c.textDim);
    }
  }

  function setupControls() {
    const playBtn = container.querySelector('#fsync-play-btn');
    const resetBtn = container.querySelector('#fsync-reset-btn');

    playBtn.addEventListener('click', () => {
      if (!state.isAnimating) {
        runFsyncAnimation();
      }
    });

    resetBtn.addEventListener('click', resetAnimation);
  }

  function setButtonsLocked(locked) {
    const playBtn = container.querySelector('#fsync-play-btn');
    playBtn.disabled = locked;
    playBtn.style.opacity = locked ? '0.5' : '1';
    playBtn.style.cursor = locked ? 'not-allowed' : 'pointer';
  }

  function updateStatus(html, borderColor) {
    const c = config.colors;
    const statusEl = container.querySelector('#fsync-status');
    const textEl = container.querySelector('#fsync-status-text');
    textEl.innerHTML = html;
    statusEl.style.borderLeftColor = borderColor || c.textDim;
  }

  // ========== ANIMATION ==========

  async function runFsyncAnimation() {
    // Reset everything first if this is a re-run
    if (state.hasRun) {
      resetSelectableElements();
      resetHighlights();
    }
    
    state.isAnimating = true;
    state.hasRun = true;
    setButtonsLocked(true);
    const c = config.colors;

    // Start with Running state selected and code highlight
    selectGoroutineState(0);
    selectCodeHighlight(true);
    await sleep(200);

    await animateStep1_Goroutine();
    await animateStep2_Runtime();
    await animateStep3_VFS();
    await animateStep4_Filesystem();
    await animateStep5_BlockLayer();
    await animateStep6_NVMe();
    await animateStep7_FTL();
    await animateStep8_NAND();
    await animateCompletion();

    state.isAnimating = false;
    setButtonsLocked(false);
  }

  async function animateStep1_Goroutine() {
    const c = config.colors;
    
    highlightComponent('comp-userspace');
    
    updateStatus(
      `<strong>1️⃣ Goroutine State Transition</strong><br/>
       The goroutine calling <code>f.Sync()</code> transitions from <span style="color:${c.data}">Running</span> → <span style="color:${c.warning}">Gsyscall</span>. 
       The Go scheduler notes this G is blocked on a syscall.`,
      c.goroutine
    );

    await sleep(config.stepDelay);

    // Transition: Running → Gsyscall
    const state0 = svg.querySelector('#goroutine-state-0');
    const state0Label = svg.querySelector('#goroutine-state-label-0');
    const state1 = svg.querySelector('#goroutine-state-1');
    const state1Label = svg.querySelector('#goroutine-state-label-1');
    
    // Deselect Running
    await animate(state0, {
      fill: c.queueEmpty,
      stroke: c.textDim,
      duration: 300
    }).finished;
    if (state0Label) state0Label.setAttribute('fill', c.textMuted);

    // Select Gsyscall (with warning color)
    await animate(state1, {
      fill: c.warning,
      stroke: c.warning,
      duration: 300
    }).finished;
    if (state1Label) state1Label.setAttribute('fill', isDarkMode() ? '#1a1a1a' : '#fff');

    await sleep(config.stepDelay);
  }

  async function animateStep2_Runtime() {
    const c = config.colors;
    
    updateStatus(
      `<strong>2️⃣ Go Runtime Syscall Handoff</strong><br/>
       <span style="color:${c.warning}">⏳ Blocking syscall detected!</span> The runtime releases the M (OS thread) 
       so other goroutines can run. Executing <code>SYSCALL</code> instruction to enter kernel mode.`,
      c.runtime
    );

    const spinner = svg.querySelector('#runtime-spinner');
    spinner.setAttribute('opacity', '1');
    
    let rotation = 0;
    const spinnerAnim = setInterval(() => {
      rotation += 45;
      spinner.setAttribute('transform', `rotate(${rotation}, ${parseFloat(spinner.getAttribute('x')) + 7}, ${parseFloat(spinner.getAttribute('y')) - 5})`);
    }, 100);

    await sleep(config.stepDelay * 2);
    
    clearInterval(spinnerAnim);
    spinner.setAttribute('opacity', '0');

    await sleep(config.stepDelay);
  }

  async function animateStep3_VFS() {
    const c = config.colors;
    
    highlightComponent('comp-vfs');
    
    updateStatus(
      `<strong>3️⃣ VFS File Descriptor Lookup</strong><br/>
       Kernel looks up fd=3 in process file descriptor table → finds <code>struct file</code> for wal.log. 
       Dispatches to <code>ext4_sync_file()</code> via <code>file_operations->fsync</code>.`,
      c.vfs
    );

    // Select wal.log fd when syscall arrives at kernel
    selectWalLogFd(true);
    
    const fdTarget = svg.querySelector('#vfs-fd-target');
    
    await animate(fdTarget, {
      strokeWidth: [1.5, 3, 1.5],
      duration: 600
    }).finished;

    await sleep(config.stepDelay);
  }

  async function animateStep4_Filesystem() {
    const c = config.colors;
    
    highlightComponent('comp-filesystem');
    
    updateStatus(
      `<strong>4️⃣ ext4 Journal Commit</strong><br/>
       <span style="color:${c.warning}">⏳ Committing transaction T5...</span> 
       Journal barrier ensures ordering. Then flushing dirty pages from page cache to disk.`,
      c.fs
    );

    const commitSpinner = svg.querySelector('#journal-commit-spinner');
    commitSpinner.setAttribute('opacity', '1');

    // Select T5 first
    selectJournalT5(true);
    
    await sleep(config.stepDelay);

    const journalEntry = svg.querySelector('#journal-entry-4');
    const journalLabel = svg.querySelector('#journal-entry-label-4');
    await animate(journalEntry, {
      fill: c.success,
      stroke: c.success,
      duration: 400
    }).finished;
    if (journalLabel) journalLabel.setAttribute('fill', isDarkMode() ? '#1a1a1a' : '#fff');

    commitSpinner.textContent = '✓';

    await sleep(config.stepDelay);

    const progress = svg.querySelector('#fs-progress');
    const contentW = config.width - 110;
    
    await animate(progress, {
      width: [0, contentW],
      duration: 800,
      ease: 'linear'
    }).finished;

    await sleep(config.stepDelay);
  }

  async function animateStep5_BlockLayer() {
    const c = config.colors;
    
    highlightComponent('comp-block');
    
    updateStatus(
      `<strong>5️⃣ Block Layer I/O Queue</strong><br/>
       <span style="color:${c.block}">📥 Queueing request...</span> 
       Converting bio to request, scheduler may merge with adjacent I/O. 
       <span style="color:${c.warning}">⏰ Deadline enforcement active.</span>`,
      c.block
    );

    for (let i = 0; i < 3; i++) {
      const slot = svg.querySelector(`#io-queue-slot-${i}`);
      await animate(slot, {
        fill: [c.queueEmpty, c.queueItem],
        stroke: [c.textDim, c.block],
        duration: 200
      }).finished;
      await sleep(100);
    }

    const clockHand = svg.querySelector('#scheduler-clock-hand');
    const cx = parseFloat(clockHand.getAttribute('x1'));
    const cy = parseFloat(clockHand.getAttribute('y1'));
    
    for (let angle = 0; angle <= 360; angle += 30) {
      const rad = (angle - 90) * Math.PI / 180;
      const x2 = cx + Math.cos(rad) * 8;
      const y2 = cy + Math.sin(rad) * 8;
      clockHand.setAttribute('x2', x2);
      clockHand.setAttribute('y2', y2);
      await sleep(50);
    }

    await sleep(config.stepDelay);
  }

  async function animateStep6_NVMe() {
    const c = config.colors;
    
    highlightComponent('comp-nvme');
    
    updateStatus(
      `<strong>6️⃣ NVMe Submission Queue</strong><br/>
       <span style="color:${c.controller}">⚡ Doorbell ring!</span> 
       Command placed in Submission Queue. Controller DMAs data from host memory. 
       Flush command ensures write-through to media.`,
      c.controller
    );

    const sq0 = svg.querySelector('#nvme-sq-0');
    await animate(sq0, {
      fill: c.queueItem,
      stroke: c.controller,
      strokeWidth: 1.5,
      duration: 300
    }).finished;

    await sleep(config.stepDelay);

    updateStatus(
      `<strong>6️⃣ NVMe Processing...</strong><br/>
       Controller processing Flush command. Waiting for completion interrupt...`,
      c.controller
    );

    await sleep(config.stepDelay);
  }

  async function animateStep7_FTL() {
    const c = config.colors;
    
    highlightComponent('comp-ftl');
    
    updateStatus(
      `<strong>7️⃣ Flash Translation Layer</strong><br/>
       <span style="color:${c.ftl}">🗺️ LBA→PPA lookup:</span> Logical Block 0x1000 maps to Physical Block 2, Page 47. 
       Data staged in write buffer before NAND programming.`,
      c.ftl
    );

    // Select the first mapping entry
    selectFtlMapping0(true);
    
    const mapping0 = svg.querySelector('#ftl-mapping-0');
    await animate(mapping0, {
      strokeWidth: [1.5, 3, 1.5],
      duration: 500
    }).finished;

    await sleep(config.stepDelay);

    const bufferFill = svg.querySelector('#ftl-buffer-fill');
    const maxWidth = config.width - 200;
    
    await animate(bufferFill, {
      width: [0, maxWidth * 0.3],
      duration: 400
    }).finished;

    await sleep(config.stepDelay);
  }

  async function animateStep8_NAND() {
    const c = config.colors;
    
    highlightComponent('comp-nand');
    
    updateStatus(
      `<strong>8️⃣ NAND Flash Programming</strong><br/>
       <span style="color:${c.nand}">⚡ High voltage applied!</span> 
       Electrons tunnel through oxide into floating gate. 
       Page program takes ~200μs. <strong>Data is now non-volatile!</strong>`,
      c.nand
    );

    const targetPage = svg.querySelector('#nand-page-7');
    
    await animate(targetPage, {
      fill: [c.queueEmpty, c.warning, c.success],
      stroke: [c.textDim, c.nand, c.success],
      duration: 600
    }).finished;

    const floatingGate = svg.querySelector('#floating-gate');
    
    for (let i = 0; i < 8; i++) {
      const electron = svg.querySelector(`#electron-${i}`);
      if (!electron) continue;
      const startY = parseFloat(electron.getAttribute('cy'));
      
      await animate(electron, {
        opacity: [0, 1],
        cy: [startY, startY - 38],
        duration: 150,
        ease: 'outQuad'
      }).finished;
    }

    await animate(floatingGate, {
      fill: c.warning,
      duration: 300
    }).finished;

    await sleep(config.stepDelay);
  }

  async function animateCompletion() {
    const c = config.colors;

    // Step 1: Update completion queue first
    updateStatus(
      `<strong>9️⃣ NVMe Completion</strong><br/>
       <span style="color:${c.success}">✓ NVMe completion interrupt received!</span> 
       Controller reports write is committed to persistent storage.`,
      c.controller
    );
    
    const cq0 = svg.querySelector('#nvme-cq-0');
    await animate(cq0, {
      fill: c.success,
      stroke: c.success,
      duration: 300
    }).finished;

    await sleep(config.stepDelay * 1.5); // Longer delay before final completion

    // Step 2: Reset highlights and show final state
    resetHighlights();

    updateStatus(
      `<strong>✅ fsync() Complete!</strong><br/>
       Return code 0 (success). 
       Data is <span style="color:${c.success}"><strong>guaranteed durable</strong></span> — survives power loss, crash, or kernel panic. 
       Goroutine unblocked and resumes execution.`,
      c.success
    );

    // Step 3: Transition goroutine state back (Gsyscall → Running/Success)
    const state1 = svg.querySelector('#goroutine-state-1');
    const state1Label = svg.querySelector('#goroutine-state-label-1');
    const state0 = svg.querySelector('#goroutine-state-0');
    const state0Label = svg.querySelector('#goroutine-state-label-0');
    
    await sleep(400);

    // Deselect Gsyscall
    await animate(state1, {
      fill: c.queueEmpty,
      stroke: c.textDim,
      duration: 300
    }).finished;
    if (state1Label) state1Label.setAttribute('fill', c.textMuted);

    // Select Running with success color (return nil)
    await animate(state0, {
      fill: c.success,
      stroke: c.success,
      duration: 300
    }).finished;
    if (state0Label) state0Label.setAttribute('fill', isDarkMode() ? '#1a1a1a' : '#fff');

    await sleep(config.stepDelay);
  }

  function resetAnimation() {
    state.isAnimating = false;
    state.hasRun = false;
    setButtonsLocked(false);
    resetHighlights();
    renderStaticComponents();
    // After re-rendering, reset selectable elements to default state
    resetSelectableElements();
    updateStatus('Click <strong>file.Sync()</strong> to trace the fsync journey through the I/O stack');
  }

  function playEntranceAnimation() {
    const groups = svg.querySelectorAll('g[id^="comp-"]');
    animate(groups, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(60),
      duration: 500,
      ease: 'outQuad'
    });
  }

  function setupThemeObserver() {
    themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-mode') {
          rebuildForTheme();
        }
      });
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode']
    });
  }

  function rebuildForTheme() {
    if (!container) return;
    const wasAnimating = state.isAnimating;
    
    container.innerHTML = buildHTML();
    svg = container.querySelector('#fsync-svg');
    
    setupControls();
    renderStaticComponents();
    
    if (!wasAnimating) {
      playEntranceAnimation();
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  window.FsyncDemo = { init };

})();
