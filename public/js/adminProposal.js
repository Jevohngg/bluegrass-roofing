/* public/js/adminProposal.js */
document.addEventListener('DOMContentLoaded', () => {
    const prop = window.PROPOSAL;
    const estimates = window.ESTIMATES;
  
    // link DOM
    const chkIntro  = document.getElementById('chkIntro');
    const introTxt  = document.getElementById('introTxt');
    const introArea = document.getElementById('introArea');
  
    const chkEst    = document.getElementById('chkEst');
    const estArea   = document.getElementById('estArea');
    const estSelect = document.getElementById('estSelect');
  
    const chkOutro  = document.getElementById('chkOutro');
    const outroTxt  = document.getElementById('outroTxt');
    const outroArea = document.getElementById('outroArea');
  
    /* ---------- init ---------- */
    chkIntro.checked = prop.includeIntro;
    chkEst.checked   = prop.includeEstimate;
    chkOutro.checked = prop.includeOutro;
    introTxt.value   = prop.intro || '';
    outroTxt.value   = prop.outro || '';
  
    estSelect.innerHTML += estimates.map(e =>
      `<option value="${e._id}" ${prop.estimateId==e._id?'selected':''}>
        ${e.title || 'Estimate'} — $${e.totals.subtotal.toFixed(2)}
       </option>`).join('');
  
    // helper to (show|hide) associated area
    function syncArea(chk){
      const areaId = chk.dataset.target || (chk.id.replace('chk','').toLowerCase() + 'Area');
      const area   = document.getElementById(areaId);
      if (area) area.classList.toggle('show', chk.checked);
    }
    
    [chkIntro, chkEst, chkOutro].forEach(chk => {
      syncArea(chk);                       // first paint
      chk.addEventListener('change', () => {
        syncArea(chk);                     // toggle immediately
        onChange();                        // autosave
      });
    });
    [introTxt, outroTxt, estSelect].forEach(el => el.addEventListener('input', onChange));
  
    /* ---------- autosave ---------- */
    const save = ()=>fetch('/api/proposal/'+prop._id, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        includeIntro: chkIntro.checked,
        includeEstimate: chkEst.checked,
        includeOutro: chkOutro.checked,
        intro: introTxt.value,
        outro: outroTxt.value,
        estimateId: (chkEst.checked && estSelect.value) ? estSelect.value : null

      })
    }).catch(console.error);
    const debounced = (()=>{let t;return()=>{clearTimeout(t);t=setTimeout(save,800);}})();
  
    function onChange(){ debounced(); }
  
    /* ---------- toolbar ---------- */
    document.getElementById('backBtn').onclick = ()=>history.back();
    document.getElementById('previewBtn').onclick = ()=>window.open(`/admin/proposal/${prop._id}/preview`);
    const pdfBtn = document.getElementById('pdfBtn');
    pdfBtn.onclick = async () => {
      // visual feedback
      pdfBtn.disabled = true;
      const spinner = document.createElement('span');
      spinner.className = 'spinner-border spinner-border-sm mr-2';
      pdfBtn.prepend(spinner);

    try {
      const res  = await fetch(`/api/proposal/${prop._id}/send`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ onlyPdf:true })
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error('Generation failed');

      // trigger download
          const a = document.createElement('a');
      a.href = json.url;
      a.download = json.url.split('/').pop();   // keep original filename
      document.body.appendChild(a);
      a.click();
      a.remove();

      alert('PDF downloaded.');
    } catch (err) {
      console.error(err);
      alert('Could not generate PDF.');
    } finally {
      spinner.remove();
      pdfBtn.disabled = false;
    }
  };
  const sendBtn = document.getElementById('sendBtn');
sendBtn.onclick = () => {
    document.getElementById('recipientEmail').value = prop.userId.email || '';
    $('#sendModal').modal('show');          // Bootstrap 4 jQuery helper
    };

    document.getElementById('confirmSendBtn').onclick = async () => {
    const btn = document.getElementById('confirmSendBtn');
    btn.disabled = true; btn.textContent = 'Sending…';

    const customMsg = document.getElementById('customMsg').value.trim();
    const res = await fetch(`/api/proposal/${prop._id}/send`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ customMsg })
    });

    if (res.ok) {
    alert('Proposal sent!');
    $('#sendModal').modal('hide');
    } else {
    alert('Failed to send proposal.');
    }
    btn.disabled = false; btn.textContent = 'Send';
    };
  });
  