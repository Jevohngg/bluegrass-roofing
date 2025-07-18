// routes/portal.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const path = require('path');
const { S3 } = require('aws-sdk');
const User = require('../models/User');
const fs = require('fs');
const DocumentSend = require('../models/DocumentSend'); // <-- NEW model for admin-sent docs
const Thread  = require('../models/Thread');
const Booking = require('../models/Booking');   // ← add just once
const Availability = require('../models/AvailabilitySlot');
const RepairInvite = require('../models/RepairInvite');
// routes/portal.js
const dayjs = require('dayjs');
const utc   = require('dayjs/plugin/utc');
const tz    = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);



/** Eastern Time for Lexington, KY */
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';


const { 
  sendClientRepairConfirm, 
  sendAdminRepairConfirm,

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

const cheerio = require('cheerio');

console.log('[DEBUG portal.js] mounting portal routes…');

// ✱ Log every single request *within* this router
router.use((req, res, next) => {
  console.log(`[DEBUG portal.js] → ${req.method} ${req.originalUrl}`);
  next();
});

// Existing docGenerator & sendEmail utilities
const {
  fillContractPlaceholders,
  parseMarkdownToHtml,
  generateContractPDF,
  generateHtmlPdf
} = require('../utils/docGenerator');


// routes/portal.js
const {
  sendNewMessageEmail,
  sendUserDocSignedEmail,
  sendTeamDocSignedEmail,
  sendClientWarrantyEmail,     // if you use it here
  sendClientShingleEmail,      // if you use it here
  notifyAdminShingleResponse,
  sendClientBookingReschedule,   // ← ADD
  sendAdminBookingReschedule,

} = require('../utils/sendEmail');


async function emailSignedContract(user, docType, pdfPath) {
  try {
    await sendUserDocSignedEmail(user, docType, pdfPath);
    await sendTeamDocSignedEmail(user, docType, pdfPath);
  } catch (err) {
    console.error(`Error emailing signed ${docType}:`, err);
  }
}


const { uploadClaim } = require('../utils/aws');


const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Middleware to check login
function requireLogin(req, res, next) {
     if (!req.session.user) {
       // remember where they were headed
       req.session.returnTo = req.originalUrl;
       return res.redirect('/login');
     }
     next();
   }




// Existing templates (still used by the older sign-doc approach)
const CONTRACT_TEMPLATES = {
  aob: `
ASSIGNMENT OF BENEFITS (AOB)
**Date: [Insert Date]**

**Parties:**
• **Homeowner**: **[Homeowner’s Full Name]**, residing at **[Property Address]**
• **Contractor**: BlueGrass Roofing, 3217 Summit Square Place, Suite 100, Lexington, KY 40509

**Insurance Policy Information:**
• **Insurance Company**: **[Insurance Company Name]**
• **Policy Number**: **[Policy Number]**
• **Claim Number**: **[Claim Number]**

**Terms of Assignment**
I, **[Homeowner’s Full Name]**, hereby assign and transfer all insurance benefits, rights, and proceeds payable under the above-mentioned insurance policy, related to the repair or restoration of property damage at **[Property Address]**, to **BlueGrass Roofing**. This assignment includes, but is not limited to, any payments for labor, materials, and other costs associated with the roofing or property repair work described in the contract dated **[Contract Date]**.

**BlueGrass Roofing** is authorized to file, negotiate, and settle the insurance claim directly with **[Insurance Company Name]** on my behalf. I understand that by signing this document, I am relinquishing my right to receive insurance proceeds directly, and payments will be made directly to the Contractor.

**Conditions:**
1. This assignment is effective until the completion of the work or until revoked in writing by me.
2. I retain the right to cancel this assignment with written notice, subject to any obligations or liabilities incurred by the Contractor prior to cancellation.
3. The Contractor agrees to perform the work in accordance with the terms of our agreement and applicable laws.

*(All signatures will be captured through the DocSign interface.)*
`,
  aci: `
AUTHORIZATION TO CONTACT INSURER (ACI)
**Date: [Insert Date]**

**Parties:**
• **Homeowner**: **[Homeowner’s Full Name]**, residing at **[Property Address]**
• **Contractor**: BlueGrass Roofing, 3217 Summit Square Place, Suite 100, Lexington, KY 40509

**Insurance Policy Information:**
• **Insurance Company**: **[Insurance Company Name]**
• **Policy Number**: **[Policy Number]**
• **Claim Number**: **[Claim Number]**

**Authorization**
I, **[Homeowner’s Full Name]**, hereby authorize **BlueGrass Roofing** to contact **[Insurance Company Name]** on my behalf regarding my insurance claim for property damage at **[Property Address]**. This authorization includes, but is not limited to, discussing claim details, providing documentation, negotiating estimates, and coordinating inspections or assessments related to the roofing or property repair work.

**Limitations:**
1. This authorization does not permit the Contractor to settle or bind the claim without my prior written approval, unless otherwise specified in a separate agreement.
2. This authorization is valid until revoked in writing by me.

*(All signatures will be captured through the DocSign interface.)*
`,
  loi: `
LETTER OF INTENT (LOI)
**Date: [Insert Date]**

**Recipients:**

**Insurance Company:**
**[Insurance Company Name]**

**Contractor:**
BlueGrass Roofing
3217 Summit Square Place, Suite 100, Lexington, KY 40509

**Homeowner:**
**[Homeowner’s Full Name]**, residing at **[Property Address]**

**Subject:** Intent to Proceed with Roofing Repairs and Insurance Claim Management

I, **[Homeowner’s Full Name]**, hereby express my intent to proceed with roofing repairs and related property restoration at the above address, to be performed by **BlueGrass Roofing**. This letter authorizes direct communication between **BlueGrass Roofing** and **[Insurance Company Name]** regarding my insurance claim (Policy Number: **[Policy Number]**, Claim Number: **[Claim Number]**), as outlined in the accompanying Assignment of Benefits and/or Authorization to Contact Insurer.

**Terms:**
1. I retain control over the final approval of the claim settlement and any decisions regarding the scope of work, unless otherwise specified in a separate agreement.
2. **BlueGrass Roofing** is authorized to manage the claim process, including filing documents, negotiating estimates, and coordinating with the insurer, on my behalf.
3. This Letter of Intent is effective until revoked in writing by me.

*(All signatures will be captured through the DocSign interface.)*
`
};

// -------------------------------------------------
// 1) Portal Dashboard (Shows claims, shingle choice, etc.)
//    We'll also fetch DocumentSend for the user's doc list in the Pug file
// -------------------------------------------------
// GET  /portal  – client dashboard
router.get('/portal', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const { success, error } = req.query;
    const userEmail = user.email.toLowerCase();

    /* ───────────────────────────────────────────────
       1) documents sent by admin
    ─────────────────────────────────────────────── */
    const docSends = await DocumentSend.find({
      $or: [{ userId: user._id }, { recipientEmail: userEmail }],
      status: { $in: ['sent', 'signed'] }
    }).sort({ sentAt: -1 });

    /* ───────────────────────────────────────────────
       2) ALL upcoming confirmed bookings (soonest →)
    ─────────────────────────────────────────────── */
    const upcomingRaw = await Booking.find({
      userId : user._id,
      status : 'confirmed',
      startAt: { $gt: new Date() }
    }).sort({ startAt: 1 }).lean();

    const fmtDay  = dt => dayjs(dt).tz(LOCAL_TZ).format('ddd, MMM D');
    const fmtTime = dt => dayjs(dt).tz(LOCAL_TZ).format('h:mm A');

    const upcoming = upcomingRaw.map(b => ({
      id   : b._id.toString(),
      type : b.type,
      when : b.type === 'roofRepair'
              ? fmtDay(b.startAt)                              // date only
              : `${fmtDay(b.startAt)} ${fmtTime(b.startAt)} (EST)`,
      reschedUrl: b.type === 'roofRepair'
                  ? `/portal/repair-booking?reschedule=${b._id}`
                  : `/portal/booking?reschedule=${b._id}`
    }));

    const hasUpcoming = upcoming.length > 0;


    const nextBookingLabel = upcoming.length ? upcoming[0].when : null;

    /* most‑recent past (any type) */
    const pastBooking = await Booking.findOne({
      userId : user._id,
      status : 'confirmed',
      startAt: { $lt: new Date() }
    }).sort({ startAt: -1 }).lean();

    const pastBookingLabel = pastBooking
      ? dayjs(pastBooking.startAt).tz(LOCAL_TZ).format('ddd, MMM D h:mm A')
      : null;

    /* ───────────────────────────────────────────────
       3) roof‑repair invite card (never deleted)
    ─────────────────────────────────────────────── */
    const activeInvite = await RepairInvite.findOne({ userId: user._id, active:true }).lean();
    let   repairInviteCard = null;

    if (activeInvite){
      const nextRepair = upcoming.find(b => b.type === 'roofRepair');

      const lastRepair = !nextRepair && await Booking.findOne({
        userId : user._id,
        type   : 'roofRepair',
        status : 'confirmed',
        endAt  : { $lt: new Date() }
      }).sort({ endAt:-1 }).lean();

      repairInviteCard = {
        duration: activeInvite.durationDays === 0.5
                    ? 'Half Day'
                    : `${activeInvite.durationDays} day`,
        upcoming: nextRepair ? nextRepair.when : null,
        past    : lastRepair ? fmtDay(lastRepair.endAt) : null
      };
    }

    /* ───────────────────────────────────────────────
       4) render
    ─────────────────────────────────────────────── */
    res.render('auth/portal', {
      currentPage : 'portal',
      userName    : user.firstName,
      packageName : user.selectedPackage,
      user,
      docSends,
      success,
      error,
      pageTitle   : 'Client Portal | BlueGrass Roofing',

      upcoming,                        // ← NEW list for the view
      pastBookingLabel,
      repairInviteCard,
      hasUpcoming, 

      /* still needed elsewhere */
      nextBookingLabel,

      /* shingles array unchanged – omitted here for brevity */
      shingles: [
        { name:'Asphalt 3-Tab',          imageUrl:'/images/shingles/asphalt-3tab.jpg' },
        { name:'Architectural Asphalt',  imageUrl:'/images/shingles/architectural-asphalt.jpg' },
        { name:'Luxury Asphalt',         imageUrl:'/images/shingles/luxury-asphalt.jpg' },
        { name:'Synthetic Slate',        imageUrl:'/images/shingles/synthetic-slate.jpg' },
        { name:'Synthetic Cedar Shake',  imageUrl:'/images/shingles/synthetic-cedar.jpg' },
        { name:'Rubber',                 imageUrl:'/images/shingles/rubber.jpg' },
        { name:'Wood Shingle',           imageUrl:'/images/shingles/wood-shingle.jpg' },
        { name:'Wood Shake',             imageUrl:'/images/shingles/wood-shake.jpg' },
        { name:'Aluminum',               imageUrl:'/images/shingles/aluminum.jpg' },
        { name:'Steel',                  imageUrl:'/images/shingles/steel.jpg' },
        { name:'Copper',                 imageUrl:'/images/shingles/copper.jpg' },
        { name:'Zinc',                   imageUrl:'/images/shingles/zinc.jpg' },
        { name:'Clay Tile',              imageUrl:'/images/shingles/clay-tile.jpg' },
        { name:'Concrete Tile',          imageUrl:'/images/shingles/concrete-tile.jpg' },
        { name:'Natural Slate',          imageUrl:'/images/shingles/natural-slate.jpg' },
        { name:'Solar',                  imageUrl:'/images/shingles/solar.jpg' },
        { name:'Fiberglass',             imageUrl:'/images/shingles/fiberglass.jpg' },
        { name:'Green Roof',             imageUrl:'/images/shingles/green-roof.jpg' }
      ]
    });

  } catch (err) {
    console.error('Error loading portal:', err);
    return res.status(500).send('Server error');
  }
});


