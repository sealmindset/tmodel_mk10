// RTG Modal: 65vh panel, centered on open, draggable via header, internal scroll only
(() => {
  const modal = document.getElementById('rtg-modal');
  // Run again on dynamic mounts
  const init = () => {
    const m = document.getElementById('rtg-modal');
    if (!m) return;
    const panel = m.querySelector('.modal__panel');
    const header = m.querySelector('.modal__header');
    const body = m.querySelector('.modal__body');
    if (!panel || !header || !body) return;

    // Scrollbar width fallback (sets --sbw)
    const setScrollbarWidthVar = () => {
      const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.documentElement.style.setProperty('--sbw', sbw + 'px');
    };
    setScrollbarWidthVar();
    window.addEventListener('resize', setScrollbarWidthVar);

    // Center helper
    const centerPanel = () => {
      panel.style.top = '50%';
      panel.style.left = '50%';
      panel.style.transform = 'translate(-50%, -50%)';
    };

    // Listen for app events
    document.addEventListener('rtg-modal:open', centerPanel);
    document.addEventListener('rtg-modal:close', centerPanel);

    // Center immediately if visible
    const cs = getComputedStyle(panel);
    if (cs.display !== 'none' && cs.visibility !== 'hidden') centerPanel();

    // Dragging
    let dragging = false;
    let startX = 0, startY = 0, startTop = 0, startLeft = 0;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    const onPointerDown = (e) => {
      // Allow header or a child with [data-drag-handle]
      if (!(e.target.closest('[data-drag-handle]') || e.currentTarget === header)) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startTop = rect.top;
      startLeft = rect.left;
      panel.style.transform = 'none';
      panel.style.top = `${startTop}px`;
      panel.style.left = `${startLeft}px`;
      panel.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = panel.getBoundingClientRect();
      let nextLeft = startLeft + dx;
      let nextTop = startTop + dy;
      nextLeft = clamp(nextLeft, 0, vw - rect.width);
      nextTop = clamp(nextTop, 0, vh - rect.height);
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
    };

    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      panel.releasePointerCapture?.(e.pointerId);
    };

    header.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Initial attempt (in case modal exists now)
  init();

  // Also re-run when DOM updates (MutationObserver) since modal is injected dynamically
  const mo = new MutationObserver(() => init());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
