// routes/admin.js

const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const DocumentSend = require('../models/DocumentSend');
const User = require('../models/User');
const { sendDocumentLinkEmail } = require('../utils/sendEmail'); 
const contracts = require('../config/contracts');    
const Thread         = require('../models/Thread');
const { uploadClaim } = require('../utils/aws'); 
const Booking       = require('../models/Booking');
const RepairInvite = require('../models/RepairInvite');
const dayjs   = require('dayjs');
const utc     = require('dayjs/plugin/utc');
const tz      = require('dayjs/plugin/timezone');
dayjs.extend(utc);  dayjs.extend(tz);
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';
const TZ = process.env.LOCAL_TZ || 'America/New_York';

/** “Tue, Mar 5 3:00 PM (EST)” */
function fmt(dt) {
  return dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D h:mm A') + ' EST';
}
/** “Tue, Mar 5” */
function fmtDay(dt) {
  return dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D');
}

const {
  sendClientWarrantyEmail,
  sendClientShingleEmail,

} = require('../utils/sendEmail');


// routes/admin.js
const { 
  sendClientRepairInvite, 
  /* …other email helpers… */
} = require('../utils/sendEmail');

// wrap sendGrid calls so they never crash your route
async function safeSend(promise) {
  try {
    return await promise;
  } catch (err) {
    console.error('[SendGrid] mail error:', err?.response?.body || err);
  }
}


const TYPE_LABEL = {
  inspection  : 'Roof Inspection',
  sample      : 'Shingle Selection',
  repair      : 'Repair',
  installation: 'Installation'
};
function fmt(dt){
  return dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D h:mm A') + ' EST';
}


// Map docType → full title
const docTypeTitles = {
  aob: 'Assignment of Benefits (AOB)',
  aci: 'Authorization to Contact Insurer (ACI)',
  loi: 'Letter of Intent (LOI)',
  gsa: 'General Service Agreement (GSA)',
  coc: 'Certificate of Completion (COC)'
};



// Middleware to check if admin is authenticated
function checkAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  } else {
    return res.render('admin/login');
  }
}

// GET /admin - redirect to /admin/leads
router.get('/', checkAuth, (req, res) => {
  res.redirect('/admin/leads');
});

// GET /admin/leads - display leads dashboard
router.get('/leads', checkAuth, (req, res) => {
  Lead.find({}).sort({ submittedAt: -1 })
    .then(leads => {
      // Group leads by status; default to "new" if no status exists.
      const groupedLeads = { new: [], contacted: [], archived: [] };
      leads.forEach(lead => {
        let status = lead.status || 'new';
        if (!['new', 'contacted', 'archived'].includes(status)) {
          status = 'new';
        }
        groupedLeads[status].push(lead);
      });
      res.render('admin/dashboard', { groupedLeads, activeTab: 'leads', pageTitle: 'BlueGrass Roofing | Admin Dashboard'});
    })
    .catch(err => {
      console.error('Error fetching leads:', err);
      res.status(500).send('Server Error');
    });
});



// GET /admin/documents - display documents page (placeholder)
router.get('/documents', checkAuth, (req, res) => {
  res.render('admin/documents', { activeTab: 'documents' });
});

// POST /admin/login - Process login form
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin/leads');
  } else {
    res.render('admin/login', { error: 'Incorrect password. Please try again.' });
  }
});

// GET /admin/logout - Log out and redirect to login
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// POST /admin/lead/:id/status - Update a lead's status (contacted or archived)
router.post('/lead/:id/status', checkAuth, (req, res) => {
  const leadId = req.params.id;
  const { status } = req.body;
  
  // Validate that the status is either 'contacted' or 'archived'
  if (!['contacted', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  
  Lead.findByIdAndUpdate(leadId, { status: status }, { new: true })
    .then(updatedLead => {
      if (updatedLead) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Lead not found.' });
      }
    })
    .catch(err => {
      console.error('Error updating lead status:', err);
      res.status(500).json({ success: false, message: 'Server error.' });
    });
});

// DELETE /admin/lead/:id - Delete a lead
router.delete('/lead/:id', checkAuth, (req, res) => {
  const leadId = req.params.id;
  Lead.findByIdAndDelete(leadId)
    .then(deletedLead => {
      if (deletedLead) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Lead not found.' });
      }
    })
    .catch(err => {
      console.error('Error deleting lead:', err);
      res.status(500).json({ success: false, message: 'Server error.' });
    });
});