// -------------------------------------------------
// 2) Upload Claim
// -------------------------------------------------
router.post('/portal/upload-claim', requireLogin, uploadClaim.array('claimFiles', 10), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if ((!req.files || !req.files.length) && req.file) {
      // If there's only a single file in some setups
      req.files = [req.file];
    }

    // Non-AJAX fallback
    if (!req.xhr) {
      if (req.files && req.files.length > 0 && req.files[0].location) {
        user.claimUploadUrl = req.files[0].location;
        user.claimUploadUrls = user.claimUploadUrls || [];
        user.claimUploadUrls.push(req.files[0].location);
        await user.save();
        return res.redirect('/portal?success=claimUploaded');
      } else {
        return res.redirect('/portal?error=claimNotUploaded');
      }
    } else {
      // AJAX flow
      if (req.files && req.files.length > 0) {
        user.claimUploadUrls = user.claimUploadUrls || [];
        req.files.forEach((file) => {
          user.claimUploadUrls.push(file.location);
          if (!user.claimUploadUrl) {
            user.claimUploadUrl = file.location;
          }
        });
        await user.save();
        return res.status(200).json({ success: true, files: user.claimUploadUrls });
      } else {
        return res.status(400).json({ success: false, message: 'No files uploaded' });
      }
    }
  } catch (err) {
    console.error('Error uploading claim:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Upload Error' });
    }
    return res.redirect('/portal?error=uploadError');
  }
});

// -------------------------------------------------
// 3) Delete Claim
// -------------------------------------------------
router.post('/portal/delete-claim', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'No file URL provided' });
    }

    if (!user.claimUploadUrls || !user.claimUploadUrls.includes(fileUrl)) {
      return res.status(404).json({ success: false, message: 'File not found in user records' });
    }

    user.claimUploadUrls = user.claimUploadUrls.filter(url => url !== fileUrl);
    if (user.claimUploadUrl === fileUrl) {
      user.claimUploadUrl = user.claimUploadUrls[0] || '';
    }

    // If using S3, also remove from S3
    if (process.env.S3_BUCKET_NAME) {
      try {
        const parsedUrl = new URL(fileUrl);
        const key = decodeURIComponent(parsedUrl.pathname.substring(1));
        await s3.deleteObject({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: key
        }).promise();
      } catch (delErr) {
        console.error('Error deleting from S3:', delErr);
      }
    }

    await user.save();
    return res.status(200).json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting claim:', err);
    return res.status(500).json({ success: false, message: 'Delete Error' });
  }
});

// -------------------------------------------------
// 4) Select Shingle
// -------------------------------------------------
router.post('/portal/select-shingle', requireLogin, async (req, res) => {
  try {
    const { shingleName, shingleImageUrl } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    user.shingleChoice = {
      name: shingleName,
      imageUrl: shingleImageUrl
    };

    await user.save();
    return res.redirect('/portal?success=shingleSelected');
  } catch (err) {
    console.error('Error selecting shingle:', err);
    return res.redirect('/portal?error=shingleError');
  }
});

// -------------------------------------------------
// 5) Edit Contract Fields (Older approach for doc sign)
// -------------------------------------------------
router.get('/portal/edit-contract-fields', requireLogin, async (req, res) => {
  try {
    const { docType } = req.query;
    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const currentFields = user.documents[docType].fields || {};

    res.render('auth/editContractFields', {
      docType,
      currentFields
    });
  } catch (err) {
    console.error('Error loading edit-contract-fields page:', err);
    return res.redirect('/portal?error=editFieldsError');
  }
});

router.post('/portal/edit-contract-fields', requireLogin, async (req, res) => {
  try {
    const { docType } = req.body;
    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const { propertyAddress, insuranceCompany, policyNumber, claimNumber, expirationCondition } = req.body;

    if (!propertyAddress || !insuranceCompany || !policyNumber) {
      return res.redirect(`/portal/edit-contract-fields?docType=${docType}&error=missingRequiredFields`);
    }

    user.documents[docType].fields = {
      propertyAddress,
      insuranceCompany,
      policyNumber,
      claimNumber: claimNumber || '',
      expirationCondition: expirationCondition || ''
    };

    await user.save();
    return res.redirect(`/portal/sign-doc?docType=${docType}`);
  } catch (err) {
    console.error('Error saving contract fields:', err);
    return res.redirect('/portal?error=saveFieldsError');
  }
});

// -------------------------------------------------
// 6) Old route for docSign (Original approach, if still in use)
// -------------------------------------------------
router.get('/portal/sign-doc', requireLogin, async (req, res) => {
  const { docType } = req.query;
  if (!['aob', 'aci', 'loi'].includes(docType)) {
    return res.redirect('/portal?error=invalidDocType');
  }
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const fields = user.documents[docType].fields || {};

    // Ensure required fields
    if (!fields.propertyAddress || !fields.insuranceCompany || !fields.policyNumber) {
      return res.redirect(`/portal/edit-contract-fields?docType=${docType}`);
    }

    const dateStr = new Date().toLocaleDateString();
    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': `${user.firstName} ${user.lastName}`,
      'Property Address': fields.propertyAddress,
      'Insurance Company Name': fields.insuranceCompany,
      'Policy Number': fields.policyNumber,
      'Claim Number': fields.claimNumber || 'N/A',
      'Specify Expiration Date or Condition': fields.expirationCondition || 'N/A',
      'Contract Date': dateStr
    };

    const rawTemplate = CONTRACT_TEMPLATES[docType];
    const filledContent = fillContractPlaceholders(rawTemplate, replacements);
    const docContent = parseMarkdownToHtml(filledContent);

    let docTitle = '';
    switch (docType) {
      case 'aob': docTitle = 'Assignment of Benefits (AOB)'; break;
      case 'aci': docTitle = 'Authorization to Contact Insurer (ACI)'; break;
      case 'loi': docTitle = 'Letter of Intent (LOI)'; break;
    }

    res.render('auth/docSign', {
      docType,
      docTitle,
      docContent
    });
  } catch (err) {
    console.error('Error showing doc sign page:', err);
    return res.redirect('/portal?error=docSignError');
  }
});

