/**
 * Rapid7 Service Worker
 * 
 * This service worker intercepts all requests to the Rapid7 API in development environments
 * and returns mock responses to prevent console errors.
 */

// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/js/rapid7-service-worker.js', {
      scope: '/'
    }).then(function(registration) {
      console.log('Rapid7 Service Worker registered with scope:', registration.scope);
    }).catch(function(error) {
      console.log('Rapid7 Service Worker registration failed:', error);
    });
  });
}

// Mock data for vulnerabilities
const mockVulnerabilities = [
  {
    id: 'vuln-001',
    name: 'Mock SQL Injection',
    severity: 'Critical',
    status: 'Open',
    component_name: 'Database',
    description: 'This is a mock vulnerability for development purposes'
  },
  {
    id: 'vuln-002',
    name: 'Mock XSS',
    severity: 'High',
    status: 'Open',
    component_name: 'Frontend',
    description: 'This is a mock vulnerability for development purposes'
  }
];

// Service worker install event
self.addEventListener('install', function(event) {
  console.log('Rapid7 Service Worker installed');
  self.skipWaiting();
});

// Service worker activate event
self.addEventListener('activate', function(event) {
  console.log('Rapid7 Service Worker activated');
  return self.clients.claim();
});

// Service worker fetch event
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  // Check if this is a Rapid7 API request
  if (url.hostname === 'localhost' && url.port === '3100') {
    console.log('Intercepted Rapid7 API request:', url.pathname);
    
    // Return a mock response
    event.respondWith(
      new Response(
        JSON.stringify({
          success: true,
          data: mockVulnerabilities
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    );
    return;
  }
});
