// public/js/signup.js

document.addEventListener('DOMContentLoaded', () => {
    // Grab the signup container element
    const container = document.getElementById('signup-page-container');
    
    if (container) {
      // Get the error message from the data attribute
      const errorMessage = container.dataset.error;
      // If there's an error string, call showAlert
      if (errorMessage) {
        showAlert(errorMessage, 'error', 5000); 
        // 5000 ms = show for 5 seconds (adjust as needed)
      }
    }
  });
  