router.post('/portal/sign-doc', requireLogin, async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      console.error('Session missing user ID:', req.session);
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      console.error('User not found for ID:', req.session.user.id);
      return res.redirect('/login');
    }

    const { docType, signatureData } = req.body;
    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    const signedAt = new Date();
    user.documents[docType].signed = true;
    user.documents[docType].signedAt = signedAt;

    // If user signs AOB, we might reset ACI & LOI
    if (docType === 'aob') {
      user.documents.aci.signed = false;
      user.documents.aci.signedAt = null;
      user.documents.aci.docUrl = '';
      user.documents.loi.signed = false;
      user.documents.loi.signedAt = null;
      user.documents.loi.docUrl = '';
    }

    // Fill placeholders for final PDF
    const fields = user.documents[docType].fields || {};
    const dateStr = signedAt.toLocaleDateString();
    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': `${user.firstName} ${user.lastName}`,
      'Property Address': fields.propertyAddress,
      'Insurance Company Name': fields.insuranceCompany,
      'Name of Insurance Company': fields.insuranceCompany,
      'Policy Number': fields.policyNumber,
      'Claim Number': fields.claimNumber || 'N/A',
      'Specify Expiration Date or Condition': fields.expirationCondition || 'N/A',
      'Contract Date': dateStr
    };

    const rawTemplate = CONTRACT_TEMPLATES[docType];
    const filledText = fillContractPlaceholders(rawTemplate, replacements);

    let docTitle = '';
    switch (docType) {
      case 'aob': docTitle = 'Assignment of Benefits (AOB)'; break;
      case 'aci': docTitle = 'Authorization to Contact Insurer (ACI)'; break;
      case 'loi': docTitle = 'Letter of Intent (LOI)'; break;
    }

    // Save final PDF
    const pdfFileName = `${docType}-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateContractPDF(filledText, signatureData, {
      fileName: pdfFileName,
      docTitle: docTitle,
      userName: `${user.firstName} ${user.lastName}`,
      signedAt: signedAt
    });

    user.documents[docType].docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    // Optionally email
    try {
      await sendUserDocSignedEmail(user, docType, savedPdfPath);
      await sendTeamDocSignedEmail(user, docType, savedPdfPath);
    } catch (emailErr) {
      console.error('Error sending emails:', emailErr);
    }

    return res.redirect(`/portal?success=${docType}Signed`);
  } catch (err) {
    console.error('Error in POST /portal/sign-doc:', err);
    return res.redirect('/portal?error=docSignError');
  }
});

// -------------------------------------------------
// 7) Download Doc
// -------------------------------------------------
router.get('/portal/download-doc/:docType', requireLogin, async (req, res) => {
  const { docType } = req.params;
  try {
    const user = await User.findById(req.session.user.id);
    if (!user || !user.documents[docType].docUrl) {
      return res.status(404).send('Document not found');
    }
    const filePath = path.join(__dirname, '..', 'public', user.documents[docType].docUrl);
    res.download(filePath);
  } catch (err) {
    console.error('Error serving document:', err);
    res.status(500).send('Server error');
  }
});





// 9) Serve the aob.html static file
router.get('/contracts/aob.html', (req, res) => {
  const filePath = path.join(__dirname, '../views/contracts', 'aob.html');
  res.sendFile(filePath);
});

// -----------------------------------------------------------------
// POST /portal/sign-aob-interactive
// -----------------------------------------------------------------
router.post('/portal/sign-aob-interactive', requireLogin, async (req, res) => {
  try {
    // 1) Destructure fields from request body
    const {
      clientName,
      propertyAddress,
      phoneNumber,
      emailAddress,
      homeowner1PrintedName,
      signatureHomeowner1,
      homeowner1Date,
      homeowner2PrintedName,
      signatureHomeowner2,
      homeowner2Date,
      contractorRepPrintedName,
      signatureContractorRep,
      contractorRepDate,
      contractorRepTitle,
      titleDate,
      docSendId // <--- We add docSendId if present
    } = req.body;

    // 2) Basic validation
    if (!clientName || !propertyAddress || !phoneNumber || !signatureHomeowner1) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (clientName, propertyAddress, phoneNumber, or Homeowner1 signature)."
      });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    // 4) Load aob.html from disk
    const aobHtmlPath = path.join(__dirname, "../views/contracts", "aob.html");
    let fullAobHtml = fs.readFileSync(aobHtmlPath, "utf8");

    const $ = cheerio.load(fullAobHtml);
    $('script').remove();
    $('button.clear-button').remove();

    $('label[for="clientName"]').remove();
    $('label[for="propertyAddress"]').remove();
    $('label[for="phoneNumber"]').remove();
    $('label[for="emailAddress"]').remove();
    $('label[for="homeowner1PrintedName"]').remove();
    $('label[for="homeowner1Date"]').remove();
    $('label[for="homeowner2PrintedName"]').remove();
    $('label[for="homeowner2Date"]').remove();
    $('label[for="contractorRepPrintedName"]').remove();
    $('label[for="contractorRepTitle"]').remove();
    $('label[for="contractorRepDate"]').remove();
    $('#titleDate').remove();

    function safely(str = "") {
      return str.replace(/"/g, '&quot;');
    }

    $('#clientName').replaceWith(`
      <p><strong>Client Name(s)*:</strong> ${safely(clientName)}</p>
    `);

    $('#propertyAddress').replaceWith(`
      <p><strong>Property Address*:</strong> ${safely(propertyAddress)}</p>
    `);

    $('#phoneNumber').replaceWith(`
      <p><strong>Phone Number*:</strong> ${safely(phoneNumber)}</p>
    `);

    $('#emailAddress').replaceWith(`
      <p><strong>Email Address*:</strong> ${safely(emailAddress)}</p>
    `);

    $('#homeowner1PrintedName').replaceWith(`
      <p><strong>Printed Name* (Homeowner1):</strong> ${safely(homeowner1PrintedName)}</p>
    `);

    $('#homeowner1Date').replaceWith(`
      <p><strong>Date* (Homeowner1):</strong> ${safely(homeowner1Date)}</p>
    `);

    const h2Name = homeowner2PrintedName ? safely(homeowner2PrintedName) : "____________________________";
    $('#homeowner2PrintedName').replaceWith(`
      <p><strong>Printed Name (Homeowner2):</strong> ${h2Name}</p>
    `);

    const h2Date = homeowner2Date ? safely(homeowner2Date) : "____________________________";
    $('#homeowner2Date').replaceWith(`
      <p><strong>Date (Homeowner2):</strong> ${h2Date}</p>
    `);

    const repName = contractorRepPrintedName ? safely(contractorRepPrintedName) : "____________________________";
    $('#contractorRepPrintedName').replaceWith(`
      <p><strong>Contractor Rep Printed Name:</strong> ${repName}</p>
    `);

    const repTitle = contractorRepTitle ? safely(contractorRepTitle) : "____________________________";
    $('#contractorRepTitle').replaceWith(`
      <p><strong>Contractor Rep Title:</strong> ${repTitle}</p>
    `);

    const repDate = contractorRepDate ? safely(contractorRepDate) : "____________________________";
    $('#contractorRepDate').replaceWith(`
      <p><strong>Contractor Rep Date:</strong> ${repDate}</p>
    `);

    $('#signatureHomeowner1').remove();
    $('#signatureHomeowner2').remove();
    $('#signatureContractorRep').remove();

    let sigScript = '<script>(function(){';
    if (signatureHomeowner1 && signatureHomeowner1.startsWith("data:image/png")) {
      sigScript += `
        var c1 = document.getElementById("signatureCanvasHomeowner1");
        if(c1){
          var ctx1 = c1.getContext("2d");
          var img1 = new Image();
          img1.onload = function(){ ctx1.drawImage(img1, 0, 0, c1.width, c1.height); };
          img1.src = "${signatureHomeowner1}";
        }`;
    }
    if (signatureHomeowner2 && signatureHomeowner2.startsWith("data:image/png")) {
      sigScript += `
        var c2 = document.getElementById("signatureCanvasHomeowner2");
        if(c2){
          var ctx2 = c2.getContext("2d");
          var img2 = new Image();
          img2.onload = function(){ ctx2.drawImage(img2, 0, 0, c2.width, c2.height); };
          img2.src = "${signatureHomeowner2}";
        }`;
    }
    if (signatureContractorRep && signatureContractorRep.startsWith("data:image/png")) {
      sigScript += `
        var cRep = document.getElementById("signatureCanvasContractorRep");
        if(cRep){
          var ctxRep = cRep.getContext("2d");
          var imgRep = new Image();
          imgRep.onload = function(){ ctxRep.drawImage(imgRep, 0, 0, cRep.width, cRep.height); };
          imgRep.src = "${signatureContractorRep}";
        }`;
    }
    sigScript += '})();</script>';
    $('body').append(sigScript);

    fullAobHtml = $.html();

    const pdfFileName = `aob-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateHtmlPdf(fullAobHtml, { fileName: pdfFileName });
    console.log('PDF written to:', savedPdfPath);
    console.log('Exists on disk?', fs.existsSync(savedPdfPath));

    user.documents = user.documents || {};
    user.documents.aob = user.documents.aob || {};
    user.documents.aob.signed = true;
    user.documents.aob.signedAt = new Date();
    user.documents.aob.docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    // If this doc was admin-sent, mark it 'signed'
    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        if (!docSend.userId) {
          docSend.userId = user._id;
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
      
        docSend.status = 'signed';
        docSend.signedAt = new Date();
        docSend.docUrl = `/uploads/docs/${pdfFileName}`;
        await docSend.save();
      }
      
    }

    await emailSignedContract(user, 'aob', savedPdfPath);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /portal/sign-aob-interactive (Cheerio-based):", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------