// ADD/UPDATE: GET /admin/customers - display customers dashboard
router.get('/customers', checkAuth, async (req, res) => {
  try {
    // Retrieve all users
    const allUsers = await User.find({}).sort({ createdAt: -1 });
    // Map: userId → earliest upcoming booking doc
const now = new Date();
const upcomingByUser = Object.fromEntries(
  await Booking.aggregate([
    { $match: { startAt: { $gt: now }, status: { $ne: 'canceled' } } },
    { $sort:  { startAt: 1 } },
    { $group: { _id:'$userId', booking:{ $first:'$$ROOT' } } }
  ]).then(rows =>
    rows.map(r => [ r._id.toString(), r.booking ])
  )
);

    // Separate into active vs. archived
    const activeUsers = allUsers.filter(user => user.status !== 'archived');
    const archivedUsers = allUsers.filter(user => user.status === 'archived');


function fmt(dt){
  return dayjs(dt).tz(TZ).format('ddd, MMM D h:mm A') + ' EST';
}
function fmtDay(dt) {
   return dayjs(dt).tz(TZ).format('ddd, MMM D');
 }

[...activeUsers, ...archivedUsers].forEach(u => {
  const bk = upcomingByUser[u._id.toString()];
  if (bk){
    u.nextBookingLabel = bk.type === 'roofRepair'
     ? fmtDay(bk.startAt)
     : fmt(bk.startAt);
    u.nextBookingType   = bk.type === 'inspection'
                            ? 'Roof Inspection'
                            : bk.type === 'sample'
                                ? 'Shingle Selection'
                                : bk.type[0].toUpperCase()+bk.type.slice(1);
  }
});


    return res.render('admin/customers', {
      activeUsers,
      archivedUsers,
      activeTab: 'customers',
      pageTitle: 'BlueGrass Roofing | Admin Dashboard'
    });
  } catch (err) {
    console.error('Error fetching customers:', err);
    return res.status(500).send('Server Error');
  }
});

// ADD/UPDATE: POST /admin/customer/:id/status - archive/unarchive a user
router.post('/customer/:id/status', checkAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { status } = req.body; // expected 'archived' or 'active'

    if (!['archived', 'active'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating user status:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// --- NEW: GET /admin/customer/:id  — customer detail page ---
router.get('/customer/:id', checkAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    /* 1) Pull the user (lean for perf) */
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).render('admin/notFound', { message: 'Customer not found' });
    }

    /* 2) Pull all DocumentSend rows tied to the user or e‑mail */
    const docSends = await DocumentSend.find({
      $or: [
        { userId: user._id },
        { recipientEmail: user.email.toLowerCase() }
      ]
    }).lean();

    /* NEW  — pull the customer’s single thread (if any) */
    const thread = await Thread.findOne({ userId: user._id })
      .select('messages')   // messages is the only field we need
      .lean();

    // take the last five, newest‑first
    const lastMessages = (thread?.messages || [])
      .slice(-5)
      .reverse();           // newest first – easier to read

      /* 2‑b)  Bookings — upcoming & past  */
const now = new Date();

/* 2‑a)  Active repair‑invite (if any) */
const activeInvite = await RepairInvite.findOne({
  userId: user._id,
  active : true
}).lean();


/* Upcoming first (soonest‑first) */
const upcomingBookingsRaw = await Booking.find({
  userId : user._id,
  status : { $ne:'canceled' },
  startAt: { $gte: now }
}).sort({ startAt: 1 }).lean();

/* Past (newest‑first) – limit to latest 10 for brevity */
const pastBookingsRaw = await Booking.find({
  userId : user._id,
  status : { $ne:'canceled' },
  startAt: { $lt: now }
}).sort({ startAt: -1 }).limit(10).lean();

/* Pre‑format for the template */
const mapBook = b => ({
  id    : b._id.toString(),
  when  : b.type === 'roofRepair'
            ? fmtDay(b.startAt)
            : fmt(b.startAt),
  type  : TYPE_LABEL[b.type] || (b.type[0].toUpperCase() + b.type.slice(1)),
  status: b.status,
  note  : b.purpose || ''
});


const upcomingBookings = upcomingBookingsRaw.map(mapBook);
/* Is there already a roof‑repair booking? */
const hasRepairBooking = upcomingBookingsRaw.some(b => b.type === 'roofRepair');

const pastBookings     = pastBookingsRaw.map(mapBook);


    /* 3) Normalise docs → two buckets */
    const docTypes = ['aob', 'aci', 'loi', 'gsa', 'coc'];

    const signedDocs = [];
    const pendingDocs = [];

    docTypes.forEach(type => {
      const docMeta = user.documents?.[type];
      if (docMeta?.docUrl) {
        signedDocs.push({ docType: type, url: docMeta.docUrl });
      }
    });

    docSends.forEach(ds => {
      if (ds.status === 'sent' && !signedDocs.some(d => d.docType === ds.docType)) {
        pendingDocs.push({ docType: ds.docType });
      }
    });

  // format the join date, e.g. "Jun 10 2025"
  const joinedDate = new Date(user.createdAt)
    .toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
      year:  'numeric'
    });

  res.render('admin/customerDetails', {
    pageTitle:   `Customer • ${user.firstName} ${user.lastName}`,
    user,
    signedDocs,
    pendingDocs,
    joinedDate,
    lastMessages,
    threadId: thread?._id,
    upcomingBookings,
    pastBookings,
    activeInvite,      // may be null
    hasRepairBooking,
    inviteSuccess: req.query.inviteSuccess === '1'
  });
  } catch (err) {
    console.error('Error loading customer detail:', err);
    res.status(500).send('Server Error');
  }
});


