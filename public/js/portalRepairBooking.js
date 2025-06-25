// public/js/portalRepairBooking.js


(()=>{           /* globals io, dayjs */
    dayjs.extend(dayjs_plugin_utc); dayjs.extend(dayjs_plugin_timezone);
    const TZ   = 'America/New_York';
    const dur  = Number(window.REPAIR_DURATION);   // 0.5 | 1‑5
    const dp   = document.getElementById('dayPicker');
    const btnC = document.getElementById('btnConfirm');
    const btnB = document.getElementById('btnBack');
    let   sel  = null;
  
    const socket = io();  socket.emit('joinCalendarRoom');
  
    async function loadMonth(anchor){
      const start = dayjs(anchor).startOf('month').startOf('week');
      const end   = dayjs(anchor).endOf('month').endOf('week');
      const resp  = await fetch(`/portal/repair-feed?start=${start.toISOString()}&end=${end.toISOString()}&dur=${dur}`);
      const days  = await resp.json();     // array ISO strings allowed
      const okSet = new Set(days);
      dp.innerHTML='';
  
      for(let d=start.clone(); d.isBefore(end); d=d.add(1,'day')){
        const btn = document.createElement('button');
        btn.className='btn m-1 btn-sm';
        btn.textContent = d.tz(TZ).format('D');
        const iso = d.startOf('day').toISOString();
        const allowed = okSet.has(iso);
        btn.classList.add(allowed?'btn-outline-primary':'btn-light');
        btn.disabled = !allowed;
  
        btn.onclick=()=>{
          dp.querySelectorAll('.selected').forEach(b=>b.classList.remove('selected'));
          btn.classList.add('selected');  sel=iso;  btnC.classList.remove('disabled');
        };
        dp.appendChild(btn);
      }
    }
  
    loadMonth(new Date());
    socket.on('calendarUpdated',()=>loadMonth(new Date()));
  
    btnB.onclick = ()=>location.href='/portal';
    btnC.onclick = async ()=>{
      if(btnC.classList.contains('disabled')) return;
      btnC.disabled=true;
      const res = await fetch('/portal/repair-booking', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ startAt:sel })
      });
      const j = await res.json().catch(()=>({}));
      if(!res.ok) alert(j.msg||'Error'); else location.href='/portal?success=repairBooked';
    };
  })();
  