// public/js/form.js
document.addEventListener('DOMContentLoaded', () => {
    // Select all forms with class 'quote-form' or any other forms you want to handle
    const forms = document.querySelectorAll('form.quote-form, form.contact-form');
  
    forms.forEach(form => {
      // Real-time validation (example: check required fields)
      form.addEventListener('input', (e) => {
        const input = e.target;
        if (input.hasAttribute('required') && input.value.trim() === '') {
          input.classList.add('input-error');
        } else {
          input.classList.remove('input-error');
        }
      });
  
      // Handle form submission via AJAX
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        // Convert formData to a JSON object
        const data = {};
        formData.forEach((value, key) => { data[key] = value; });
        
        // Ensure the form includes a "formType" field to identify its origin.
        if (!data.formType) {
          // If not provided in the form markup, add a default value (customize as needed)
          data.formType = form.getAttribute('id') || 'general';
        }
  
        try {
          const response = await fetch(form.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          const result = await response.json();
          if (result.success) {
            alert(result.message);
            form.reset();
          } else {
            alert('Submission failed: ' + result.message);
          }
        } catch (error) {
          console.error('Error submitting form:', error);
          alert('An error occurred. Please try again.');
        }
      });
    });
  });
  