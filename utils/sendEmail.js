// utils/sendEmail.js
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// These IDs should match your configured SendGrid dynamic templates.
const USER_CONFIRM_TEMPLATE_ID = process.env.SENDGRID_USER_TEMPLATE_ID; 
const TEAM_NOTIFY_TEMPLATE_ID = process.env.SENDGRID_TEAM_TEMPLATE_ID;

async function sendUserConfirmationEmail(lead) {
  const msg = {
    to: lead.emailAddress,
    from: 'devbluegrassroofing@gmail.com', // Your verified sender
    templateId: USER_CONFIRM_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: lead.fullName,
      // Add any other dynamic data required by your template
    }
  };
  return sgMail.send(msg);
}

async function sendInternalNotificationEmail(lead) {
    // Build a string with HTML line breaks
    const submissionDetails = `
  Full Name: ${lead.fullName}<br>
  Email: ${lead.emailAddress}<br>
  Phone: ${lead.phoneNumber || 'N/A'}<br>
  Message: ${lead.message}<br>
  Form Type: ${lead.formType}
    `.trim();
  
    const msg = {
      to: 'gentryofficialmusic@gmail.com', // Your internal team email
      from: 'devbluegrassroofing@gmail.com',
      templateId: TEAM_NOTIFY_TEMPLATE_ID,
      dynamic_template_data: {
        userEmail: lead.emailAddress, // Replaces {{userEmail}}
        formSubmission: submissionDetails, // Replaces {{formSubmission}}
      }
    };
    return sgMail.send(msg);
  }
  

module.exports = { sendUserConfirmationEmail, sendInternalNotificationEmail };
