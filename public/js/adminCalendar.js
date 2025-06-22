/* global FullCalendar bootstrap */
(() => {
    const calendarEl   = document.getElementById('calendar');
    const slotModalEl  = document.getElementById('slotModal');
    const slotModal    = new bootstrap.Modal(slotModalEl);
    const form         = document.getElementById('slotForm');
    const adminTz      = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
    /* —— FC instance —— */
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      firstDay: 0,
      slotDuration: '00:30:00',
      timeZone: 'local',
      nowIndicator: true,
      themeSystem: 'bootstrap5',
      headerToolbar: { left:'today prev,next', center:'title', right:'' },
      eventSources: [
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
          display: 'background'
        }
      ],
      eventClick(info) {
        if (info.event.display === 'background') openEditModal(info.event);
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
      idField.value             = event.id;
      repeatWeekly.checked      = true; // templates only for now
      document.getElementById('dayOfWeek').value = new Date(event.start).getDay();
      function pad(n){ return n.toString().padStart(2,'0'); }

      const start = event.start;
      const end   = event.end;
      document.getElementById('startTime').value =
        `${pad(start.getHours())}:${pad(start.getMinutes())}`;
      document.getElementById('endTime').value   =
        `${pad(end.getHours())}:${pad(end.getMinutes())}`;
      
      document.getElementById('btnDeleteSlot').style.display = '';
      slotModal.show();
    }
  
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
      if (!res.ok) return alert('Error saving slot');
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
  