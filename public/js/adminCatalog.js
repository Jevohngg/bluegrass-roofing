/* public/js/adminCatalog.js */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this item?')) return;
        fetch(`/admin/catalog/${btn.dataset.id}`, { method: 'DELETE' })
          .then(r => r.json())
          .then(({ success }) => {
            if (success) btn.closest('tr').remove();
            else alert('Delete failed.');
          })
          .catch(console.error);
      });
    });
  });
  