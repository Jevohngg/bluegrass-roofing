// public/js/portalRepairWizard.js

/* globals io, bootbox, dayjs, dayjs_plugin_utc, dayjs_plugin_timezone */
(() => {
    /* ── Setup ───────────────────────────────────────── */
    dayjs.extend(dayjs_plugin_utc);
    dayjs.extend(dayjs_plugin_timezone);
  
    const RESCHEDULE_ID = new URLSearchParams(location.search).get('reschedule');
  
    const TZ      = 'America/New_York';
    const DUR_RAW = Number(window.REPAIR_DURATION);
    const DUR     = isNaN(DUR_RAW) || DUR_RAW <= 0 ? 1 : DUR_RAW;
  
    /* DOM refs */
    const steps    = [...document.querySelectorAll('.wizard-step')];
    const btnBack  = document.getElementById('btnBack');
    const btnNext  = document.getElementById('btnNext');
    const btnCancel= document.getElementById('btnCancel');
    const grid     = document.getElementById('dayGrid');
    const monthLbl = document.getElementById('currentMonthLabel');
  
    /* state */
    let step         = 1;
    const today      = dayjs().tz(TZ).startOf('day');
    const firstMonth = today.startOf('month').toDate();
    let monthAnchor  = firstMonth;
    let selectedISO  = null;
  
    /* ── socket live refresh ─────────────────────────── */
    const socket = io();
    socket.emit('joinCalendarRoom');
    socket.on('calendarUpdated', () => renderMonth());
  
    /* ── Wizard step helper ──────────────────────────── */
    function show(n) {
      step = n;
      steps.forEach((s, i) => s.classList.toggle('d-none', i !== n - 1));
      btnBack.classList.toggle('invisible', n === 1);
      btnNext.textContent = n === 2 ? 'Confirm' : 'Next';
      if (n === 1) btnNext.classList.add('disabled');
    }
  
    /* ── Month loader ────────────────────────────────── */
    async function renderMonth() {
      // ▪ header
      const start = dayjs(monthAnchor).startOf('month');
      const end   = dayjs(monthAnchor).endOf('month').add(1, 'day');
      monthLbl.textContent = dayjs(monthAnchor).format('MMM YYYY');
  
      // ▪ fetch allowed days (disable caching!)
      const resp = await fetch(
        `/portal/repair-feed?start=${start.toISOString()}` +
        `&end=${end.toISOString()}&dur=${DUR}` +
        (RESCHEDULE_ID ? `&ignoreId=${RESCHEDULE_ID}` : ''),
        { cache: 'no-cache' }               // ← THIS LINE
      );
      const rawAllowed = await resp.json();
      const allowedDates = new Set(
        rawAllowed.map(s =>
          dayjs(s).tz(TZ).startOf('day').toISOString()
        )
      );
  
      // ▪ render grid
      grid.innerHTML = '';
      for (let d = start.clone(); d.isBefore(end); d = d.add(1, 'day')) {
        const isPast = d.isBefore(today);
        const iso    = d.tz(TZ).startOf('day').toISOString();
        const allowed = allowedDates.has(iso) && !isPast;
  
        const btn = document.createElement('button');
        btn.className    = 'day-btn btn m-1 btn-sm ' + (allowed ? 'btn-outline-primary' : 'btn-light');
        btn.disabled     = !allowed;
        btn.style.lineHeight = '1.2';
        btn.innerHTML    = `<div>${d.tz(TZ).format('ddd')}</div><div>${d.tz(TZ).format('D')}</div>`;
  
        btn.onclick = () => {
          if (!allowed) return;
          grid.querySelectorAll('.active').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedISO = iso;
          btnNext.classList.remove('disabled');
        };
  
        grid.appendChild(btn);
      }
    }
    renderMonth();
  
    /* ── Month navigation buttons ─────────────────────── */
    document.getElementById('prevMonth').onclick = () => {
      const prev = dayjs(monthAnchor).subtract(1, 'month').toDate();
      if (prev >= firstMonth) {
        monthAnchor = prev;
        renderMonth();
      }
    };
    document.getElementById('nextMonth').onclick = () => {
      monthAnchor = dayjs(monthAnchor).add(1, 'month').toDate();
      renderMonth();
    };
  
    /* ── Footer buttons ───────────────────────────────── */
    btnBack.onclick   = () => show(step - 1);
    btnCancel.onclick = () => { window.location.href = '/portal'; };
  
    btnNext.onclick = async () => {
      if (btnNext.classList.contains('disabled')) return;
      if (step === 1) {
        document.getElementById('summaryWhen').textContent =
          dayjs(selectedISO).tz(TZ).format('ddd, MMM D YYYY');
        show(2);
        return;
      }
  
      btnNext.disabled = true;
      const note = document.getElementById('rrNotes')?.value.trim() || '';
      const res  = await fetch('/portal/repair-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt:  selectedISO,
          purpose:  note,
          bookingId: RESCHEDULE_ID || undefined
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        btnNext.disabled = false;
        bootbox.alert(payload.msg || 'Server error');
        return;
      }
      window.location.href = '/portal?success=repairBooked';
    };
  
    /* initialise */
    show(1);
  })();
  