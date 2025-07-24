// Wrapper script to maintain legacy path `/public/js/reports.js`
// It simply loads the updated vanilla JS implementation (reports-app-vanilla-fixed.js)
// and ensures `createReportsApp` is invoked once the script is ready.

// Provide a global stub immediately to avoid ReferenceError from inline scripts
if (!window.createReportsApp) {
  window.createReportsApp = function () {
    window.__createReportsAppQueued = true;
  };
}

document.addEventListener('DOMContentLoaded', function () {
  // Provide a temporary stub so inline HTML can call it before the real script is loaded
  if (!window.createReportsApp) {
    window.createReportsApp = function () {
      // queue call until real implementation loads
      window.__createReportsAppQueued = true;
    };
  }
  // Ensure container div exists
  if (!document.getElementById('reports-app')) {
    const c = document.createElement('div');
    c.id = 'reports-app';
    document.body.appendChild(c);
  }
  const legacyInit = () => {
    if (typeof createReportsApp === 'function') {
      createReportsApp();
    } else {
      console.error('createReportsApp is not defined after loading the reports script.');
    }
  };

  const injected = document.createElement('script');
  injected.src = '/public/js/reports-app-vanilla-fixed.js';
  injected.onload = function () {
    if (typeof createReportsApp === 'function') {
      // If initial inline call queued, run once; otherwise run immediately.
      if (window.__createReportsAppQueued) {
        delete window.__createReportsAppQueued;
      }
      createReportsApp();
    }
    legacyInit();
  };
  injected.onerror = () => {
    console.error('Failed to load /public/js/reports-app-vanilla-fixed.js');
  };
  document.head.appendChild(injected);
});
