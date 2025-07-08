document.addEventListener('DOMContentLoaded', ()=>{
    const inv = window.INVOICE;
  
    /* ---- DOM refs ---- */
    const fields = ['businessName','businessAddr','businessPhone',
                    'invoiceNumber','issuedDate','dueDate','builderNotes']


      .reduce((o,id)=>(o[id]=document.getElementById(id),o),{});
    const tblBody = document.querySelector('#itemsTable tbody');

    function iso(d){
        if (!d) return '';
        const dt = new Date(d);
        // shift to local midnight so yyyy-mm-dd is preserved
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        return dt.toISOString().slice(0,10);
        }
        Object.entries(fields).forEach(([k, el]) => {
            switch (k) {
            case 'issuedDate': el.value = iso(inv.issuedDate); break;
            case 'dueDate':    el.value = iso(inv.dueDate);    break;
            default:           el.value = inv[k] || '';
            }
        });
  
    /* ---- render existing rows ---- */
    function renderRow(li, idx){
      const tr = document.createElement('tr');
      tr.innerHTML = `
   <td><input class="form-control"              value="${li.name||''}"></td>
   <td><input class="form-control"              value="${li.description||''}"></td>
   <td style="width:110px"><input class="form-control" value="${li.color||''}"></td>
   <td style="width:90px"><input type="number" min="0" step="any"  class="form-control" value="${li.qty||0}"></td>
   <td style="width:90px"><input class="form-control"              value="${li.unit||''}"></td>
   <td style="width:130px"><input type="number" min="0" step="0.01" class="form-control" value="${li.price||0}"></td>
        <td><button class="btn btn-sm btn-link text-danger">×</button></td>`;
      tblBody.appendChild(tr);
  
      /* remove */
      tr.querySelector('button').onclick = ()=>{ tblBody.removeChild(tr); onChange(); };
      /* inputs autosave */
      tr.querySelectorAll('input').forEach(i=>i.oninput=onChange);
    }
  
    inv.lineItems.forEach(renderRow);
  
    /* ---- add row ---- */
    document.getElementById('addRowBtn').onclick = ()=>{
        renderRow({ name:'', description:'', color:'', qty:1, unit:'EA', price:0 });
    };
  
    /* ---- autosave ---- */
    const save = ()=>fetch('/api/invoice/'+inv._id,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(collectData())
    }).catch(console.error);
  
    const debounced = (()=>{let t;return ()=>{clearTimeout(t);t=setTimeout(save,800);}})();
  
    function collectData() {
        // Gather line items from the table
        const lineItems = Array.from(tblBody.children).map(tr => {
            const [name, description, color, qty, unit, price] =
                Array.from(tr.querySelectorAll('input')).map(i => i.value);
            return { name, description, color, qty:Number(qty), unit, price:Number(price) };
        });
      
        // Build the payload from our fields plus lineItems
        const payload = {
          ...Object.fromEntries(
            Object.keys(fields).map(k => [k, fields[k].value])
          ),
          lineItems
        };

        ['issuedDate','dueDate'].forEach(k=>{
            if (payload[k]){
                // keep local timezone; avoid implicit UTC parsing
                payload[k] = new Date(`${payload[k]}T00:00:00`);
            }
        });
      
        // Remove any empty-string or null values so we don't overwrite required data
        Object.keys(payload).forEach(key => {
          if (payload[key] === '' || payload[key] === null) {
            delete payload[key];
          }
        });
      
        return payload;
      }
      
  
    function onChange(){ debounced(); }
  
    Object.values(fields).forEach(f=>f.oninput=onChange);
  
    /* ---- toolbar actions ---- */
    document.getElementById('backBtn').onclick = () => {
        window.location.href = '/admin/invoices';   // forces fresh data
    };

    document.getElementById('previewBtn').onclick = ()=>window.open(`/admin/invoice/${inv._id}/preview`);
    const pdfBtn = document.getElementById('pdfBtn');
    pdfBtn.onclick = async ()=>{
      pdfBtn.disabled=true;
      const spinner=document.createElement('span');
      spinner.className='spinner-border spinner-border-sm mr-2';
      pdfBtn.prepend(spinner);
      try{
        const res = await fetch(`/api/invoice/${inv._id}/send`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ onlyPdf:true })
        });
        const json=await res.json();
        if(!res.ok||!json.url) throw new Error('Generation failed');
        const a=document.createElement('a');
        a.href=json.url;a.download=json.url.split('/').pop();
        document.body.appendChild(a);a.click();a.remove();
        alert('PDF downloaded.');
      }catch(e){alert('Could not generate PDF.');}
      finally{spinner.remove();pdfBtn.disabled=false;}
    };
    const sendBtn=document.getElementById('sendBtn');
    sendBtn.onclick=()=>{
      document.getElementById('recipientEmail').value = inv.userId.email||'';
      $('#sendModal').modal('show');
    };
    const confirmBtn = document.getElementById('confirmSendBtn');
    confirmBtn.addEventListener('click', async function () {
      const btn = this;                 // ← correct `this` binding
      btn.disabled = true;
      btn.textContent = 'Sending…';
    
      const customMsg = document.getElementById('customMsg').value.trim();
    
      try {
        const res = await fetch(`/api/invoice/${inv._id}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customMsg })
        });
    
        if (res.ok) {
          alert('Invoice sent!');
          $('#sendModal').modal('hide');
        } else {
          alert('Failed to send invoice.');
        }
      } catch (err) {
        console.error(err);
        alert('Network error.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send';
      }
    });
    
  });
  