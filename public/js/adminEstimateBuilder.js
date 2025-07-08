document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('builder-root');
    if (!root) return;
    const est  = JSON.parse(root.dataset.estimate);
    delete root.dataset.estimate;           // free memory
  
    /* ───────────────────────────────────────── table skeleton ───────────────── */
    root.innerHTML = `
      <table class="table table-bordered" id="est-table">
        <thead><tr>
          <th style="width:20%">Name</th>
          <th style="width:25%">Description</th>
          <th style="width:10%">Color</th>          <!-- NEW -->
          <th style="width:6%">Qty</th>
          <th style="width:6%">Unit</th>
          <th>Builder $</th>
          <th>Retail $</th>
          <th style="width:14%">Markup</th>
          <th>Total</th><th>Profit</th><th></th>
        </tr></thead>
        
        <tbody></tbody>
      </table>
      <button class="btn btn-sm btn-primary" id="addRow">+ Row</button>
      <hr>
      <p><strong>Subtotal:</strong> $<span id="subTot">0.00</span><br>
         <strong>Profit:</strong>   $<span id="profTot">0.00</span></p>
    `;
  
    const tbody = root.querySelector('tbody');
  
    /* ───────── helpers ───────── */
    const blankLi = () => ({
      name:'', description:'', color:'', qty:0, unit:'SQ', builderCost:0, retailCost:0,
      markup:{ type:'%', value:0 }
    });
  
    const units = ['SQ','SF','LF','EA'];
  
    /* ---------- DOM builders ---------- */
    const rowTpl = (li,i)=>`
      <tr data-idx="${i}">
        <td><input class="form-control name"></td>
        <td><input class="form-control desc"></td>
        <td><input class="form-control color" placeholder=""></td>
        <td><input class="form-control min-50 no-padding qty" type="number" min="0"></td>
        <td>
          <select class="form-control min-50 no-padding unit">
            ${units.map(u=>`<option ${u==li.unit?'selected':''}>${u}</option>`).join('')}
          </select>
        </td>
        <td><input class="form-control dollar-amount bc" type="number" min="0" step="0.01"></td>
        <td><input class="form-control dollar-amount rc" type="number" min="0" step="0.01"></td>
        <td class="d-flex">
          <select class="form-control no-padding form-table mu-type w-auto">
            <option value="%" ${li.markup.type=='%'?'selected':''}>%</option>
            <option value="$" ${li.markup.type=='$'?'selected':''}>$</option>
          </select>
          <input class="form-control dollar-amount mu-val ml-1" type="number" min="0" step="0.01">
        </td>
        <td class="total">$0.00</td>
        <td class="profit">$0.00</td>
        <td><button class="btn btn-sm btn-link text-danger del-row">✕</button></td>
      </tr>`;
  
    function paintTable(){
        tbody.innerHTML = est.lineItems.map(rowTpl).join('');
        /* 3️⃣ Ensure every row has totals on first render */
        est.lineItems.forEach(li => computeRow(li));
        est.lineItems.forEach((li,i)=>fillRow(i));
        attachEvents();
        updateTotals();
    }
  
    function fillRow(i){
      const tr = tbody.rows[i];
      const li = est.lineItems[i];
      tr.querySelector('.name').value  = li.name || '';
      tr.querySelector('.desc').value  = li.description || '';
      tr.querySelector('.color').value = li.color || '';
      tr.querySelector('.qty').value   = li.qty;
      tr.querySelector('.bc').value    = li.builderCost;
      tr.querySelector('.rc').value    = li.retailCost;
      tr.querySelector('.mu-val').value= li.markup.value;
      tr.querySelector('.total').textContent  = `$${li.total?.toFixed(2) || '0.00'}`;
      tr.querySelector('.profit').textContent = `$${li.profit?.toFixed(2)|| '0.00'}`;
    }
  
    /* ---------- calculations ---------- */
    function computeRow(li){
      const base    = li.retailCost * li.qty;
      li.total      = li.markup.type==='%' ? base * (1 + li.markup.value/100)
                                           : base + li.markup.value;
      li.profit     = li.total - (li.builderCost * li.qty);
    }
  
    function updateTotals(){
        /* 4️⃣ Recompute each row & aggregate */
        est.lineItems.forEach(computeRow);
        est.totals = {
          subtotal : est.lineItems.reduce((s,l)=>s+l.total,0),
          profit   : est.lineItems.reduce((s,l)=>s+l.profit,0)
        };
      document.getElementById('subTot').textContent = est.totals.subtotal.toFixed(2);
      document.getElementById('profTot').textContent = est.totals.profit.toFixed(2);
    }
  
    /* ---------- event handlers ---------- */
    function attachEvents(){
      tbody.querySelectorAll('input,select').forEach(el=>{
        el.oninput = onCellChange;
      });
      tbody.querySelectorAll('.del-row').forEach(btn=>{
        btn.onclick = ()=>{ 
          const idx = +btn.closest('tr').dataset.idx;
          est.lineItems.splice(idx,1);
          paintTable();
          debouncedSave();
        };
      });
    }
  
    function onCellChange(e){
      const tr  = e.target.closest('tr');
      const idx = +tr.dataset.idx;
      const li  = est.lineItems[idx];
  
      li.name        = tr.querySelector('.name').value.trim();
      li.description = tr.querySelector('.desc').value.trim();
      li.color       = tr.querySelector('.color').value.trim();
      li.qty         = tr.querySelector('.qty').valueAsNumber || 0;
      li.unit        = tr.querySelector('.unit').value;
      li.builderCost = tr.querySelector('.bc').valueAsNumber || 0;
      li.retailCost  = tr.querySelector('.rc').valueAsNumber || 0;
      li.markup.type = tr.querySelector('.mu-type').value;
      li.markup.value= tr.querySelector('.mu-val').valueAsNumber || 0;
  
      computeRow(li);
      fillRow(idx);
      updateTotals();
      debouncedSave();
    }
  
    /* ---------- add row ---------- */
    document.getElementById('addRow').onclick = ()=>{
      est.lineItems.push(blankLi());
      paintTable();
    };
  
    /* ---------- custom catalog picker ---------- */
    let menu;
    tbody.addEventListener('focusin', async e=>{
      if (!e.target.classList.contains('name')) return;
      const inp = e.target;
      buildMenu();
      menu.style.width = inp.offsetWidth+'px';
      positionMenu(inp);
  
      inp.oninput = async ()=>{
        const q = inp.value.trim();
        if (q.length<2){ menu.hidden=true; return; }
        const rows = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`).then(r=>r.json());
        menu.innerHTML = rows.map(r=>`
          <li data-id="${r._id}" data-bc="${r.builderCost}" data-rc="${r.retailCost}"
              data-color="${r.color}"
              data-desc="${(r.description||'').replace(/"/g,'&quot;')}">
              <span class="swatch" style="background:${r.color||'#eee'}"></span>
              ${r.name} &nbsp; <small class="text-muted">$${r.retailCost}</small></li>`).join('');
        menu.hidden=false;
      };
      menu.onclick = ev=>{
        if (ev.target.tagName!=='LI') return;
        const liData = ev.target.dataset;
        /* 1️⃣ Clean label (strip price) */
        const cleanName = ev.target.textContent.replace(/\$\d[\d,.]*/,'').trim();
        inp.value = cleanName;
        const tr  = inp.closest('tr'); const idx=+tr.dataset.idx; const li=est.lineItems[idx];
        li.catalogItemId = liData.id;
        li.name          = cleanName;
        li.description   = liData.desc ? liData.desc : '';
        li.color         = liData.color || '';
        tr.querySelector('.color').value = li.color;
        li.builderCost   = Number(liData.bc) || 0;
        li.retailCost    = Number(liData.rc) || 0;
        computeRow(li);
        fillRow(idx);
        updateTotals();
        menu.hidden=true;
        debouncedSave();
      };
    });
  
    document.addEventListener('click',e=>{
      if (menu && !menu.contains(e.target)) menu.hidden=true;
    });
  
    function buildMenu(){
      if (menu) return;
      menu = document.createElement('ul');
      menu.className='catalog-menu'; menu.hidden=true;
      document.body.appendChild(menu);
    }
    function positionMenu(inp){
      const rect = inp.getBoundingClientRect();
      menu.style.left = rect.left + window.scrollX + 'px';
      menu.style.top  = rect.bottom + window.scrollY + 'px';
    }
  
    /* ---------- autosave ---------- */
    const save = () => {
      const items = est.lineItems.filter(l=>l.name || l.catalogItemId);
      if (!items.length) return;
      return fetch(`/api/estimate/${est._id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ lineItems:items, title:est.title })
      }).catch(console.error);
    };
    const debouncedSave = (()=>{let t; return ()=>{ clearTimeout(t); t=setTimeout(save,800);} })();
    /* ---------- Done button ---------- */
    document.getElementById('doneBtn').onclick = async ()=>{
        await save();                // make sure latest edits persist
        window.location.href = '/admin/estimates';
      };
    
    /* initial paint */
    paintTable();
  });
  