/**
 * Debug helper to identify EJS JavaScript syntax errors
 */
window.addEventListener('error', function(e) {
  console.log('=== JAVASCRIPT ERROR ===');
  console.log('Message:', e.message);
  console.log('Filename:', e.filename);
  console.log('Line:', e.lineno);
  console.log('Column:', e.colno);
  
  // Create visible error message
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.right = '0';
  errorDiv.style.padding = '20px';
  errorDiv.style.backgroundColor = 'red';
  errorDiv.style.color = 'white';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.fontSize = '18px';
  errorDiv.innerHTML = `<strong>JavaScript Error</strong><br>
    ${e.message}<br>
    At line ${e.lineno}, column ${e.colno}<br>
    File: ${e.filename}`;
  document.body.appendChild(errorDiv);
  
  try {
    // Make an AJAX request to print the line content to the console
    const xhr = new XMLHttpRequest();
    xhr.open('GET', e.filename, true);
    xhr.onload = function() {
      if (xhr.status === 200) {
        const lines = xhr.responseText.split('\n');
        console.log('=== ERROR CONTEXT ===');
        // Print a few lines before and after the error
        for (let i = Math.max(0, e.lineno - 5); i < Math.min(lines.length, e.lineno + 5); i++) {
          console.log(`${i+1}: ${lines[i]}`);
        }
      }
    };
    xhr.send();
  } catch (err) {
    console.log('Could not load file content:', err);
  }
});
