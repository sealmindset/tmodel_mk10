/**
 * Password visibility toggle functionality
 * Allows showing/hiding password fields and logging values when needed
 */
document.addEventListener('DOMContentLoaded', function() {
  // Function to toggle password visibility
  function togglePasswordVisibility(inputId) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
    
    const currentType = passwordInput.getAttribute('type');
    
    // Toggle between password and text
    if (currentType === 'password') {
      passwordInput.setAttribute('type', 'text');
    } else {
      passwordInput.setAttribute('type', 'password');
    }
  }
  
  // Function to log password value (for debugging)
  function logPasswordValue(inputId) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
    
    console.log(`Password value for ${inputId}:`, passwordInput.value);
  }
  
  // Setup event listeners for all password toggle buttons
  const passwordToggles = document.querySelectorAll('.password-toggle');
  
  passwordToggles.forEach(toggle => {
    const targetId = toggle.getAttribute('data-target');
    if (!targetId) return;
    
    // Set initial button state
    const icon = toggle.querySelector('i');
    if (icon) {
      icon.classList.add('fa-eye');
      icon.classList.remove('fa-eye-slash');
    }
    
    // Add click handler
    toggle.addEventListener('click', function() {
      // Toggle visibility
      togglePasswordVisibility(targetId);
      
      // Update icon
      if (icon) {
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
      }
      
      // Log value to console (uncomment when debugging)
      // logPasswordValue(targetId);
    });
  });
  
  // General function to read any password field (can be called from console)
  window.readPasswordField = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) {
      console.error(`Input with ID ${inputId} not found`);
      return null;
    }
    
    console.log(`Value of ${inputId}:`, input.value);
    return input.value;
  };
  
  // Add event listener to the specific userPass field if requested
  const userPassInput = document.getElementById('userPass');
  if (userPassInput) {
    userPassInput.addEventListener('input', function() {
      console.log('Current userPass value:', userPassInput.value);
    });
  }
  
  // Add a global password-toggle utility to any page
  document.addEventListener('keydown', function(e) {
    // Alt+Shift+P shortcut to toggle visibility of all password fields
    if (e.altKey && e.shiftKey && e.key === 'P') {
      document.querySelectorAll('input[type="password"]').forEach(input => {
        input.type = 'text';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          input.type = 'password';
        }, 3000);
      });
      
      console.log('Password fields visible for 3 seconds');
    }
  });
  
  console.log('Password visibility toggle functionality initialized');
});
