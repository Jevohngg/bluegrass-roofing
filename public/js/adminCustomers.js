// public/js/adminCustomers.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
  
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab');
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.style.display = 'none');
        
        button.classList.add('active');
        const activeContent = document.getElementById(`tab-${tab}`);
        if (activeContent) {
          activeContent.style.display = 'block';
        }
      });
    });
  
    // --- Archive/Unarchive User Logic ---
    document.querySelectorAll('.btn-archive').forEach(button => {
      button.addEventListener('click', () => {
        const userId = button.getAttribute('data-id');
        const newStatus = button.getAttribute('data-status'); // 'archived' or 'active'
        if (userId && newStatus) {
          updateUserStatus(userId, newStatus);
        }
      });
    });
  });
  
  // Helper function to handle user status update
  function updateUserStatus(userId, status) {
    fetch(`/admin/customer/${userId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Show some success message if you have a showAlert function
          // showAlert(`User ${status === 'archived' ? 'archived' : 'unarchived'} successfully.`, 'success', 3000);
  
          // Move or remove the card from the DOM
          const card = document.querySelector(`.customer-card[data-id="${userId}"]`);
          if (card) {
            if (status === 'archived') {
              // Move card from active to archived
              const archivedTab = document.getElementById('tab-archived');
              if (archivedTab) {
                const container = archivedTab.querySelector('.customer-cards');
                if (container) {
                  container.appendChild(card);
                }
              }
              // Update the button to become 'Unarchive User'
              const button = card.querySelector('.btn-archive');
              if (button) {
                button.textContent = 'Unarchive User';
                button.setAttribute('data-status', 'active');
              }
            } else {
              // Move card from archived to active
              const activeTab = document.getElementById('tab-active');
              if (activeTab) {
                const container = activeTab.querySelector('.customer-cards');
                if (container) {
                  container.appendChild(card);
                }
              }
              // Update the button to become 'Archive User'
              const button = card.querySelector('.btn-archive');
              if (button) {
                button.textContent = 'Archive User';
                button.setAttribute('data-status', 'archived');
              }
            }
          }
        } else {
          // showAlert('Failed to update user status.', 'error', 3000);
          console.error('Error updating user status:', data.message);
        }
      })
      .catch(error => {
        console.error('Error updating user status:', error);
        // showAlert('An error occurred. Please try again.', 'error', 3000);
      });
  }
  