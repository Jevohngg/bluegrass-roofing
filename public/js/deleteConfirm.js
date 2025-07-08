// public/js/deleteConfirm.js
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('submit', e => {
      if (e.target.matches('form.delete-est, form.delete-prop')) {
        if (!confirm('Delete this item permanently? This cannot be undone.')) {
          e.preventDefault();
        }
      }
    });
  });
  