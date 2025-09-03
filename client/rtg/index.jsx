import React from 'react';
import ReactDOM from 'react-dom/client';
import RtgApp from './RtgApp.jsx';

function mount() {
  try {
    console.log('[RTG] index.jsx: mount() called');
    const rootEl = document.getElementById('rtg-root');
    if (!rootEl) {
      console.error('[RTG] index.jsx: #rtg-root not found');
      return;
    }
    const root = ReactDOM.createRoot(rootEl);
    root.render(
      React.createElement(RtgApp)
    );
    console.log('[RTG] index.jsx: React app rendered');
  } catch (e) {
    console.error('[RTG] index.jsx: mount error', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[RTG] index.jsx: DOMContentLoaded');
    mount();
  });
} else {
  console.log('[RTG] index.jsx: document readyState != loading, mounting immediately');
  mount();
}

// Expose for manual debugging from console
window.__RTG_mount = mount;

export default RtgApp;
