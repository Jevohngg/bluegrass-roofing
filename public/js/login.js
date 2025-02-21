document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('login-page-container');
  if (container) {
    const errorMessage = container.dataset.error;
    const successMessage = container.dataset.success;

    if (errorMessage) {
      showAlert(errorMessage, 'error', 5000);
    }
    if (successMessage) {
      showAlert(successMessage, 'success', 5000);
    }
  }
});
