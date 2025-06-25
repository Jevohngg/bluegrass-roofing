// public/js/adminCalendar.js

/* global FullCalendar bootstrap */
/* global FullCalendar bootstrap */
(() => {
  const calendarEl   = document.getElementById('calendar');
  const slotModalEl  = document.getElementById('slotModal');
  const slotModal    = new bootstrap.Modal(slotModalEl);
  const form         = document.getElementById('slotForm');

  // Use the server‑supplied zone or fall back to Eastern
  const adminTz      = window.COMPANY_TZ || 'America/New_York';

  /* —— FC instance —— */
  const calendar = new FullCalendar.Calendar(calendarEl, {

    initialView : 'timeGridWeek',
    firstDay    : 0,
    slotDuration: '00:30:00',
    timeZone    : adminTz,        // ← was "local"
    nowIndicator: true,
    themeSystem : 'bootstrap5',
    headerToolbar: { left:'today prev,next', center:'title', right:'' },
    eventSources : [
      {
        id: 'bookings',
        url: '/admin/calendar/events',
        method: 'GET',
        failure: () => alert('Failed loading events')
      },
      {
              id: 'availability',
              url: '/admin/calendar/availability',
              method: 'GET',
              display: 'background',
              className: 'fc-available' 

            }
           ],
           eventContent: info => {
          if (info.event.display === 'background') return;
        
          // roofRepair → all‑day → no timeText
          const timeWithZone = info.timeText
            ? info.timeText + ' EST'
            : '';                     // show nothing
           const title        = info.event.title;
           return {
             html: `<span class="fc-event-time">${timeWithZone}</span>
                    <span class="fc-event-title"> ${title}</span>`
           };
          },
    
          eventClick(info) {
            if (info.event.display === 'background') {
              // availability template
              openEditModal(info.event);
              return;
            }
            // Booking clicked  –  open details modal
            openBookingModal(info.event);
          }
          
  });
  calendar.render();

  
    /* —— Toolbar helpers —— */
    document.getElementById('viewSwitcher').addEventListener('change', e => {
      calendar.changeView(e.target.value);
    });
    document.getElementById('btnNewSlot').addEventListener('click', () => {
      openCreateModal();
    });
  
    /* —— Socket.IO live reload —— */
    const socket = io();
    socket.emit('joinAdminRoom');
    socket.join?.('calendarRoom');
    socket.on('calendarUpdated', () => calendar.refetchEvents());
  
    /* —— Modal logic —— */
    const idField         = document.createElement('input'); // hidden
    idField.type          = 'hidden';
    idField.id            = 'slotId';
    form.appendChild(idField);
  
    const repeatWeekly    = document.getElementById('repeatWeekly');
    const dateOverrideGrp = document.getElementById('dateOverrideGroup');
    repeatWeekly.addEventListener('change', () =>
      dateOverrideGrp.style.display = repeatWeekly.checked ? 'none' : 'block');
  
    async function openCreateModal() {
      form.reset();
      idField.value             = '';
      document.getElementById('btnDeleteSlot').style.display = 'none';
      slotModal.show();
    }
  
    function openEditModal(event) {
      idField.value        = event.id;
      repeatWeekly.checked = true;               // templates only for now
    
      const opts = { timeZone: adminTz, hour12:false };
      const start = new Date(event.start).toLocaleString('en-US', opts);
      const end   = new Date(event.end  ).toLocaleString('en-US', opts);
    
      const [sH,sM] = start.split(', ')[1].split(':');
      const [eH,eM] = end.split(', ')[1].split(':');
    
      document.getElementById('dayOfWeek').value   =
        new Date(event.start).toLocaleString('en-US', { timeZone: adminTz, weekday:'short' }) === 'Sun' ? 0 :
        new Date(event.start).getDay();            // still fine
    
      document.getElementById('startTime').value = `${sH}:${sM}`;
      document.getElementById('endTime').value   = `${eH}:${eM}`;
    
      document.getElementById('btnDeleteSlot').style.display = '';
      slotModal.show();
    }

/* —— Booking details modal —— */
const bookingModalEl = document.getElementById('bookingModal');
const bookingModal   = new bootstrap.Modal(bookingModalEl);

const bkCustomer = document.getElementById('bkCustomer');
const bkEmail    = document.getElementById('bkEmail');
const bkType     = document.getElementById('bkType');
const bkWhen     = document.getElementById('bkWhen');
const btnBkCancel= document.getElementById('btnBkCancel');
const bkNote     = document.getElementById('bkNote');
const noteRows   = bookingModalEl.querySelectorAll('[data-note-row]');


let currentBkId  = null;

function openBookingModal(evt){
  currentBkId = evt.id;

  bkCustomer.textContent = evt.extendedProps.fullName || '—';
  bkEmail.textContent    = evt.extendedProps.email    || '—';
  bkType.textContent     = evt.title;
  // show time in EST regardless of admin TZ
  bkWhen.textContent = moment.tz(evt.start, 'America/New_York')
                             .format('ddd, MMM D h:mm A') + ' EST';
  bkNote.textContent = evt.extendedProps.note || '';
noteRows.forEach(el =>
  el.style.display = evt.extendedProps.note ? '' : 'none'
);


  btnBkCancel.style.display =
      (evt.extendedProps.status !== 'canceled') ? '' : 'none';

  bookingModal.show();
}

btnBkCancel.addEventListener('click', async ()=>{
  if (!confirm('Cancel this booking?')) return;
  btnBkCancel.disabled = true;
  const res = await fetch(`/admin/calendar/booking/${currentBkId}/cancel`, {
    method:'POST'
  });
  btnBkCancel.disabled = false;
  if (!res.ok){
    const { msg } = await res.json().catch(()=>({}));
    alert(msg || 'Server error');
    return;
  }
  bookingModal.hide();
  calendar.refetchEvents();
});

    
    
  
    /* Save */
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const payload = {
        dayOfWeek:     +form.dayOfWeek.value,
        startTime:     form.startTime.value,
        endTime:       form.endTime.value,
        repeatWeekly:  repeatWeekly.checked,
        dateOverride:  repeatWeekly.checked ? null : form.dateOverride.value
      };
      const id  = idField.value;
      const res = await fetch('/admin/calendar/availability' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) {
        return alert(body.msg || 'Error saving slot');
      }
      slotModal.hide();
      calendar.refetchEvents();
    });
  
    /* Delete */
    document.getElementById('btnDeleteSlot').addEventListener('click', async () => {
      const id = idField.value;
      if (!confirm('Delete this slot?')) return;
      const res = await fetch('/admin/calendar/availability/' + id, { method:'DELETE' });
      if (res.status === 409) return alert('Slot has bookings');
      if (!res.ok)           return alert('Server error');
      slotModal.hide();
      calendar.refetchEvents();
    });
  })();
  