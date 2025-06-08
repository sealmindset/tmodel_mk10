/**
 * Error catcher utility that will log errors in more detail to help debug syntax issues
 */
window.addEventListener('error', function(event) {
  console.log('=== JAVASCRIPT ERROR DETECTED ===');
  console.log('Error message:', event.message);
  console.log('File:', event.filename);
  console.log('Line:', event.lineno);
  console.log('Column:', event.colno);
  console.log('Error object:', event.error);
  
  if (event.error && event.error.stack) {
    console.log('Stack trace:', event.error.stack);
  }
  
  // Create a visual error display for easier debugging
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.right = '0';
  errorDiv.style.backgroundColor = '#ff0000';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '10px';
  errorDiv.style.zIndex = '9999';
  errorDiv.style.fontFamily = 'monospace';
  errorDiv.style.fontSize = '14px';
  errorDiv.style.whiteSpace = 'pre-wrap';
  
  const errorDetails = `JAVASCRIPT ERROR:
    Message: ${event.message}
    File: ${event.filename}
    Line: ${event.lineno}, Column: ${event.colno}`;
    
  errorDiv.textContent = errorDetails;
  document.body.appendChild(errorDiv);
});