// ACI Interactive
// -------------------------------------------------
router.get('/portal/sign-aci-interactive', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const docSendId = req.query.docSendId;
    let prefilled = {};

    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        // tie it to this user if not already
        if (!docSend.userId) {
          docSend.userId = user._id;
          await docSend.save();
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).send('Unauthorized');
        }
        prefilled = docSend.prefilledFields || {};
      }
    }

    return res.render('auth/signAciInteractive', {
      pageTitle: 'Sign ACI Interactive | BlueGrass Roofing',
      prefilled,
      docSendId
    });
  } catch (err) {
    console.error('Error serving interactive ACI page:', err);
    return res.redirect('/portal?error=aciInteractiveError');
  }
});


router.get('/contracts/aci.html', (req, res) => {
  const filePath = path.join(__dirname, '../views/contracts', 'aci.html');
  res.sendFile(filePath);
});

router.post('/portal/sign-aci-interactive', requireLogin, async (req, res) => {
  try {
    const {
      clientName,
      propertyAddress,
      insuranceCompany,
      claimNumber,
      homeowner1PrintedName,
      signatureHomeowner1,
      homeowner1Date,
      homeowner2PrintedName,
      signatureHomeowner2,
      homeowner2Date,
      contractorRepPrintedName,
      signatureContractorRep,
      contractorRepDate,
      contractorRepTitle,
      titleDate,
      docSendId // <--- We'll check if it's from admin-sent
    } = req.body;

    // Basic required fields
    if (
      !clientName ||
      !propertyAddress ||
      !insuranceCompany ||
      !claimNumber ||
      !homeowner1PrintedName ||
      !signatureHomeowner1 ||
      !homeowner1Date
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields. Please fill out all mandatory ACI fields."
      });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    const aciHtmlPath = path.join(__dirname, "../views/contracts", "aci.html");
    let fullAciHtml = fs.readFileSync(aciHtmlPath, "utf8");

    const $ = cheerio.load(fullAciHtml);
    $('script').remove();
    $('button.clear-button').remove();

    $('label[for="clientName"]').remove();
    $('label[for="propertyAddress"]').remove();
    $('label[for="insuranceCompany"]').remove();
    $('label[for="claimNumber"]').remove();
    $('label[for="homeowner1PrintedName"]').remove();
    $('label[for="homeowner1Date"]').remove();
    $('label[for="homeowner2PrintedName"]').remove();
    $('label[for="homeowner2Date"]').remove();
    $('label[for="contractorRepPrintedName"]').remove();
    $('label[for="contractorRepDate"]').remove();
    $('label[for="contractorRepTitle"]').remove();
    $('label[for="titleDate"]').remove();

    function escapeHtml(str = "") {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    $('#clientName').replaceWith(
      `<p><strong>Client Name*:</strong> ${escapeHtml(clientName)}</p>`
    );
    $('#propertyAddress').replaceWith(
      `<p><strong>Property Address*:</strong> ${escapeHtml(propertyAddress)}</p>`
    );
    $('#insuranceCompany').replaceWith(
      `<p><strong>Insurance Company Name*:</strong> ${escapeHtml(insuranceCompany)}</p>`
    );
    $('#claimNumber').replaceWith(
      `<p><strong>Claim Number*:</strong> ${escapeHtml(claimNumber)}</p>`
    );
    // Homeowner 1
    $('#homeowner1PrintedName').replaceWith(
      `<p><strong>Homeowner 1 Printed Name*:</strong> ${escapeHtml(homeowner1PrintedName)}</p>`
    );
    $('#homeowner1Date').replaceWith(
      `<p><strong>Homeowner 1 Date*:</strong> ${escapeHtml(homeowner1Date)}</p>`
    );
    // Homeowner 2 (optional)
    if (homeowner2PrintedName) {
      $('#homeowner2PrintedName').replaceWith(
        `<p><strong>Homeowner 2 Printed Name:</strong> ${escapeHtml(homeowner2PrintedName)}</p>`
      );
    } else {
      $('#homeowner2PrintedName').remove();
    }
    if (homeowner2Date) {
      $('#homeowner2Date').replaceWith(
        `<p><strong>Homeowner 2 Date:</strong> ${escapeHtml(homeowner2Date)}</p>`
      );
    } else {
      $('#homeowner2Date').remove();
    }
    // Contractor Rep
    if (contractorRepPrintedName) {
      $('#contractorRepPrintedName').replaceWith(
        `<p><strong>Contractor Rep Printed Name:</strong> ${escapeHtml(contractorRepPrintedName)}</p>`
      );
    } else {
      $('#contractorRepPrintedName').remove();
    }
    if (contractorRepDate) {
      $('#contractorRepDate').replaceWith(
        `<p><strong>Contractor Rep Date:</strong> ${escapeHtml(contractorRepDate)}</p>`
      );
    } else {
      $('#contractorRepDate').remove();
    }
    if (contractorRepTitle) {
      $('#contractorRepTitle').replaceWith(
        `<p><strong>Contractor Rep Title:</strong> ${escapeHtml(contractorRepTitle)}</p>`
      );
    } else {
      $('#contractorRepTitle').remove();
    }
    if (titleDate) {
      $('#titleDate').replaceWith(
        `<p><strong>Title Date:</strong> ${escapeHtml(titleDate)}</p>`
      );
    } else {
      $('#titleDate').remove();
    }

    $('#signatureHomeowner1').remove();
    $('#signatureHomeowner2').remove();
    $('#signatureContractorRep').remove();

    let sigScript = `<script>(function(){\n`;
    if (signatureHomeowner1 && signatureHomeowner1.startsWith("data:image/png")) {
      sigScript += `
        var c1 = document.getElementById("signatureCanvasHomeowner1");
        if(c1){
          var ctx1 = c1.getContext("2d");
          var img1 = new Image();
          img1.onload = function(){ ctx1.drawImage(img1, 0, 0, c1.width, c1.height); };
          img1.src = "${signatureHomeowner1}";
        }`;
    }
    if (signatureHomeowner2 && signatureHomeowner2.startsWith("data:image/png")) {
      sigScript += `
        var c2 = document.getElementById("signatureCanvasHomeowner2");
        if(c2){
          var ctx2 = c2.getContext("2d");
          var img2 = new Image();
          img2.onload = function(){ ctx2.drawImage(img2, 0, 0, c2.width, c2.height); };
          img2.src = "${signatureHomeowner2}";
        }`;
    }
    if (signatureContractorRep && signatureContractorRep.startsWith("data:image/png")) {
      sigScript += `
        var cRep = document.getElementById("signatureCanvasContractorRep");
        if(cRep){
          var ctxRep = cRep.getContext("2d");
          var imgRep = new Image();
          imgRep.onload = function(){ ctxRep.drawImage(imgRep, 0, 0, cRep.width, cRep.height); };
          imgRep.src = "${signatureContractorRep}";
        }`;
    }
    sigScript += `})();</script>`;

    $('body').append(sigScript);
    const finalAciHtml = $.html();
    const pdfFileName = `aci-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateHtmlPdf(finalAciHtml, { fileName: pdfFileName });

    user.documents.aci = user.documents.aci || {};
    user.documents.aci.signed = true;
    user.documents.aci.signedAt = new Date();
    user.documents.aci.docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    // If docSendId was provided, mark that DocumentSend as signed too
    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        if (!docSend.userId) {
          docSend.userId = user._id;
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
      
        docSend.status = 'signed';
        docSend.signedAt = new Date();
        docSend.docUrl = `/uploads/docs/${pdfFileName}`;
        await docSend.save();
      }
      
    }

    await emailSignedContract(user, 'aci', savedPdfPath);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /portal/sign-aci-interactive:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------
// LOI Interactive
// -------------------------------------------------
router.get('/contracts/loi.html', (req, res) => {
  const filePath = path.join(__dirname, '../views/contracts', 'loi.html');
  res.sendFile(filePath);
});

router.get('/portal/sign-loi-interactive', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const docSendId = req.query.docSendId;
    let prefilled = {};

    if (docSendId) {
      const ds = await DocumentSend.findById(docSendId);
      if (ds) {
        // bind to this user if needed
        if (!ds.userId) {
          ds.userId = user._id;
          await ds.save();
        } else if (ds.userId.toString() !== user._id.toString()) {
          return res.status(403).send('Unauthorized');
        }
        prefilled = ds.prefilledFields || {};
      }
    }
    return res.render('auth/signLoiInteractive', {
      pageTitle: 'Sign LOI Interactive | BlueGrass Roofing',
      prefilled,
      docSendId
    });
  } catch (err) {
    console.error('Error serving interactive LOI page:', err);
    return res.redirect('/portal?error=loiInteractiveError');
  }
});


router.post('/portal/sign-loi-interactive', requireLogin, async (req, res) => {
  try {
    const {
      clientName,
      propertyAddress,
      phoneNumber,
      emailAddress,
      propertyAddressAgain,
      homeowner1PrintedName,
      signatureHomeowner1,
      homeowner1Date,
      homeowner2PrintedName,
      signatureHomeowner2,
      homeowner2Date,
      contractorRepPrintedName,
      signatureContractorRep,
      contractorRepDate,
      contractorRepTitle,
      titleDate,
      docSendId // <--- If from admin-sent
    } = req.body;

    if (
      !clientName ||
      !propertyAddress ||
      !phoneNumber ||
      !emailAddress ||
      !propertyAddressAgain ||
      !homeowner1PrintedName ||
      !signatureHomeowner1 ||
      !homeowner1Date
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields. Please fill out all mandatory LOI fields."
      });
    }

    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found." });
    }

    const loiHtmlPath = path.join(__dirname, "../views/contracts", "loi.html");
    let fullLoiHtml = fs.readFileSync(loiHtmlPath, "utf8");
    const $ = cheerio.load(fullLoiHtml);

    $('script').remove();
    $('button.clear-button').remove();

    $('label[for="clientName"]').remove();
    $('label[for="propertyAddress"]').remove();
    $('label[for="phoneNumber"]').remove();
    $('label[for="emailAddress"]').remove();
    $('label[for="propertyAddressAgain"]').remove();
    $('label[for="homeowner1PrintedName"]').remove();
    $('label[for="homeowner1Date"]').remove();
    $('label[for="homeowner2PrintedName"]').remove();
    $('label[for="homeowner2Date"]').remove();
    $('label[for="contractorRepPrintedName"]').remove();
    $('label[for="contractorRepDate"]').remove();
    $('label[for="contractorRepTitle"]').remove();
    $('label[for="titleDate"]').remove();

    function escapeHtml(str = "") {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    $('#clientName').replaceWith(
      `<p><strong>Client Name(s)*:</strong> ${escapeHtml(clientName)}</p>`
    );
    $('#propertyAddress').replaceWith(
      `<p><strong>Property Address*:</strong> ${escapeHtml(propertyAddress)}</p>`
    );
    $('#phoneNumber').replaceWith(
      `<p><strong>Phone Number*:</strong> ${escapeHtml(phoneNumber)}</p>`
    );
    $('#emailAddress').replaceWith(
      `<p><strong>Email Address*:</strong> ${escapeHtml(emailAddress)}</p>`
    );
    $('#propertyAddressAgain').replaceWith(
      `<p><strong></strong> ${escapeHtml(propertyAddressAgain)}</p>`
    );

    // Homeowner 1
    $('#homeowner1PrintedName').replaceWith(
      `<p><strong>Homeowner 1 Printed Name*:</strong> ${escapeHtml(homeowner1PrintedName)}</p>`
    );
    $('#homeowner1Date').replaceWith(
      `<p><strong>Homeowner 1 Date*:</strong> ${escapeHtml(homeowner1Date)}</p>`
    );
    // Homeowner 2
    if (homeowner2PrintedName) {
      $('#homeowner2PrintedName').replaceWith(
        `<p><strong>Homeowner 2 Printed Name:</strong> ${escapeHtml(homeowner2PrintedName)}</p>`
      );
    } else {
      $('#homeowner2PrintedName').remove();
    }
    if (homeowner2Date) {
      $('#homeowner2Date').replaceWith(
        `<p><strong>Homeowner 2 Date:</strong> ${escapeHtml(homeowner2Date)}</p>`
      );
    } else {
      $('#homeowner2Date').remove();
    }

    // Contractor
    if (contractorRepPrintedName) {
      $('#contractorRepPrintedName').replaceWith(
        `<p><strong>Contractor Rep Printed Name:</strong> ${escapeHtml(contractorRepPrintedName)}</p>`
      );
    } else {
      $('#contractorRepPrintedName').remove();
    }
    if (contractorRepDate) {
      $('#contractorRepDate').replaceWith(
        `<p><strong>Contractor Rep Date:</strong> ${escapeHtml(contractorRepDate)}</p>`
      );
    } else {
      $('#contractorRepDate').remove();
    }
    if (contractorRepTitle) {
      $('#contractorRepTitle').replaceWith(
        `<p><strong>Contractor Rep Title:</strong> ${escapeHtml(contractorRepTitle)}</p>`
      );
    } else {
      $('#contractorRepTitle').remove();
    }
    if (titleDate) {
      $('#titleDate').replaceWith(
        `<p><strong>Title Date:</strong> ${escapeHtml(titleDate)}</p>`
      );
    } else {
      $('#titleDate').remove();
    }

    $('#signatureHomeowner1').remove();
    $('#signatureHomeowner2').remove();
    $('#signatureContractorRep').remove();

    let sigScript = `<script>(function(){\n`;
    if (signatureHomeowner1 && signatureHomeowner1.startsWith("data:image/png")) {
      sigScript += `
        var c1 = document.getElementById("signatureCanvasHomeowner1");
        if(c1){
          var ctx1 = c1.getContext("2d");
          var img1 = new Image();
          img1.onload = function(){ ctx1.drawImage(img1, 0, 0, c1.width, c1.height); };
          img1.src = "${signatureHomeowner1}";
        }`;
    }
    if (signatureHomeowner2 && signatureHomeowner2.startsWith("data:image/png")) {
      sigScript += `
        var c2 = document.getElementById("signatureCanvasHomeowner2");
        if(c2){
          var ctx2 = c2.getContext("2d");
          var img2 = new Image();
          img2.onload = function(){ ctx2.drawImage(img2, 0, 0, c2.width, c2.height); };
          img2.src = "${signatureHomeowner2}";
        }`;
    }
    if (signatureContractorRep && signatureContractorRep.startsWith("data:image/png")) {
      sigScript += `
        var cRep = document.getElementById("signatureCanvasContractorRep");
        if(cRep){
          var ctxRep = cRep.getContext("2d");
          var imgRep = new Image();
          imgRep.onload = function(){ ctxRep.drawImage(imgRep, 0, 0, cRep.width, cRep.height); };
          imgRep.src = "${signatureContractorRep}";
        }`;
    }
    sigScript += `})();</script>`;

    $('body').append(sigScript);
    const finalLoiHtml = $.html();
    const pdfFileName = `loi-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateHtmlPdf(finalLoiHtml, { fileName: pdfFileName });

    user.documents.loi = user.documents.loi || {};
    user.documents.loi.signed = true;
    user.documents.loi.signedAt = new Date();
    user.documents.loi.docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        if (!docSend.userId) {
          docSend.userId = user._id;
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
      
        docSend.status = 'signed';
        docSend.signedAt = new Date();
        docSend.docUrl = `/uploads/docs/${pdfFileName}`;
        await docSend.save();
      }
      
    }

    await emailSignedContract(user, 'loi', savedPdfPath);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /portal/sign-loi-interactive:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------
// GSA Interactive
// -------------------------------------------------
// -------------------------------------------------
// GSA Interactive
// -------------------------------------------------
router.get('/portal/sign-gsa-interactive', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const docSendId = req.query.docSendId;
    let prefilled = {};

    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        // Tie it to this user if not already
        if (!docSend.userId) {
          docSend.userId = user._id;
          await docSend.save();
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).send('Unauthorized');
        }
        prefilled = docSend.prefilledFields || {};
      }
    }

    return res.render('auth/signGsaInteractive', {
      pageTitle: 'Sign GSA Interactive | BlueGrass Roofing',
      prefilled
    });
  } catch (err) {
    console.error('Error serving interactive GSA page:', err);
    return res.redirect('/portal?error=gsaInteractiveError');
  }
});


