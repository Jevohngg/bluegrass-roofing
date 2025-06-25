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

const TYPE_LABEL = {
  inspection : 'Roof Inspection',
  sample     : 'Shingle Selection',
  repair     : 'Repair',
  installation: 'Installation',
  roofRepair:'Roof Repair'
};

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
    to: process.env.INTERNAL_TEAM_EMAIL,

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
    to:   process.env.INTERNAL_TEAM_EMAIL,

    from: { email:'noreply@bluegrass-roofing.com', name:'BlueGrass Roofing' },
    templateId,
    dynamic_template_data: {
      fullName:     `${user.firstName} ${user.lastName}`.trim(),
      shingleName:  user.shingleProposal.name,
      status:       accepted ? 'accepted' : 'declined'
    }
  });
}

/* ──────────────────────────────────────────────────────────
   Self‑Service Booking e‑mails  (BlueGrass Roofing)
   • Confirms / Cancels / Reschedules / Reminders
   • Always show date‑time in Eastern Time + “(EST)”
   ────────────────────────────────────────────────────────── */

   
   const dayjs = require('dayjs');
   const utc   = require('dayjs/plugin/utc');
   const tz    = require('dayjs/plugin/timezone');
   dayjs.extend(utc);
   dayjs.extend(tz);
   
   /* ── constants ─────────────────────────────────────────── */
   const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York'; // Lexington, KY

   
   /* Helper → “Tue, Mar 5 3:00 PM (EST)” */
   function fmt(dt) {
     return dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D h:mm A') + ' (EST)';
   }
   function fmtDay(dt){
      return dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D');
    }
   
// ── CONFIRM ──────────────────────────────────────────────
async function sendClientBookingConfirm(user, booking) {
  return sgMail.send({
    to: user.email,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_CONFIRM_CLIENT_TEMPLATE_ID,
    dynamic_template_data: {
      firstName: user.firstName,
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

async function sendAdminBookingConfirm(user, booking) {
  return sgMail.send({
    to:   process.env.INTERNAL_TEAM_EMAIL,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_CONFIRM_ADMIN_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

// ── CANCEL ───────────────────────────────────────────────
async function sendClientBookingCancel(user, booking) {
  return sgMail.send({
    to: user.email,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_CANCEL_CLIENT_TEMPLATE_ID,
    dynamic_template_data: {
      firstName: user.firstName,
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

async function sendAdminBookingCancel(user, booking) {
  return sgMail.send({
    to:   process.env.INTERNAL_TEAM_EMAIL,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_CANCEL_ADMIN_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

// ── RESCHEDULE ───────────────────────────────────────────
async function sendClientBookingReschedule(user, booking, oldStart) {
  return sgMail.send({
    to: user.email,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_RESCHEDULE_CLIENT_TEMPLATE_ID,
    dynamic_template_data: {
      firstName: user.firstName,
      oldTime: booking.type === 'roofRepair'
        ? fmtDay(oldStart)
        : fmt(oldStart),
      newTime: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

async function sendAdminBookingReschedule(user, booking, oldStart) {
  return sgMail.send({
    to:   process.env.INTERNAL_TEAM_EMAIL,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_RESCHEDULE_ADMIN_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      oldTime: booking.type === 'roofRepair'
        ? fmtDay(oldStart)
        : fmt(oldStart),
      newTime: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      type: TYPE_LABEL[booking.type] || booking.type
    }
  });
}

// ── REMINDERS (24 h / 2 h) ───────────────────────────────
async function sendClientBookingReminder(user, booking, diffLabel) {
  return sgMail.send({
    to: user.email,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_REMINDER_CLIENT_TEMPLATE_ID,
    dynamic_template_data: {
      firstName: user.firstName,
      type: TYPE_LABEL[booking.type] || booking.type,
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      diffLabel
    }
  });
}

async function sendAdminBookingReminder(user, booking, diffLabel) {
  return sgMail.send({
    to:   process.env.INTERNAL_TEAM_EMAIL,
    from: { email: 'noreply@bluegrass-roofing.com', name: 'BlueGrass Roofing' },
    templateId: process.env.SENDGRID_BOOKING_REMINDER_ADMIN_TEMPLATE_ID,
    dynamic_template_data: {
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      type: TYPE_LABEL[booking.type] || booking.type,
      start: booking.type === 'roofRepair'
        ? fmtDay(booking.startAt)
        : fmt(booking.startAt),
      diffLabel
    }
  });
}



  /* ── ROOF REPAIR INVITE ─────────────────────────── */
async function sendClientRepairInvite(user, invite){
  return sgMail.send({
    to:user.email,
    from:{ email:'noreply@bluegrass-roofing.com',name:'BlueGrass Roofing'},
    templateId:process.env.SENDGRID_REPAIR_INVITE_TEMPLATE_ID,
    dynamic_template_data:{
      firstName:user.firstName,
      duration : invite.durationDays === 0.5 ? 'Half Day' : `${invite.durationDays} day${invite.durationDays>1?'s':''}`,
      link     : `${process.env.BASE_URL}/portal`
    }
  });
}

async function sendClientRepairConfirm(user, booking){
  return sgMail.send({
    to:user.email,
    from:{ email:'noreply@bluegrass-roofing.com',name:'BlueGrass Roofing'},
    templateId:process.env.SENDGRID_REPAIR_CONFIRM_CLIENT_TEMPLATE_ID,
    dynamic_template_data:{
      firstName:user.firstName,
      start : fmtDay(booking.startAt),
      end   : fmtDay(booking.endAt),
      duration: booking.durationDays === 0.5?'Half Day':`${booking.durationDays} day(s)`
    }
  });
}
async function sendAdminRepairConfirm(user, booking){
  return sgMail.send({
    to:   process.env.INTERNAL_TEAM_EMAIL,
    from:{ email:'noreply@bluegrass-roofing.com',name:'BlueGrass Roofing'},
    templateId:process.env.SENDGRID_REPAIR_CONFIRM_ADMIN_TEMPLATE_ID,
    dynamic_template_data:{
      fullName:[user.firstName,user.lastName].join(' '),
      start : fmtDay(booking.startAt),
      end   : fmtDay(booking.endAt),
      duration: booking.durationDays === 0.5?'Half Day':`${booking.durationDays} day(s)`
    }
  });
}



module.exports = {
  sendAdminRepairConfirm,
  sendClientRepairConfirm,
  sendClientRepairInvite,
  sendUserConfirmationEmail,
  sendInternalNotificationEmail,
  sendUserSignupEmail,
  sendPasswordResetCodeEmail,
  sendAdminBookingReschedule,
  sendUserDocSignedEmail,
  sendClientBookingReschedule,
  sendTeamDocSignedEmail,
  sendDocumentLinkEmail,
  sendNewMessageEmail,
  sendClientWarrantyEmail,
  sendClientShingleEmail,
  notifyAdminShingleResponse,
  sendClientBookingConfirm,
  sendAdminBookingConfirm,
  sendClientBookingCancel,
  sendAdminBookingCancel,
  sendClientBookingReminder,
  sendAdminBookingReminder
};