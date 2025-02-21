const sgMail = require('@sendgrid/mail');
const fs = require('fs');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Existing Template IDs
const USER_CONFIRM_TEMPLATE_ID = process.env.SENDGRID_USER_TEMPLATE_ID;
const TEAM_NOTIFY_TEMPLATE_ID = process.env.SENDGRID_TEAM_TEMPLATE_ID;

// New Template IDs for Document Signing
const USER_DOC_SIGNED_TEMPLATE_ID = process.env.SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID;
const TEAM_DOC_SIGNED_TEMPLATE_ID = process.env.SENDGRID_TEAM_DOC_SIGNED_TEMPLATE_ID;

async function sendUserConfirmationEmail(lead) {
  const msg = {
    to: lead.emailAddress,
    from: 'devbluegrassroofing@gmail.com',
    templateId: USER_CONFIRM_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: lead.fullName
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
    to: process.env.INTERNAL_TEAM_EMAIL,
    from: 'devbluegrassroofing@gmail.com',
    templateId: TEAM_NOTIFY_TEMPLATE_ID,
    dynamic_template_data: {
      userEmail: lead.emailAddress,
      formSubmission: submissionDetails
    }
  };
  return sgMail.send(msg);
}

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
      firstName: user.firstName || 'User',
      lastName: user.lastName || '',
      selectedPackage: user.selectedPackage || 'N/A'
    }
  };
  await sgMail.send(msg);
}

async function sendPasswordResetCodeEmail(user, code) {
  const resetTemplateId = process.env.SENDGRID_RESET_TEMPLATE_ID;
  if (!resetTemplateId) {
    throw new Error('SENDGRID_RESET_TEMPLATE_ID not set');
  }

  const msg = {
    to: user.email,
    from: 'devbluegrassroofing@gmail.com',
    templateId: resetTemplateId,
    dynamic_template_data: {
      firstName: user.firstName || 'User',
      code
    }
  };
  await sgMail.send(msg);
}

// Updated: Send email to user after signing document
async function sendUserDocSignedEmail(user, docType, pdfPath) {
  if (!process.env.SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID) {
    throw new Error('SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID not set');
  }

  // Log the user object to debug
  console.log('sendUserDocSignedEmail - User object:', user);

  if (!user || !user.email) {
    console.error('User object is invalid or missing email:', user);
    throw new Error('Cannot send email: Invalid user object');
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const firstName = user.firstName || 'Customer'; // Fallback if firstName is missing
  const msg = {
    to: user.email,
    from: 'devbluegrassroofing@gmail.com',
    templateId: process.env.SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID,
    dynamic_template_data: {
      firstName: firstName,
      docType: docType.toUpperCase()
    },
    attachments: [
      {
        content: pdfBase64,
        filename: `${docType.toUpperCase()}-${firstName}-${Date.now()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };

  console.log('User email payload:', msg); // Log the full email payload
  await sgMail.send(msg);
}

// Updated: Send email to internal team after signing document
async function sendTeamDocSignedEmail(user, docType, pdfPath) {
  if (!process.env.SENDGRID_TEAM_DOC_SIGNED_TEMPLATE_ID) {
    throw new Error('SENDGRID_TEAM_DOC_SIGNED_TEMPLATE_ID not set');
  }
  if (!process.env.INTERNAL_TEAM_EMAIL) {
    throw new Error('INTERNAL_TEAM_EMAIL not set');
  }

  // Log the user object to debug
  console.log('sendTeamDocSignedEmail - User object:', user);

  if (!user) {
    console.error('User object is invalid:', user);
    throw new Error('Cannot send email: Invalid user object');
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const firstName = user.firstName || 'Customer'; // Fallback
  const lastName = user.lastName || ''; // Fallback
  const msg = {
    to: process.env.INTERNAL_TEAM_EMAIL,
    from: 'devbluegrassroofing@gmail.com',
    templateId: process.env.SENDGRID_TEAM_DOC_SIGNED_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: `${firstName} ${lastName}`.trim(),
      docType: docType.toUpperCase()
    },
    attachments: [
      {
        content: pdfBase64,
        filename: `${docType.toUpperCase()}-${firstName}-${Date.now()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };

  console.log('Team email payload:', msg); // Log the full email payload
  await sgMail.send(msg);
}

module.exports = {
  sendUserConfirmationEmail,
  sendInternalNotificationEmail,
  sendUserSignupEmail,
  sendPasswordResetCodeEmail,
  sendUserDocSignedEmail,
  sendTeamDocSignedEmail
};