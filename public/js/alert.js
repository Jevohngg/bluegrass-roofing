// public/js/alert.js

(function () {
    /**
     * showAlert(message, type, duration)
     * @param {string} message - The text to display in the alert.
     * @param {string} [type='info'] - One of 'info', 'success', 'warning', or 'error'.
     * @param {number} [duration=3000] - How long (in milliseconds) the alert should be visible.
     */
    function showAlert(message, type = 'info', duration = 3000) {
      // Ensure there is a container in the document body for alerts.
      let container = document.getElementById('alert-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'alert-container';
        document.body.appendChild(container);
      }
      
      // Create the alert element.
      const alertElem = document.createElement('div');
      alertElem.className = `alert alert-${type}`;
      alertElem.textContent = message;
      
      // Append the alert to the container.
      container.appendChild(alertElem);
      
      // Use a slight delay to allow CSS transitions to kick in.
      setTimeout(() => {
        alertElem.classList.add('show');
      }, 10);
      
      // Remove the alert after the specified duration.
      setTimeout(() => {
        alertElem.classList.remove('show');
        // Remove from the DOM after the fade-out transition (300ms)
        setTimeout(() => {
          if (alertElem.parentNode === container) {
            container.removeChild(alertElem);
          }
        }, 300);
      }, duration);
    }
    
    // Expose the function globally.
    window.showAlert = showAlert;
  })();
  