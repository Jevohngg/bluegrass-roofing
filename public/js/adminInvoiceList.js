// public/js/adminInvoiceList.js
document.addEventListener('DOMContentLoaded', () => {
    const srcTypeSel = document.querySelector('select[name="sourceType"]');
    const userSel    = document.querySelector('select[name="userId"]');
    const srcSel     = document.querySelector('select[name="sourceId"]');
  
    async function populateSources() {
      // reset
      srcSel.innerHTML = '<option value="">-- Select Proposal/Estimate --</option>';
      const userId = userSel.value;
      const type   = srcTypeSel.value;
      if (!userId || !type || type==='blank') return;
  
      // choose the right API
      const base = type === 'proposal' ? '/api/proposal' : '/api/estimate';
      try {
        const res = await fetch(`${base}?userId=${userId}`);
        const items = await res.json();
        items.forEach(item => {
          const amount = type === 'proposal'
            ? (item.estimateId?.totals?.subtotal || 0).toFixed(2)
            : (item.totals.subtotal || 0).toFixed(2);
          const txt = `${item.title || '—'} — $${amount}`;
          const opt = document.createElement('option');
          opt.value = item._id;
          opt.textContent = txt;
          srcSel.appendChild(opt);
        });
      } catch (err) {
        console.error('Failed to load proposals/estimates:', err);
      }
    }
  
    // refill whenever client or source‐type changes
    srcTypeSel.addEventListener('change', populateSources);
    userSel.addEventListener('change', populateSources);
  });
  