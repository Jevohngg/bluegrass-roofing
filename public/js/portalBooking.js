// public/js/portalBooking.js

/* global FullCalendar, bootbox */
document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const socket     = io();
    socket.emit('joinCalendarRoom');
  
    /* —— Calendar init —— */
    const cal = new FullCalendar.Calendar(calendarEl, {
     timeZone: 'America/New_York',   
      initialView: 'timeGridWeek',
      slotDuration: '01:00:00',
      nowIndicator:true,
      selectable:false,
      headerToolbar:{
        left:  'prev,next today',
        center:'title',
        right: 'timeGridWeek,timeGridDay'
      },
      /* slot feed (background events) */
      events: function (info, success, failure) {
        fetch(`/portal/booking/feed?start=${info.start.toISOString()}&end=${info.end.toISOString()}`)
          .then(r => r.json())
          .then(slots => success(slots))
          .catch(failure);
      },
            eventSources: [
                // ← Availability as a background source
                {
                  events: function (info, success, failure) {
                    fetch(`/portal/booking/feed?start=${info.start.toISOString()}&end=${info.end.toISOString()}`)
                      .then(r => r.json())
                      .then(slots => success(slots))
                      .catch(failure);
                  },
                  display: 'background',
                  className: 'fc-available'
                },
                // ← Your existing bookings
                {
                  url: '/admin/calendar/events',
                  method: 'GET',
                  failure: console.error
                }
              ],
      eventDidMount: info => {
        // highlight my own
        if (info.event.extendedProps.userId === window.sessionUserId) {
          info.el.classList.add('my-booking');
        }
   // hide empty <span> that FullCalendar emits for all‑day repairs
  if(info.event.allDay){
    const timeSpan = info.el.querySelector('.fc-event-time');
    if(timeSpan) timeSpan.textContent = '';
  }
      },
      /* click empty slot (background) */
      selectMirror: false,
      selectAllow: false,
      eventClick: function (info) {
        const evt = info.event;
        // only allow cancel of my own future confirmed booking
        if (evt.extendedProps.status === 'confirmed' &&
            evt.extendedProps.userId === window.sessionUserId) {
          bootbox.confirm('Cancel this booking?', yes => {
            if (yes) cancelBooking(evt.id);
          });
        }
      },
      dateClick: function (info) {
        // find if background span element clicked
        if (!info.dayEl.closest('.fc-bg-event')) return;
        const startISO = info.dateStr;
        openBookModal(startISO);
      }
    });
  
    cal.render();
  
    /* —— socket refresh —— */
    socket.on('calendarUpdated', () => cal.refetchEvents());
  
    /* —— Modal helpers —— */
    function openBookModal(startISO) {
      document.getElementById('startAt').value = startISO;
      $('#bookModal').modal('show');
    }
  
    document.getElementById('bookForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fetch('/portal/booking', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(Object.fromEntries(fd))
      })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          $('#bookModal').modal('hide');
          cal.refetchEvents();
          alert('Booking confirmed!');
        } else {
          alert(res.msg || 'Error');
        }
      });
    });
  
    function cancelBooking(id) {
      fetch('/portal/booking', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ bookingId:id })
      })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          cal.refetchEvents();
        } else {
          alert(res.msg || 'Error');
        }
      });
    }
  });
  