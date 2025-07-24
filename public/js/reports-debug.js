// Minimal debug script for reports app

console.log('Debug script loaded successfully');

// Create a visual indicator
const debugIndicator = document.createElement('div');
debugIndicator.style.position = 'fixed';
debugIndicator.style.top = '10px';
debugIndicator.style.right = '10px';
debugIndicator.style.padding = '10px';
debugIndicator.style.background = 'green';
debugIndicator.style.color = 'white';
debugIndicator.style.zIndex = '9999';
debugIndicator.style.borderRadius = '5px';
debugIndicator.textContent = 'Debug script loaded';
document.body.appendChild(debugIndicator);

// Check for the reports-app container
const reportsApp = document.getElementById('reports-app');
if (reportsApp) {
  console.log('Found reports-app container');
  reportsApp.innerHTML += '<div class="alert alert-info">Reports debug script connected!</div>';
} else {
  console.error('Could not find reports-app container');
  document.body.innerHTML += '<div style="color: red; margin: 20px;">ERROR: Could not find reports-app container!</div>';
}

// Test fetch function for PostgREST
try {
  fetch('http://localhost:3010/report')
    .then(response => {
      console.log('PostgREST response:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('PostgREST data:', data);
    })
    .catch(error => {
      console.error('PostgREST fetch error:', error);
    });
} catch (e) {
  console.error('Fetch execution error:', e);
}
