// public/js/adminMessages.js
document.addEventListener('DOMContentLoaded', () => {
    const ioSocket = io();
    ioSocket.emit('joinAdminRoom');
  
    // — Search/filter sidebar threads
    document.getElementById('threadSearch')?.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#threadList .thread-item').forEach(li => {
        const name = li.querySelector('.thread-link').textContent.toLowerCase();
        li.style.display = name.includes(q) ? '' : 'none';
      });
    });
  
    // ── AUTO-SCROLL ON PAGE LOAD ──
    const messagesList = document.querySelector('.messages-list');
    if (messagesList) {
      messagesList.scrollTop = messagesList.scrollHeight;
    }
  
    // ── FORMAT ANY <small data-timestamp> ELEMENT ──
    document.querySelectorAll('small[data-timestamp]').forEach(el => {
      const iso = el.getAttribute('data-timestamp');
      if (!iso) return;
      const d = new Date(iso);
      el.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
  
    // — “New” button → go to compose mode
    document.getElementById('newThreadBtn')?.addEventListener('click', () => {
      window.location.href = '/admin/messages/new';
    });
  
    // — Autocomplete recipient when composing
    const recipientInput = document.getElementById('recipientSearch');
    const sendInput = document.querySelector('form[action="/admin/messages/initiate"] textarea[name="text"]');
    const sendBtn = document.getElementById('sendNewBtn');
    const hiddenUserId = document.getElementById('selectedUserId');
  
    if (recipientInput) {
      const dd = document.createElement('div');
      dd.className = 'list-group position-absolute';
      dd.style.zIndex = 1000;
      recipientInput.parentNode.appendChild(dd);
  
      let timeout;
      recipientInput.addEventListener('input', () => {
        clearTimeout(timeout);
        const q = recipientInput.value.trim();
        dd.innerHTML = '';
        hiddenUserId.value = '';
        sendInput.disabled = true;
        sendBtn.disabled = true;
  
        if (!q) return;
        timeout = setTimeout(async () => {
          const res = await fetch(`/admin/messages/users/search?q=${encodeURIComponent(q)}`);
          const users = await res.json();
          dd.innerHTML = users.map(u => `
            <button type="button" class="list-group-item list-group-item-action" data-id="${u._id}">
              ${u.firstName} ${u.lastName} <${u.email}>
            </button>
          `).join('');
          dd.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
              hiddenUserId.value = btn.dataset.id;
              recipientInput.value = btn.textContent;
              dd.innerHTML = '';
              sendInput.disabled = false;
              sendBtn.disabled = false;
              sendInput.focus();
            });
          });
        }, 300);
      });
  
      document.addEventListener('click', e => {
        if (!recipientInput.contains(e.target)) dd.innerHTML = '';
      });
    }
  
    // — Live updates: highlight & append
    ioSocket.on('newMessage', data => {
      // 1) mark the thread in sidebar
      const li = document.getElementById(`thread-item-${data.threadId}`);
      if (li) li.classList.add('border-start','border-3','border-danger','unread');
  
      // 2) if we’re viewing that thread, append the bubble
      const threadContainer = document.querySelector('.messages-list');
      const convoHeader = document.querySelector('.conversation-header h5');
      if (
        convoHeader &&
        threadContainer &&
        window.location.pathname.endsWith(data.threadId)
      ) {
        const isAdmin = data.sender === 'admin';
        // build a wrapper div
        const wrapper = document.createElement('div');
        wrapper.className = isAdmin
          ? 'message-row d-flex justify-content-end mb-3'
          : 'message-row d-flex justify-content-start mb-3';
  
        // inner HTML: bubble + timestamp placeholder
        wrapper.innerHTML = `
          <div class="message-bubble ${isAdmin ? 'bg-primary text-white' : 'bg-secondary text-dark'} p-2 rounded">
            <p class="mb-1">${data.text}</p>
          </div>
          <small
            data-timestamp="${data.createdAt}"
            class="text-secondary mt-1 d-block ${isAdmin ? 'text-end' : 'text-start'}"
          ></small>
        `;
  
        threadContainer.appendChild(wrapper);
        // scroll into view
        threadContainer.scrollTop = threadContainer.scrollHeight;
  
        // format the new timestamp
        const tsEl = wrapper.querySelector('small[data-timestamp]');
        if (tsEl) {
          const d = new Date(tsEl.getAttribute('data-timestamp'));
          tsEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }
    });
  });
  