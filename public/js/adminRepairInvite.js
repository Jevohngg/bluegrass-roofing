// public/js/adminRepairInvite.js

(()=>{
    const btn      = document.getElementById('btnInviteRepair');
    const modal    = new bootstrap.Modal(document.getElementById('repairInviteModal'));
    const form     = document.getElementById('repairInviteForm');
    if(!btn) return;
  
    btn.addEventListener('click', ()=>modal.show());
  
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const fd   = new FormData(form);
      const dur  = fd.get('durationDays');
      const uid  = location.pathname.split('/').pop();     // /admin/customer/:id
  
      const res  = await fetch(`/admin/customer/${uid}/repair-invite`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ durationDays:+dur })
      });
      if(!res.ok) return alert('Server error');
      modal.hide();

      /* Preserve any existing query params & add inviteSuccess=1 */
      const url   = new URL(location.href);
      url.searchParams.set('inviteSuccess', '1');
      location.href = url.toString();
    });
  })();
  