router.get('/contracts/gsa.html', (req, res) => {
  const filePath = path.join(__dirname, '../views/contracts', 'gsa.html');
  res.sendFile(filePath);
});

router.post('/portal/sign-gsa-interactive', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const {
      clientNames,
      fullPropertyAddress,
      effectiveDate,
      clientNameAgain,
      clientAddress,
      clientPhone,
      clientEmail,
      agreementDay,
      agreementMonth,
      homeownerPrintedName,
      homeownerDate,
      signatureHomeowner,
      projectTypes,
      projectTypeOther,
      signatureContractor,
      contractorDate,
      contractorPrintedName,
      contractorTitle,
      docSendId // <--- If from admin-sent doc
    } = req.body;

    // Required checks
    if (
      !clientNames ||
      !fullPropertyAddress ||
      !clientNameAgain ||
      !clientAddress ||
      !clientPhone ||
      !clientEmail ||
      !homeownerDate ||
      !signatureHomeowner
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields. Please fill out all mandatory GSA fields."
      });
    }

    const gsaHtmlPath = path.join(__dirname, "../views/contracts", "gsa.html");
    let gsaHtml = fs.readFileSync(gsaHtmlPath, "utf8");

    const $ = cheerio.load(gsaHtml);
    $('script').remove();
    $('.clear-button').remove();

    // Convert checkboxes => [x]/[ ]
    const selectedTypes = new Set(Array.isArray(projectTypes) ? projectTypes : []);
    $('input[type="checkbox"][name="projectType[]"]').each((i, el) => {
      const val = $(el).attr('value') || '';
      if (selectedTypes.has(val)) {
        $(el).replaceWith('<span style="font-weight:bold;">[x]</span>');
      } else {
        $(el).replaceWith('<span>[ ]</span>');
      }
    });

    // Replace other <input> with user-provided text
    $('input').each((i, el) => {
      const nameAttr = $(el).attr('name') || '';
      const typeAttr = $(el).attr('type') || '';
      // Skip signature fields
      if ((typeAttr === 'checkbox' && nameAttr === 'projectType[]') ||
          nameAttr === 'signatureHomeowner' ||
          nameAttr === 'signatureContractor') {
        $(el).remove();
        return;
      }
      const userVal = req.body[nameAttr] || '';
      $(el).replaceWith(`<span style="font-weight:bold;">${escapeHtml(userVal)}</span>`);
    });

    let sigScript = '<script>(function(){\n';
    if (signatureHomeowner && signatureHomeowner.startsWith("data:image/png")) {
      sigScript += `
        var c1 = document.getElementById("signatureCanvasHomeowner");
        if(c1){
          var ctx1 = c1.getContext("2d");
          var img1 = new Image();
          img1.onload = function(){ ctx1.drawImage(img1, 0, 0, c1.width, c1.height); };
          img1.src = "${signatureHomeowner}";
        }
      `;
    }
    if (signatureContractor && signatureContractor.startsWith("data:image/png")) {
      sigScript += `
        var c2 = document.getElementById("signatureCanvasContractor");
        if(c2){
          var ctx2 = c2.getContext("2d");
          var img2 = new Image();
          img2.onload = function(){ ctx2.drawImage(img2, 0, 0, c2.width, c2.height); };
          img2.src = "${signatureContractor}";
        }
      `;
    }
    sigScript += '})();</script>';
    $('body').append(sigScript);

    const finalGsaHtml = $.html();
    const pdfFileName = `gsa-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateHtmlPdf(finalGsaHtml, { fileName: pdfFileName });

    user.documents.gsa.signed = true;
    user.documents.gsa.signedAt = new Date();
    user.documents.gsa.docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        if (!docSend.userId) {
          docSend.userId = user._id;
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
      
        docSend.status = 'signed';
        docSend.signedAt = new Date();
        docSend.docUrl = `/uploads/docs/${pdfFileName}`;
        await docSend.save();
      }
      
    }

    await emailSignedContract(user, 'gsa', savedPdfPath);

    return res.json({ success: true });
  } catch (err) {
    console.error("Error in POST /portal/sign-gsa-interactive:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// -------------------------------------------------
// COC Interactive
// -------------------------------------------------

router.get('/portal/sign-coc-interactive', requireLogin, async (req, res) => {
  const docSendId = req.query.docSendId;
  let prefilled = {};

  if (docSendId) {
    const docSend = await DocumentSend.findById(docSendId);
    if (docSend) {
      // turn Map into plain object
      prefilled = Object.fromEntries(docSend.prefilledFields.entries());
    }
  }

  return res.render('auth/signCocInteractive', {
    pageTitle: 'Sign COC Interactive | BlueGrass Roofing',
    docSendId,
    prefilled
  });
});


router.get('/contracts/coc.html', (req, res) => {
  const filePath = path.join(__dirname, '../views/contracts', 'coc.html');
  res.sendFile(filePath);
});

router.post('/portal/sign-coc-interactive', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if(!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const {
      claimNumber,
      clientName,
      propertyAddressLine1,
      propertyAddressLine2,
      clientSignatureName,
      clientSignature,
      clientSignatureDate,
      contractorName,
      contractorSignature,
      contractorSignatureDate,
      docSendId // <--- If from admin-sent doc
    } = req.body;

    if(!clientName || !clientSignature) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (clientName or clientSignature)."
      });
    }

    const cocHtmlPath = path.join(__dirname, "../views/contracts", "coc.html");
    let cocHtml = fs.readFileSync(cocHtmlPath, "utf8");

    const $ = cheerio.load(cocHtml);
    $('script').remove();
    $('#clearClientSignature').remove();
    $('#clearContractorSignature').remove();

    // Remove the <p> tags that originally contained the <input> fields
    $('p:has(#claimNumber)').remove();
    $('p:has(#clientName)').remove();
    $('p:has(#propertyAddressLine1)').remove();
    $('p:has(#propertyAddressLine2)').remove();
    $('p:has(#clientSignatureName)').remove();
    $('p:has(#clientSignatureDate)').remove();
    $('p:has(#contractorName)').remove();
    $('p:has(#contractorSignatureDate)').remove();

    // Remove hidden inputs
    $('#clientSignature').remove();
    $('#contractorSignature').remove();

    // Overwrite the top-left <div style="margin-right:10px;">
    $('div[style*="margin-right:10px;"]').html(`
      <p><strong>Claim #:</strong> ${escapeHtml(claimNumber)}</p>
      <p>${escapeHtml(clientName)}</p>
      <p>${escapeHtml(propertyAddressLine1)}</p>
      <p>${escapeHtml(propertyAddressLine2)}</p>
    `);

    // Client signature block
    const clientSigDiv = $('#clientSignatureCanvas').closest('div[style*="margin-bottom:40px;"]');
    clientSigDiv.html(`
      <p style="margin:0; font-weight:bold;">
        Client Name: ${escapeHtml(clientSignatureName)}
      </p>
      <div style="margin:8px 0; width:300px; border:1px solid #ccc; border-radius:4px; position:relative;">
        <canvas 
          id="clientSignatureCanvas" 
          width="300" 
          height="100" 
          style="display:block;"
        ></canvas>
      </div>
      <p style="margin-top:0; font-size:12px;">(Signature)</p>
      <p><strong>Date:</strong> ${escapeHtml(clientSignatureDate)}</p>
    `);

    // Contractor signature block
    const contractorSigDiv = $('#contractorSignatureCanvas').closest('div[style*="margin-bottom:40px;"]');
    contractorSigDiv.html(`
      <p style="margin:0; font-weight:bold;">
        Premier Construction Group: ${escapeHtml(contractorName)}
      </p>
      <div style="margin:8px 0; width:300px; border:1px solid #ccc; border-radius:4px; position:relative;">
        <canvas 
          id="contractorSignatureCanvas" 
          width="300" 
          height="100" 
          style="display:block;"
        ></canvas>
      </div>
      <p style="margin-top:0; font-size:12px;">(Signature)</p>
      <p><strong>Date:</strong> ${escapeHtml(contractorSignatureDate)}</p>
    `);

    // Insert a script to draw each signature
    let sigScript = `<script>(function(){\n`;
    if(clientSignature && clientSignature.startsWith("data:image/png")) {
      sigScript += `
        var clientCanvas = document.getElementById("clientSignatureCanvas");
        if(clientCanvas){
          var clientCtx = clientCanvas.getContext("2d");
          var clientImg = new Image();
          clientImg.onload = function(){
            clientCtx.drawImage(clientImg, 0, 0, clientCanvas.width, clientCanvas.height);
          };
          clientImg.src = "${clientSignature}";
        }
      `;
    }
    if(contractorSignature && contractorSignature.startsWith("data:image/png")) {
      sigScript += `
        var contractorCanvas = document.getElementById("contractorSignatureCanvas");
        if(contractorCanvas){
          var contractorCtx = contractorCanvas.getContext("2d");
          var contractorImg = new Image();
          contractorImg.onload = function(){
            contractorCtx.drawImage(contractorImg, 0, 0, contractorCanvas.width, contractorCanvas.height);
          };
          contractorImg.src = "${contractorSignature}";
        }
      `;
    }
    sigScript += '})();</script>';
    $('body').append(sigScript);

    cocHtml = $.html();
    const pdfFileName = `coc-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateHtmlPdf(cocHtml, { fileName: pdfFileName });

    user.documents.coc.signed = true;
    user.documents.coc.signedAt = new Date();
    user.documents.coc.docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    // Mark docSend as signed if docSendId present
    if (docSendId) {
      const docSend = await DocumentSend.findById(docSendId);
      if (docSend) {
        if (!docSend.userId) {
          docSend.userId = user._id;
        } else if (docSend.userId.toString() !== user._id.toString()) {
          return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
      
        docSend.status = 'signed';
        docSend.signedAt = new Date();
        docSend.docUrl = `/uploads/docs/${pdfFileName}`;
        await docSend.save();
      }
      
    }

    await emailSignedContract(user, 'coc', savedPdfPath);

    return res.json({ success: true });
  } catch(err) {
    console.error("Error in POST /portal/sign-coc-interactive:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});






// GET /portal/doc/:sendId
router.get('/portal/doc/:sendId', requireLogin, async (req, res) => {
  try {
    console.log('[DEBUG /portal/doc] called with params:', req.params);
    console.log('[DEBUG /portal/doc] session user:', req.session.user);

    const sendId = req.params.sendId;
    const docSend = await DocumentSend.findById(sendId);
    console.log('[DEBUG /portal/doc] fetched DocumentSend:', docSend);

    if (!docSend) {
      console.log('[DEBUG /portal/doc] 404 – no DocumentSend');
      return res.status(404).send('Document send record not found.');
    }

    const sessionUserId = req.session.user.id.toString();
    const sessionEmail  = req.session.user.email.toLowerCase();
    console.log('[DEBUG /portal/doc] sessionUserId:', sessionUserId, 'sessionEmail:', sessionEmail);

    // Link to this user if first visit
    if (!docSend.userId) {
      console.log('[DEBUG /portal/doc] linking docSend.userId →', sessionUserId);
      docSend.userId = sessionUserId;
      await docSend.save();
    } else {
      const docUserId   = docSend.userId.toString();
      const emailMatches = docSend.recipientEmail.toLowerCase() === sessionEmail;
      console.log('[DEBUG /portal/doc] docUserId:', docUserId, 'emailMatches:', emailMatches);

      if (docUserId !== sessionUserId && !emailMatches) {
        console.log('[DEBUG /portal/doc] 403 – unauthorized');
        return res.status(403).send('You do not have permission to access this document.');
      }
    }

    // pick the correct interactive route
    let interactiveRoute;
    switch (docSend.docType) {
      case 'aob': interactiveRoute = '/portal/sign-aob-interactive'; break;
      case 'aci': interactiveRoute = '/portal/sign-aci-interactive'; break;
      case 'loi': interactiveRoute = '/portal/sign-loi-interactive'; break;
      case 'gsa': interactiveRoute = '/portal/sign-gsa-interactive'; break;
      case 'coc': interactiveRoute = '/portal/sign-coc-interactive'; break;
      default:
        console.log('[DEBUG /portal/doc] 400 – bad docType:', docSend.docType);
        return res.status(400).send('Invalid document type.');
    }

    console.log('[DEBUG /portal/doc] redirecting to:', interactiveRoute, '?docSendId=', docSend._id.toString());
    return res.redirect(`${interactiveRoute}?docSendId=${docSend._id.toString()}`);
  } catch (err) {
    console.error('[ERROR /portal/doc] uncaught:', err);
    return res.status(500).send('Server error.');
  }
});






// GET /portal/sign-aob-interactive
router.get('/portal/sign-aob-interactive', requireLogin, async (req, res) => {
  try {
    console.log('[DEBUG sign-aob] called with query:', req.query);
    const docSendId = req.query.docSendId;
    console.log('[DEBUG sign-aob] docSendId:', docSendId);

    if (!docSendId) {
      console.log('[DEBUG sign-aob] missing docSendId → 400');
      return res.status(400).json({ success: false, message: 'Missing document ID' });
    }

    const docSend = await DocumentSend.findById(docSendId);
    console.log('[DEBUG sign-aob] fetched DocumentSend:', docSend);

    if (!docSend) {
      console.log('[DEBUG sign-aob] no DocumentSend → 404');
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const sessionUserId = req.session.user.id.toString();
    const sessionEmail  = req.session.user.email.toLowerCase();
    console.log('[DEBUG sign-aob] session user:', { id: sessionUserId, email: sessionEmail });

    let idMatches = false;
    let emailMatches = false;

    if (docSend.userId) {
      idMatches = docSend.userId.toString() === sessionUserId;
    }
    emailMatches = docSend.recipientEmail.toLowerCase() === sessionEmail;

    console.log('[DEBUG sign-aob] idMatches:', idMatches, 'emailMatches:', emailMatches);

    // Link to session user if first visit or rightful user by email
    if (!docSend.userId || (!idMatches && emailMatches)) {
      console.log('[DEBUG sign-aob] assigning docSend.userId →', sessionUserId);
      docSend.userId = sessionUserId;
      await docSend.save();
      console.log('[DEBUG sign-aob] new docSend.userId:', docSend.userId.toString());
      idMatches = true;
    }

    // If still no match, block
    if (!idMatches && !emailMatches) {
      console.log('[DEBUG sign-aob] unauthorized → 403');
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Authorized: render the interactive signing page
    console.log('[DEBUG sign-aob] authorized, rendering with prefilled fields');
    const prefilled = docSend.prefilledFields || {};

    return res.render('auth/signAobInteractive', {
      pageTitle: 'Sign AOB Interactive | BlueGrass Roofing',
      prefilled,
      docSendId
    });
  } catch (err) {
    console.error('[ERROR sign-aob] GET /portal/sign-aob-interactive failed:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});






// — GET unread count
// GET /portal/messages/unread-count
router.get('/portal/messages/unread-count', requireLogin, async (req, res) => {
  try {
    const thread = await Thread.findOne({ userId: req.session.user.id });
    const count = thread
      ? thread.messages.filter(m => m.sender === 'admin' && !m.read).length
      : 0;
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.json({ count: 0 });
  }
});

// — GET the client thread (always exactly one)
// GET /portal/messages
router.get('/portal/messages', requireLogin, async (req, res) => {
  // find or create this user’s single thread
  let thread = await Thread.findOne({ userId: req.session.user.id }).populate('userId');
  if (!thread) {
    thread = new Thread({ userId: req.session.user.id });
    await thread.save();
  }
  // mark admin→client messages as read
  thread.messages.forEach(m => { if (m.sender === 'admin') m.read = true });
  await thread.save();

  res.render('auth/messages', {
    thread,
    pageTitle: 'Messages',
    activeTab: 'portal'  // if you use this to highlight portal menu
  });
});

// — POST a client message
// POST /portal/messages/:threadId/send
router.post('/portal/messages/:threadId/send', requireLogin, async (req, res) => {
  try {
    const { text } = req.body;
    const thread = await Thread.findById(req.params.threadId).populate('userId');
    if (!thread) return res.status(404).send('Not found');
    // append client message
    thread.messages.push({
      sender: 'client',
      text,
      createdAt: new Date(),
      read: false
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    // email admin every time
    await sendNewMessageEmail({
      // recipientEmail: process.env.INTERNAL_TEAM_EMAIL,
      recipientEmail: 'jevohngentry@gmail.com',
      fromAdmin: false,
      messageText: text,
      link: `${process.env.BASE_URL}/admin/messages/${thread._id}`
    });

    // socket → adminRoom
    const io = req.app.get('io');
    io.to('adminRoom').emit('newMessage', {
      threadId: thread._id,
      sender: 'client',
      text,
      createdAt: new Date().toISOString()
    });

    res.redirect('/portal/messages');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error sending');
  }
});


// ————————————————————————————————————————————————
// POST /portal/shingle-response   { answer: 'yes'|'no' }
// ————————————————————————————————————————————————
router.post('/portal/shingle-response', requireLogin, async (req,res)=>{
  try{
    const { answer } = req.body;
    if (!['yes','no'].includes(answer)) return res.redirect('/portal');

    const user = await User.findById(req.session.user.id);
    if (!user || !user.shingleProposal) return res.redirect('/portal');

    user.shingleProposal.status      = answer==='yes' ? 'accepted' : 'declined';
    user.shingleProposal.respondedAt = new Date();
    await user.save();

    // notify admin, but don’t let a mail error turn into a portal error
    try {
      await notifyAdminShingleResponse(user, answer === 'yes');
    } catch (mailErr) {
      console.error('Failed to notify admin of shingle response:', mailErr);
      // swallow it – we still want to let the user see SUCCESS
    }

    // if accepted, copy into permanent choice
    if (answer==='yes') {
      user.shingleChoice = {
        name:     user.shingleProposal.name,
        imageUrl: user.shingleProposal.imageUrls[0] || ''
      };
      await user.save();
    }

    res.redirect('/portal?success=shingle'+(answer==='yes'?'Accepted':'Declined'));
  }catch(err){
    console.error(err);
    res.redirect('/portal?error=shingleResponse');
  }
});


async function buildOpenRepairDays(rangeStart, rangeEnd, dur, ignoreId = null){

   const utc0 = dayjs(rangeStart).tz(LOCAL_TZ).startOf('day');   // 🔧 force Eastern
   const utc1 = dayjs(rangeEnd  ).tz(LOCAL_TZ).startOf('day');

  /* 1 ) pull templates once */
  const templates = await Availability.find().lean();

  /* helper: is this calendar day “on the menu”? */
/* helper: does at least one template allow this calendar day?  
   ‑ overrides (non‑recurring) take precedence over weekly */
   function dayAllowedByTemplate(d) {
    const dow = d.tz(LOCAL_TZ).day();           // 0‑6
  
    // 1) check for any override on this exact date
    const overrides = templates.filter(t =>
      !t.repeatWeekly &&
      t.dateOverride &&
      dayjs(t.dateOverride).tz(LOCAL_TZ).isSame(d, 'day')
    );
    if (overrides.length) return true;          // day enabled by override
  
    // 2) otherwise fall back to weekly templates
    return templates.some(t => t.repeatWeekly && t.dayOfWeek === dow);
  }
  

  /* 2 ) booking counts (unchanged) */
  // 2 ) booking counts  (✓ skip the booking being rescheduled)
  const bookings = await Booking.find({
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    startAt: { $lt: utc1.add(dur, 'day').toDate() },
    endAt  : { $gt: utc0.toDate() },
    status : { $ne: 'canceled' }
  }, 'startAt').lean();

  const countByDay = {};
  bookings.forEach(b=>{
    const key = dayjs(b.startAt).tz(LOCAL_TZ).startOf('day').toISOString();
    countByDay[key] = (countByDay[key]||0)+1;
  });

  /* 3 ) build list */
  const days = [];
  for(let d=utc0.clone(); d.isBefore(utc1); d=d.add(1,'day')){
    const iso = d.toISOString();

    /* a) template constraint */
    if(!dayAllowedByTemplate(d)) continue;

    /* b) capacity on first day */
    const cnt = countByDay[iso]||0;
    if( (dur>=1 && cnt>=2) || (dur===0.5 && cnt>=3) ) continue;

    /* c) consecutive‑day template + capacity */
    let ok=true;
    for(let i=0;i<Math.ceil(dur);i++){
      const cur = d.add(i,'day');
      if(!dayAllowedByTemplate(cur)){ ok=false; break; }

      const isoCur = cur.toISOString();
      const c = countByDay[isoCur]||0;
      if( (dur>=1 && c>=2) || (dur===0.5 && c>=3) ){ ok=false; break; }
    }
    if(ok) days.push(iso);
  }
  return days;
}




// GET /portal/repair-booking
router.get('/portal/repair-booking', requireLogin, async (req,res)=>{
  try {
    const { reschedule } = req.query;
    let durationDays;

    /* ── RESCHEDULE FLOW ─────────────────────────── */
    if (reschedule) {
      const booking = await Booking.findById(reschedule);
      if (!booking ||
          booking.userId.toString() !== req.session.user.id ||
          booking.type !== 'roofRepair') {
        return res.redirect('/portal');                // bad / foreign id
      }
      if (!booking.canBeRescheduled()) {
        return res.redirect('/portal?error=tooLateReschedule');
      }
      durationDays = booking.durationDays || 1;        // half / multi‑day
    }

    /* ── NEW BOOKING (invite) FLOW ───────────────── */
    if (!reschedule) {
      const invite = await RepairInvite
        .findOne({ userId:req.session.user.id, active:true }).lean();
      if (!invite) return res.redirect('/portal');
      durationDays = invite.durationDays;
    }

    res.render('auth/repairBooking', {
      duration : Number(durationDays || 1),
      pageTitle: reschedule ? 'Reschedule Roof Repair' : 'Schedule Roof Repair'
      // (no extra vars needed; wizard reads ?reschedule=… from URL)
    });
  } catch (err) {
    console.error(err);
    res.redirect('/portal');
  }
});



// GET /portal/repair-feed


dayjs.extend(utc);
dayjs.extend(tz);




// ── GET /portal/repair-feed ───────────────────────────
router.get('/portal/repair-feed', requireLogin, async (req, res) => {
  const { start, end, dur, ignoreId } = req.query;
  const durNum = Number(dur);

  console.log(
    '[repair-feed] user:', req.session.user.id,
    'start:', start,
    'end:', end,
    'dur:', durNum,
    'ignoreId:', ignoreId
  );

  if (isNaN(durNum) || durNum <= 0) {
    return res.json([]);
  }

  try {
    // 1) get the raw array of Date or ISO strings
    const rawDays = await buildOpenRepairDays(
      new Date(start),
      new Date(end),
      durNum,
      ignoreId || null
    );
    console.log('[repair-feed] computed raw days:', rawDays);

    // 2) normalize each to midnight Eastern → UTC ISO
    const days = rawDays.map(d =>
      dayjs(d)
        .tz(LOCAL_TZ)     // interpret in Eastern Time
        .startOf('day')   // midnight Eastern
        .toDate()
        .toISOString()    // e.g. "2025-07-14T04:00:00.000Z"
    );
    console.log('[repair-feed] normalized days:', days);

    return res.json(days);
  } catch (err) {
    console.error('[repair-feed] error in buildOpenRepairDays:', err);
    return res.status(500).json([]);
  }
});


// ── POST /portal/repair-booking ───────────────────────
router.post('/portal/repair-booking', requireLogin, async (req, res) => {
  try {
    const { startAt, purpose = '', bookingId } = req.body;

    // parse the incoming ISO as Eastern-time midnight
    const startDay = dayjs(startAt)
      .tz(LOCAL_TZ)       // interpret in Eastern
      .startOf('day');    // midnight Eastern

    if (!startDay.isValid()) {
      return res.status(400).json({ ok: false, msg: 'Invalid date' });
    }

    /* ───────────────────────────────
       A)  RESCHEDULE AN EXISTING BOOKING
    ─────────────────────────────── */
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (
        !booking ||
        booking.userId.toString() !== req.session.user.id ||
        booking.type !== 'roofRepair'
      ) {
        return res.status(403).json({ ok: false, msg: 'Not yours' });
      }
      if (!booking.canBeRescheduled()) {
        return res.status(400).json({
          ok: false,
          msg: 'Rescheduling requires at least 3 hours’ notice.'
        });
      }

      const dur   = booking.durationDays || 1;
      const endAt = startDay.add(dur, 'day').toDate();

      // check availability for this single day
      const okDays = await buildOpenRepairDays(
        startDay.toDate(),
        startDay.add(1, 'day').toDate(),
        dur,
        bookingId
      );
      // normalize okDays to midnight Eastern ISO
      const okDaysNorm = okDays.map(d =>
        dayjs(d)
          .tz(LOCAL_TZ)
          .startOf('day')
          .toDate()
          .toISOString()
      );
      +  /* ── DEBUG (leave it in production – it is cheap) ───────── */
  console.debug('[repair-booking]  startDay ISO  :', startDay.toDate().toISOString());
  console.debug('[repair-booking]  okDaysNorm[0] :', okDaysNorm[0]);
  console.debug('[repair-booking]  match?        :',
               okDaysNorm.includes(startDay.toDate().toISOString()));

      if (!okDaysNorm.includes(startDay.toDate().toISOString())) {
        return res
          .status(400)
          .json({ ok: false, msg: 'Day no longer available' });
      }

      // collision check (skip self)
      const clash = await Booking.overlaps(
        startDay.toDate(),
        endAt,
        bookingId
      );
      if (clash) {
        return res
          .status(409)
          .json({ ok: false, msg: 'Day already full' });
      }

      // perform the reschedule
      const oldStart = booking.startAt;
      booking.startAt = startDay.toDate();
      booking.endAt   = endAt;
      booking.purpose = purpose;
      booking.history.push({
        evt: 'rescheduled',
        by: req.session.user.id,
        details: { from: oldStart, to: startDay.toDate() }
      });
      await booking.save();

      const user = await User.findById(req.session.user.id).lean();
      await Promise.all([
        safeSend(sendClientBookingReschedule(user, booking, oldStart)),
        safeSend(sendAdminBookingReschedule(user, booking, oldStart))
      ]);
      req.app.get('io').to('calendarRoom').emit('calendarUpdated');

      return res.json({ ok: true, rescheduled: true, booking });
    }

    /* ───────────────────────────────
       B)  CREATE A NEW REPAIR BOOKING
    ─────────────────────────────── */
    const invite = await RepairInvite.findOne({
      userId: req.session.user.id,
      active: true
    });
    if (!invite) {
      return res.status(400).json({ ok: false, msg: 'No invite' });
    }

    const dur   = invite.durationDays;
    const endAt = startDay.add(dur, 'day').toDate();

    // check availability for this single day
    const okDays = await buildOpenRepairDays(
      startDay.toDate(),
      startDay.add(1, 'day').toDate(),
      dur
    );
    // normalize okDays to midnight Eastern ISO
    const okDaysNorm = okDays.map(d =>
      dayjs(d)
        .tz(LOCAL_TZ)
        .startOf('day')
        .toDate()
        .toISOString()
    );
    if (!okDaysNorm.includes(startDay.toDate().toISOString())) {
      return res
        .status(400)
        .json({ ok: false, msg: 'Day no longer available' });
    }

    // create the booking
    const booking = await Booking.create({
      userId:        req.session.user.id,
      startAt:       startDay.toDate(),
      endAt,
      durationDays:  dur,
      type:          'roofRepair',
      purpose,
      status:        'confirmed',
      isSelfService: false,
      history:       [{ evt: 'created', by: req.session.user.id }]
    });

    invite.active = false;
    await invite.save();

    const user = await User.findById(req.session.user.id).lean();
    await Promise.all([
      safeSend(sendClientRepairConfirm(user, booking)),
      safeSend(sendAdminRepairConfirm(user, booking))
    ]);
    req.app.get('io').to('calendarRoom').emit('calendarUpdated');

    res.json({ ok: true, booking });
  } catch (err) {
    console.error('[repair-booking] error:', err);
    res.status(500).end();
  }
});

module.exports = router;
