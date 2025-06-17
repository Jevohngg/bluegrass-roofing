// utils/sendEmail.js

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
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
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
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
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
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
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
  const templateId = process.env.SENDGRID_RESET_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('SENDGRID_RESET_TEMPLATE_ID not set');
  }
  if (!user || !user.email) {
    throw new Error('Cannot send reset email: Invalid user object or missing email');
  }

  const msg = {
    to: user.email,
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
    templateId: templateId,
    dynamic_template_data: {
      code: code,
      firstName: user.firstName || 'there'
    }
  };

  return sgMail.send(msg);
}



async function sendUserDocSignedEmail(user, docType, pdfPath) {
  const templateId = process.env.SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('SENDGRID_USER_DOC_SIGNED_TEMPLATE_ID not set');
  }
  if (!user || !user.email) {
    throw new Error('Cannot send signed-doc email: Invalid user object or missing email');
  }

  // read & base64-encode the PDF
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  const filename = `${docType.toUpperCase()}-${user.firstName || 'Customer'}-${Date.now()}.pdf`;

  const msg = {
    to: user.email,
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
    templateId: templateId,
    dynamic_template_data: {
      firstName: user.firstName || 'Customer',
      docType: docType.toUpperCase()
    },
    attachments: [
      {
        content: pdfBase64,
        filename: filename,
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };

  return sgMail.send(msg);
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
    // to: process.env.INTERNAL_TEAM_EMAIL,
    to: 'gentryofficialmusic@gmail.com',
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
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

async function sendDocumentLinkEmail(recipientEmail, docType, signLink, customMessage) {
  const templateId = process.env.SENDGRID_CONTRACT_LINK_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('SENDGRID_CONTRACT_LINK_TEMPLATE_ID not set');
  }
  if (!recipientEmail) {
    throw new Error('sendDocumentLinkEmail: recipientEmail is required');
  }

  const msg = {
    to: recipientEmail,
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
    templateId: templateId,
    dynamic_template_data: {
      docType: docType.toUpperCase(),
      signLink,
      customMessage: customMessage || ''
    },
    mail_settings: {
      bypass_list_management: { enable: false }
    },
    headers: {
      'List-Unsubscribe': '<mailto:unsubscribe@bluegrass-roofing.com>, <https://bluegrass-roofing.com/unsubscribe>'
    }
  };

  return sgMail.send(msg);
}


async function sendNewMessageEmail({ recipientEmail, fromAdmin, messageText, link }) {
  // decide which template to use
  const adminTpl  = process.env.SENDGRID_ADMIN_MESSAGE_TEMPLATE_ID;
  const clientTpl = process.env.SENDGRID_CLIENT_MESSAGE_TEMPLATE_ID;
  const templateId = fromAdmin ? clientTpl : adminTpl;

  if (!templateId) {
    console.error('Missing SendGrid template ID for', fromAdmin ? 'admin→client' : 'client→admin');
    return;
  }

  const msg = {
    to: recipientEmail,
    from: {
      email: 'noreply@bluegrass-roofing.com',
      name:  'BlueGrass Roofing'
    },
    templateId,
    dynamic_template_data: {
      // your template can reference these variables:
      messageText,
      link
    }
  };

  try {
    await sgMail.send(msg);
  } catch (err) {
    console.error('Error sending new message email:', err);
  }
}


// —————————————  WARRANTY  ————————————


async function sendClientWarrantyEmail(user, warrantyUrl) {
  const templateId = process.env.SENDGRID_CLIENT_WARRANTY_TEMPLATE_ID;
  if (!templateId) throw new Error('SENDGRID_CLIENT_WARRANTY_TEMPLATE_ID not set');

  return sgMail.send({
    to: user.email,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId,
    dynamic_template_data: {
      firstName: user.firstName || 'Customer',
      warrantyLink: warrantyUrl,
      year:        new Date().getFullYear()
    }
  });
}


// —————————————  SHINGLE → client  ————————————
async function sendClientShingleEmail(user, portalLink) {
  const templateId = process.env.SENDGRID_CLIENT_SHINGLE_TEMPLATE_ID;
  if (!templateId) throw new Error('SENDGRID_CLIENT_SHINGLE_TEMPLATE_ID not set');

  return sgMail.send({
    to:   user.email,
    from: { email:'noreply@bluegrass-roofing.com', name:'BlueGrass Roofing' },
    templateId,
    dynamic_template_data: {
      firstName: user.firstName || 'Customer',
      shingleName: user.shingleProposal.name,
      link: portalLink
    }
  });
}

// —————————————  SHINGLE → admin  ————————————
async function notifyAdminShingleResponse(user, accepted) {
  const templateId = process.env.SENDGRID_ADMIN_SHINGLE_TEMPLATE_ID;
  if (!templateId) { console.error('Missing SENDGRID_ADMIN_SHINGLE_TEMPLATE_ID'); return; }

  return sgMail.send({
    // to:   process.env.INTERNAL_TEAM_EMAIL,
    to: 'gentryofficialmusic@gmail.com',
    from: { email:'noreply@bluegrass-roofing.com', name:'BlueGrass Roofing' },
    templateId,
    dynamic_template_data: {
      fullName:     `${user.firstName} ${user.lastName}`.trim(),
      shingleName:  user.shingleProposal.name,
      status:       accepted ? 'accepted' : 'declined'
    }
  });
}




module.exports = {
  sendUserConfirmationEmail,
  sendInternalNotificationEmail,
  sendUserSignupEmail,
  sendPasswordResetCodeEmail,
  sendUserDocSignedEmail,
  sendTeamDocSignedEmail,
  sendDocumentLinkEmail,
  sendNewMessageEmail,
  sendClientWarrantyEmail,
  sendClientShingleEmail,
  notifyAdminShingleResponse
};