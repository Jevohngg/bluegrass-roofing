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
      fullName: lead.fullName
      // Add any other dynamic data required by your template
    }
  };
  return sgMail.send(msg);
}

async function sendInternalNotificationEmail(lead) {
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
      userEmail: lead.emailAddress,
      formSubmission: submissionDetails
    }
  };
  return sgMail.send(msg);
}

// ------------------------------------
// ADDED FOR SIGNUP EMAIL
// ------------------------------------
async function sendUserSignupEmail(user) {
  const templateId = process.env.SENDGRID_USER_SIGNUP_TEMPLATE_ID;

  if (!templateId) {
    throw new Error('SENDGRID_USER_SIGNUP_TEMPLATE_ID not set');
  }

  const msg = {
    to: user.email,
    from: 'devbluegrassroofing@gmail.com',
    templateId: templateId,
    dynamic_template_data: {
      firstName: user.firstName,
      lastName: user.lastName,
      selectedPackage: user.selectedPackage
      // Add more placeholders as needed in your SendGrid dynamic template
    }
  };

  await sgMail.send(msg);
}

// ------------------------------------
// ADDED FOR FORGOT PASSWORD FLOW
// ------------------------------------
async function sendPasswordResetCodeEmail(user, code) {
  // Expect a new dynamic template ID for password reset
  const resetTemplateId = process.env.SENDGRID_RESET_TEMPLATE_ID;

  if (!resetTemplateId) {
    throw new Error('SENDGRID_RESET_TEMPLATE_ID not set');
  }

  const msg = {
    to: user.email,
    from: 'devbluegrassroofing@gmail.com',
    templateId: resetTemplateId,
    dynamic_template_data: {
      firstName: user.firstName,
      code // The 6-digit verification code
    }
  };

  await sgMail.send(msg);
}

module.exports = {
  sendUserConfirmationEmail,
  sendInternalNotificationEmail,
  sendUserSignupEmail,
  sendPasswordResetCodeEmail
};
