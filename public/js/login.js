// public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('login-page-container');
    if (container) {
      const errorMessage = container.dataset.error;
      if (errorMessage) {
        showAlert(errorMessage, 'error', 5000);
      }
    }
  });
  