// POST /admin/customer/:id/repair-invite   { durationDays }
router.post('/customer/:id/repair-invite', checkAuth, async (req,res)=>{
  try{
    const { durationDays } = req.body;
    const days = Number(durationDays);
    if (![0.5,1,2,3,4,5].includes(days))
      return res.status(400).json({ ok:false, msg:'Bad duration' });

    await RepairInvite.updateMany(
      { userId:req.params.id, active:true },
      { $set:{ active:false } }         // one active invite maximum
    );
    const inv = await RepairInvite.create({ userId:req.params.id, durationDays:days });

    // e‑mail ⇢ client
    const user = await User.findById(req.params.id).lean();
    await safeSend(sendClientRepairInvite(user, inv));

    res.json({ ok:true, invite:inv });
  }catch(err){ console.error(err); res.status(500).end(); }
});


// DELETE /admin/customer/:id/repair-invite
router.delete('/customer/:id/repair-invite', checkAuth, async (req,res)=>{
  await RepairInvite.updateMany(
    { userId:req.params.id, active:true },
    { $set:{ active:false } }
  );
  res.json({ ok:true });
});



// GET /admin/send-documents
router.get('/send-documents', checkAuth, async (req, res) => {
  try {
    // 1) fetch sends and populate the user’s documents for fallback
    const sends = await DocumentSend
      .find()
      .sort({ sentAt: -1 })
      .populate('userId', 'documents')    // bring in user.documents
      .lean();

    // 2) map to inject formattedSignedAt (with fallback) & docTitle
    const docSends = sends.map(send => {
      // fallback to user.documents[docType].signedAt if DocumentSend.signedAt is empty
      const legacyDate = send.userId?.documents?.[send.docType]?.signedAt;
      const at = send.signedAt || legacyDate;

      return {
        ...send,
        formattedSignedAt: at
          ? new Date(at).toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short'
            })
          : '—',
        docTitle: docTypeTitles[send.docType] || send.docType
      };
    });

    // 3) render using the new array
    res.render('admin/sendDocuments', {
      activeTab: 'send-documents',
      pageTitle: 'Send Documents',
      contracts,
      docTypeTitles,
      docSends,
      success: req.query.success,
      error:   req.query.error
    });
  } catch (err) {
    console.error('Error fetching sent documents:', err);
    res.status(500).send('Server Error');
  }
});




// 2) POST /admin/send-documents - handle form submission
// POST /admin/send-documents - handle form submission
router.post('/send-documents', checkAuth, async (req, res) => {
  try {
    const {
      recipientEmail,
      docType,
      customMessage
    } = req.body;

    if (!recipientEmail || !docType) {
      return res.redirect('/admin/send-documents?error=Missing required fields');
    }

    // Look up the user (if any)
    const normalizedEmail = recipientEmail.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    const toSave = new DocumentSend({
      // store it lower-cased
      recipientEmail: normalizedEmail,
      // link it explicitly
      userId: user ? user._id : null,
      docType,
      customMessage,
      prefilledFields: new Map()
    });

    // Loop through the contract definition and pick up any submitted values
    contracts[docType].forEach(field => {
      const val = req.body[field.name];
      if (val != null) {
        toSave.prefilledFields.set(field.name, val);
      }
    });

    // Persist
    await toSave.save();

    // Send the email link
    const signLink = `${process.env.BASE_URL || 'http://localhost:3000'}/portal/doc/${toSave._id}`;
    await sendDocumentLinkEmail(recipientEmail, docType, signLink, customMessage);

    return res.redirect('/admin/send-documents?success=Document sent successfully!');
  } catch (err) {
    console.error('Error sending document:', err);
    return res.redirect('/admin/send-documents?error=Error sending document');
  }
});


