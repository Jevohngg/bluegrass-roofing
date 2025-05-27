// public/js/portalMessages.js
document.addEventListener('DOMContentLoaded', () => {
    const socket    = io();
    const userId    = document.body.getAttribute('data-user-id');
    const msgToggle = document.getElementById('msgToggle');
    const msgCount  = document.getElementById('msgCount');
  
    if (userId) socket.emit('joinUserRoom', userId);

    // after your auto-scroll logic, e.g. in DOMContentLoaded:
document.querySelectorAll('small[data-timestamp]').forEach(el => {
    const iso = el.dataset.timestamp;
    if (!iso) return;
    const d = new Date(iso);
    el.textContent = d.toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit'
    });
  });
  

      // 2) Hide the floating toggle if we're on the messages page
  if (window.location.pathname.startsWith('/portal/messages')) {
    if (msgToggle) msgToggle.style.display = 'none';
  }
     // ── AUTO‐SCROLL ON PAGE LOAD ──
     const messagesList = document.querySelector('.messages-list');
     if (messagesList) {
       // Push the scroll all the way down so the newest messages show
       messagesList.scrollTop = messagesList.scrollHeight;
     }
    // fetch unread
    async function refreshCount() {
      const res = await fetch('/portal/messages/unread-count');
      const {count} = await res.json();
      msgCount.textContent = count;
      msgCount.style.display = count>0 ? 'flex' : 'none';
    }
    refreshCount();
  
    socket.on('newMessage', data => {
      if (data.sender === 'admin') {
        // if not on thread page, bump badge
        if (!window.location.pathname.startsWith('/portal/messages')) {
          msgCount.textContent = (+msgCount.textContent||0) + 1;
          msgCount.style.display = 'flex';
        } else {
          // append live
          const container = document.getElementById('client-chat-container');
          if (container && container.dataset.threadId === data.threadId) {
            const row = document.createElement('div');
            row.className = 'message-row d-flex flex-column mb-3 align-items-start';
            row.innerHTML = `
              <div class="message-bubble bg-secondary text-dark p-2 rounded">${data.text}</div>
              <small class="text-secondary mt-1 text-start">
                ${new Date(data.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
              </small>`;
            container.appendChild(row);
            container.scrollTop = container.scrollHeight;
            msgCount.textContent = '0';
            msgCount.style.display = 'none';
          }
        }
      }
    });
  
    // click icon → open messages
    msgToggle.addEventListener('click', () => {
      window.location.href = '/portal/messages';
    });
  });
  