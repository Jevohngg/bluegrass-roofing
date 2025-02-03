/* public/js/admin.js */

document.addEventListener('DOMContentLoaded', () => {
    // --- Hamburger Menu Toggle for Mobile ---
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.querySelector('.admin-sidebar');
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        hamburger.classList.toggle('active'); // toggles to X icon
      });
    }
  
    // --- Sub-Tab Switching Logic for Leads ---
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
  
    // Initially display the "new" tab content if it exists
    const initialTab = document.getElementById('tab-new');
    if (initialTab) {
      initialTab.style.display = 'block';
    }
  
    // --- Lead Action Handlers ---
  
    // Handle marking a lead as contacted
    document.querySelectorAll('.btn-contacted').forEach(button => {
      button.addEventListener('click', () => {
        const leadId = button.getAttribute('data-id');
        updateLeadStatus(leadId, 'contacted');
      });
    });
  
    // Handle marking a lead as archived
    document.querySelectorAll('.btn-archived').forEach(button => {
      button.addEventListener('click', () => {
        const leadId = button.getAttribute('data-id');
        updateLeadStatus(leadId, 'archived');
      });
    });
  
    // Handle deleting a lead
    document.querySelectorAll('.btn-delete').forEach(button => {
      button.addEventListener('click', () => {
        const leadId = button.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this lead?')) {
          deleteLead(leadId);
        }
      });
    });
  });
  
  function updateLeadStatus(leadId, status) {
    fetch(`/admin/lead/${leadId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showAlert(`Lead marked as ${status}.`, 'success', 3000);
          const leadCard = document.querySelector(`.lead-card[data-id="${leadId}"]`);
          if (leadCard) {
            if (status === 'archived') {
              leadCard.remove();
            } else if (status === 'contacted') {
              leadCard.classList.add('status-contacted');
            }
          }
        } else {
          showAlert('Failed to update lead status.', 'error', 3000);
        }
      })
      .catch(error => {
        console.error('Error updating lead status:', error);
        showAlert('An error occurred. Please try again.', 'error', 3000);
      });
  }
  
  function deleteLead(leadId) {
    fetch(`/admin/lead/${leadId}`, { method: 'DELETE' })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showAlert('Lead deleted successfully.', 'success', 3000);
          const leadCard = document.querySelector(`.lead-card[data-id="${leadId}"]`);
          if (leadCard) {
            leadCard.remove();
          }
        } else {
          showAlert('Failed to delete lead.', 'error', 3000);
        }
      })
      .catch(error => {
        console.error('Error deleting lead:', error);
        showAlert('An error occurred. Please try again.', 'error', 3000);
      });
  }
  