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

      // ── AUTO‐SCROLL ON PAGE LOAD ──
  const messagesList = document.querySelector('.messages-list');
  if (messagesList) {
    // Push the scroll all the way down so the newest messages show
    messagesList.scrollTop = messagesList.scrollHeight;
  }
  
    // — “New” button → go to compose mode
    document.getElementById('newThreadBtn').addEventListener('click', () => {
      window.location.href = '/admin/messages/new';
    });
  
    const recipientInput = document.getElementById('recipientSearch');
    const sendInput      = document.querySelector(
   'form[action="/admin/messages/initiate"] textarea[name="text"]'
    );
    const sendBtn        = document.getElementById('sendNewBtn');
    const hiddenUserId   = document.getElementById('selectedUserId');
  
    if (recipientInput) {
      // Create a dropdown
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
          dd.innerHTML = users.map(u =>
            `<button type="button" class="list-group-item list-group-item-action" data-id="${u._id}">
              ${u.firstName} ${u.lastName} &lt;${u.email}&gt;
            </button>`
          ).join('');
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
  
      // Click outside to close dropdown
      document.addEventListener('click', e => {
        if (!recipientInput.contains(e.target)) dd.innerHTML = '';
      });
    }
  
    // — Live updates: highlight and append
    ioSocket.on('newMessage', data => {
      const li = document.getElementById(`thread-item-${data.threadId}`);
      if (li) li.classList.add('border-start','border-3','border-danger');
  
      // if viewing that same thread, append bubble
      const threadContainer = document.querySelector('.messages-list');
      const convoHeader    = document.querySelector('.conversation-header h5');
      if (convoHeader && threadContainer && window.location.pathname.endsWith(data.threadId)) {
        const bubble = document.createElement('div');
        bubble.className = data.sender==='admin'
          ? 'message-row d-flex justify-content-end mb-3'
          : 'message-row d-flex justify-content-start mb-3';
        bubble.innerHTML = `
          <div class="message-bubble ${data.sender==='admin'?'bg-primary text-white':'bg-secondary text-dark'} p-2 rounded">
            <p class="mb-1">${data.text}</p>
            <small class="text-muted d-block text-end">${new Date(data.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small>
          </div>`;
        threadContainer.appendChild(bubble);
        threadContainer.scrollTop = threadContainer.scrollHeight;
      }
    });
  });
  