// DELETE /admin/send-documents/:id
// DELETE /admin/send-documents/:id
router.delete('/send-documents/:id', checkAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Find the send so we know which user & docType to update
    const docSend = await DocumentSend.findById(id);
    if (!docSend) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // 2) If this send was linked to a user, clear their signed flag for that docType
    if (docSend.userId) {
      const user = await User.findById(docSend.userId);
      if (user && user.documents && user.documents[docSend.docType]) {
        user.documents[docSend.docType].signed   = false;
        user.documents[docSend.docType].signedAt = null;
        user.documents[docSend.docType].docUrl   = '';
        await user.save();
      }
    }

    // 3) Delete the DocumentSend record
    await DocumentSend.findByIdAndDelete(id);

    // 4) Return success
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting document send:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});









// DELETE /admin/customer/:id  — hard-delete a user + cleanup related data
router.delete('/customer/:id', checkAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // 1) Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // 2) Delete their one Thread (if any)
    await Thread.deleteOne({ userId: user._id });

    // 3) Delete all DocumentSend entries tied to them
    await DocumentSend.deleteMany({ userId: user._id });

    // 4) Delete all bookings (past, present, future) for this user
   await Booking.deleteMany({ userId: user._id });

   // 5) Delete all repair invites for this user
   await RepairInvite.deleteMany({ userId: user._id });

    // 6) Finally, delete the user record
    await User.findByIdAndDelete(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user and related data:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});



// ————————————————————————————————————————————————
// POST /admin/customer/:id/upload-warranty   (single PDF)
// ————————————————————————————————————————————————
router.post('/customer/:id/upload-warranty',
  checkAuth,
  uploadClaim.single('warrantyFile'),
  async (req,res) => {
    try {
      if (!req.file || !req.file.location) {
        return res.redirect(`/admin/customer/${req.params.id}?warrantyError=1`);
      }
      const user = await User.findById(req.params.id);
      if (!user) return res.redirect(`/admin/customer/${req.params.id}?warrantyError=1`);

      user.warranty = {
        docUrl:    req.file.location,
        uploadedAt:new Date()
      };
      await user.save();

      // email client (attachment comes from S3 – download, then forward)
      // simpler: just attach the buffer already in memory
      await sendClientWarrantyEmail(user, req.file.path ?? req.file.location);

      return res.redirect(`/admin/customer/${req.params.id}?warrantySuccess=1`);
    } catch(err){
      console.error(err);
      return res.redirect(`/admin/customer/${req.params.id}?warrantyError=1`);
     
    }
  });



  // ————————————————————————————————————————————————
// POST /admin/customer/:id/propose-shingle
// fields: shingleName, images[] (up to 5)
// ————————————————————————————————————————————————
router.post('/customer/:id/propose-shingle',
  checkAuth,
  uploadClaim.array('images',5),
  async (req,res)=>{
    try{
      const { shingleName } = req.body;
      if (!shingleName || !req.files.length) {
        return res.redirect(`/admin/customer/${req.params.id}?shingleError=1`);
      }
      const user = await User.findById(req.params.id);
      if (!user) return res.redirect(`/admin/customer/${req.params.id}?shingleError=1`);

      user.shingleProposal = {
        name:       shingleName,
        imageUrls:  req.files.map(f=>f.location),
        status:     'pending'
      };
      await user.save();

      // email client with CTA -> portal
      const portalLink = `${process.env.BASE_URL}/portal`;
      await sendClientShingleEmail(user, portalLink);

      return res.redirect(`/admin/customer/${req.params.id}?shingleSuccess=1`);
    }catch(err){
      console.error(err);
      return res.redirect(`/admin/customer/${req.params.id}?shingleError=1`);
    }
  });


module.exports = router;
