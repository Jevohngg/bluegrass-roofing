// public/js/portalBookingWizard.js
/* globals io, bootbox, dayjs, dayjs_plugin_utc, dayjs_plugin_timezone */
(() => {
  /* ───────────────────────────────
     1.  Setup & Constants
  ─────────────────────────────── */
  const socket      = io();
  const RESCHEDULE_ID = new URLSearchParams(location.search).get('reschedule');

  socket.emit('joinCalendarRoom');

  // dayjs → Eastern Time helper
  dayjs.extend(dayjs_plugin_utc);
  dayjs.extend(dayjs_plugin_timezone);
  const TZ        = 'America/New_York';          // always show EST to users
  const ONE_DAY   = 86_400_000;                  // ms

  /* ───────────────────────────────
     2.  DOM references
  ─────────────────────────────── */
  const steps      = [...document.querySelectorAll('.wizard-step')];
  const btnBack    = document.getElementById('btnBack');
  const btnNext    = document.getElementById('btnNext');
  const btnCancel  = document.getElementById('btnCancel');
  const dayListEl  = document.getElementById('dayList');
  const slotTimes  = document.getElementById('slotTimes');
  const weekLabel  = document.getElementById('currentWeekLabel');

  /* ───────────────────────────────
     3.  State
  ─────────────────────────────── */
  const state = {
    step : 1,
    type : null,     // 'inspection' | 'sample'
    day  : null,     // 'YYYY-MM-DD'
    slot : null      // { start,end }
  };
  let   weekStart   = null;                // Date (Sunday 00:00 EST)
  let   slotsByDay  = {};                  // { 'YYYY-MM-DD': [slot,…] }

  /* ───────────────────────────────
     4.  Step navigation helpers
  ─────────────────────────────── */
  const showStep = n => {
    state.step = n;
    steps.forEach((s,i) => s.classList.toggle('d-none', i !== n-1));

    btnBack.classList.toggle('invisible', n === 1);
    btnNext.textContent = n === 3 ? 'Confirm' : 'Next';

    const nextDisabled =
      (n === 1 && !state.type) ||
      (n === 2 && !state.slot);
    btnNext.classList.toggle('disabled', nextDisabled);
  };

  /* ───────────────────────────────
     5.  STEP 1  – Choose appointment type
  ─────────────────────────────── */
  document.querySelectorAll('.wizard-card').forEach(card => {
    card.addEventListener('click', () => {
      state.type = card.dataset.type;
      document.querySelectorAll('.wizard-card')
              .forEach(c => c.classList.toggle('selected', c === card));
      btnNext.classList.remove('disabled');
    });
  });

  /* ───────────────────────────────
     6.  WEEK DATA – fetch & render
  ─────────────────────────────── */
  function startOfWeek(dateObj){
    // Returns Sunday 00:00 EST (as Date) for any anchor date
    return dayjs(dateObj).tz(TZ).startOf('week')
               .startOf('day').toDate();
  }

  function loadWeek(anchorDate){
    weekStart = startOfWeek(anchorDate);
    const weekEnd = new Date(weekStart.getTime() + 7*ONE_DAY);

    weekLabel.textContent =
      dayjs(weekStart).tz(TZ).format('MMM D') + ' – ' +
      dayjs(weekEnd).tz(TZ).subtract(1,'day').format('MMM D');

    fetch(`/portal/booking/feed?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`)
      .then(r => r.json())
      .then(raw => {
        slotsByDay = {};
        raw.forEach(s => {
          const key = dayjs(s.start).tz(TZ).format('YYYY-MM-DD');
          (slotsByDay[key] = slotsByDay[key] || []).push(s);
        });
        renderDays();
      })
      .catch(console.error);
  }

  function renderDays(){
    dayListEl.innerHTML = '';
    state.day  = null;
    state.slot = null;
    btnNext.classList.add('disabled');
    slotTimes.classList.add('d-none');
    slotTimes.innerHTML = '';

    for(let i=0;i<7;i++){
      const d   = new Date(weekStart.getTime() + i*ONE_DAY);
      const key = dayjs(d).tz(TZ).format('YYYY-MM-DD');

      const btn = document.createElement('button');
      btn.className = 'day-btn btn btn-outline-primary mr-2 mb-2';
      btn.textContent = dayjs(d).tz(TZ).format('ddd D');
      btn.disabled = !(slotsByDay[key]||[]).length;

      btn.onclick = ()=> {
        document.querySelectorAll('.day-btn.active').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        state.day  = key;
        state.slot = null;
        renderTimes();
        slotTimes.classList.remove('d-none');
        btnNext.classList.add('disabled');
      };
      dayListEl.appendChild(btn);
    }
  }

  function renderTimes(){
    slotTimes.innerHTML = '';
    (slotsByDay[state.day]||[]).forEach(slot=>{
      const est = dayjs(slot.start).tz(TZ);
      const btn = document.createElement('button');
      btn.className = 'time-btn btn btn-outline-primary mr-2 mb-2';
      btn.textContent = est.format('h:mm A');

      btn.onclick = ()=>{
        document.querySelectorAll('.time-btn.active').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        state.slot = slot;
        btnNext.classList.remove('disabled');
      };
      slotTimes.appendChild(btn);
    });
  }

  /* ───────────────────────────────
     7.  Footer buttons
  ─────────────────────────────── */
  btnBack.addEventListener('click', ()=>{
    if(state.step>1) showStep(state.step-1);
  });

  btnNext.addEventListener('click', ()=>{
    if(btnNext.classList.contains('disabled')) return;

    if(state.step===1){
      loadWeek(new Date());
      showStep(2);
    }else if(state.step===2){
      // summary
      document.getElementById('summaryType').textContent =
        state.type==='inspection' ? 'Roof Inspection' : 'Shingle Selection';

      document.getElementById('summaryWhen').textContent =
        dayjs(state.slot.start).tz(TZ).format('ddd, MMM D h:mm A') + ' (EST)';

      showStep(3);
    }else if(state.step===3){
      submitBooking();
    }
  });

  btnCancel.addEventListener('click', ()=>window.location.href='/portal');

  /* ───────────────────────────────
     8.  Submit booking / reschedule
  ─────────────────────────────── */
  function submitBooking(){
    btnNext.disabled = true;

    fetch('/portal/booking',{
      method :'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({
        type      : state.type,
        startAt   : state.slot.start,
        purpose   : document.getElementById('notes').value.trim(),
        bookingId : RESCHEDULE_ID || undefined
      })
    })
    .then(async r => {
      const payload = await r.json().catch(()=>({})); // try parse JSON
      if (!r.ok) {
        // show the server-provided msg if present:
        throw new Error(payload.msg || 'Server error');
      }
      return payload;
    })
    .then(res=>{
      if (res.ok) {
        window.location.href = '/portal?success=bookingConfirmed';
      } else {
        bootbox.alert(res.msg || 'Error booking slot');
        btnNext.disabled = false;
      }
    })
    .catch(err=>{
      // now shows "Too late to reschedule" (or whatever msg the server sent)
      bootbox.alert(err.message || 'Unexpected error');
      btnNext.disabled = false;
    });
    
  }

  /* ───────────────────────────────
     9.  Week navigation
  ─────────────────────────────── */
  document.getElementById('prevWeek')
    .addEventListener('click', ()=>loadWeek(new Date(weekStart.getTime() - ONE_DAY)));

  document.getElementById('nextWeek')
    .addEventListener('click', ()=>loadWeek(new Date(weekStart.getTime() + 7*ONE_DAY)));

  /* ───────────────────────────────
     10. Socket live refresh
  ─────────────────────────────── */
  socket.on('calendarUpdated', ()=>{
    if(state.step===2) loadWeek(weekStart);
  });

  /* ───────────────────────────────
     11. Bootstrap
  ─────────────────────────────── */
  showStep(1);
})();
