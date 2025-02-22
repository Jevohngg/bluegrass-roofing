/****************************************
 * routes/onboarding.js
 ****************************************/
const express = require('express');
const router = express.Router();
const { uploadClaim } = require('../utils/aws'); // or your AWS/multer config
const User = require('../models/User');
const {
  generateContractPDF,
  fillContractPlaceholders,
  parseMarkdownToHtml
} = require('../utils/docGenerator');
const {
  sendUserDocSignedEmail,
  sendTeamDocSignedEmail
} = require('../utils/sendEmail');
const bcryptjs = require('bcryptjs');

/****************************************************
 * Shingle Array (same as in the portal)
 ****************************************************/
const SHINGLE_LIST = [
  { name: 'Asphalt 3-Tab', imageUrl: '/images/shingles/asphalt-3tab.jpg' },
  { name: 'Architectural Asphalt', imageUrl: '/images/shingles/architectural-asphalt.jpg' },
  { name: 'Luxury Asphalt', imageUrl: '/images/shingles/luxury-asphalt.jpg' },
  { name: 'Synthetic Slate', imageUrl: '/images/shingles/synthetic-slate.jpg' },
  { name: 'Synthetic Cedar Shake', imageUrl: '/images/shingles/synthetic-cedar.jpg' },
  { name: 'Rubber', imageUrl: '/images/shingles/rubber.jpg' },
  { name: 'Wood Shingle', imageUrl: '/images/shingles/wood-shingle.jpg' },
  { name: 'Wood Shake', imageUrl: '/images/shingles/wood-shake.jpg' },
  { name: 'Aluminum', imageUrl: '/images/shingles/aluminum.jpg' },
  { name: 'Steel', imageUrl: '/images/shingles/steel.jpg' },
  { name: 'Copper', imageUrl: '/images/shingles/copper.jpg' },
  { name: 'Zinc', imageUrl: '/images/shingles/zinc.jpg' },
  { name: 'Clay Tile', imageUrl: '/images/shingles/clay-tile.jpg' },
  { name: 'Concrete Tile', imageUrl: '/images/shingles/concrete-tile.jpg' },
  { name: 'Natural Slate', imageUrl: '/images/shingles/natural-slate.jpg' },
  { name: 'Solar', imageUrl: '/images/shingles/solar.jpg' },
  { name: 'Fiberglass', imageUrl: '/images/shingles/fiberglass.jpg' },
  { name: 'Green Roof', imageUrl: '/images/shingles/green-roof.jpg' }
];

/****************************************************
 * AOB Template from Portal (with extra blank lines)
 ****************************************************/
const AOB_TEMPLATE = `
ASSIGNMENT OF BENEFITS (AOB)
**Date: [Insert Date]**


**Parties:**  

• **Homeowner**: **[Homeowner’s Full Name]**, residing at **[Property Address]**  
• **Contractor**: BlueGrass Roofing, 123 Mock Lane, Louisville, KY 40202  


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
`;

/****************************************************
 * Session Initialization
 ****************************************************/
function ensureOnboardingSession(req) {
  if (!req.session.onboarding) {
    req.session.onboarding = {
      docFields: {
        firstName: '',
        lastName: '',
        propertyAddress: '',
        insuranceCompany: '',
        policyNumber: '',
        claimNumber: ''
      },
      claimFiles: [],
      aob: {
        signed: false,
        docUrl: '',
      },
      shingleChoice: {},
    };
  }
}

/****************************************************
 * GET /onboarding/shingles
 ****************************************************/
router.get('/shingles', (req, res) => {
  return res.json({ success: true, shingles: SHINGLE_LIST });
});

/****************************************************
 * STEP 1: UPLOAD CLAIM FILES
 ****************************************************/
router.post('/upload-claim', uploadClaim.array('claimFiles'), async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const uploadedUrls = req.files.map(file => file.location || file.path);
    req.session.onboarding.claimFiles.push(...uploadedUrls);
    return res.json({ success: true, files: req.session.onboarding.claimFiles });
  } catch (err) {
    console.error('Error uploading claim:', err);
    return res.status(500).json({ success: false, message: 'Error uploading claim files.' });
  }
});

/****************************************************
 * DELETE FILE FROM SESSION
 ****************************************************/
router.post('/delete-claim', async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const { fileUrl } = req.body;
    req.session.onboarding.claimFiles = req.session.onboarding.claimFiles.filter(url => url !== fileUrl);
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file from session:', err);
    return res.status(500).json({ success: false, message: 'Error deleting file.' });
  }
});

/****************************************************
 * STEP 2A: UPDATE DOC FIELDS
 ****************************************************/
router.post('/update-fields', async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const {
      firstName,
      lastName,
      propertyAddress,
      insuranceCompany,
      policyNumber,
      claimNumber
    } = req.body;

    if (!firstName || !lastName || !propertyAddress || !insuranceCompany || !policyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (first/last name, address, company, or policy).'
      });
    }

    req.session.onboarding.docFields = {
      firstName,
      lastName,
      propertyAddress,
      insuranceCompany,
      policyNumber,
      claimNumber: claimNumber || ''
    };

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating doc fields:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error updating doc fields.'
    });
  }
});

/****************************************************
 * GET /onboarding/aob-doc
 * Generates AOB contract content with placeholders
 ****************************************************/
router.get('/aob-doc', (req, res) => {
  try {
    ensureOnboardingSession(req);
    const {
      firstName,
      lastName,
      propertyAddress,
      insuranceCompany,
      policyNumber,
      claimNumber
    } = req.session.onboarding.docFields;

    if (!firstName || !lastName || !propertyAddress || !insuranceCompany || !policyNumber) {
      return res.status(400).json({
        success: false,
        message: 'Doc fields are incomplete. Please fill them out first.'
      });
    }

    const dateStr = new Date().toLocaleDateString();
    const fullName = `${firstName} ${lastName}`.trim();

    // The placeholders from the original portal AOB:
    // [Insert Date], [Homeowner’s Full Name], [Property Address], [Insurance Company Name],
    // [Policy Number], [Claim Number], [Contract Date]
    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': fullName,
      'Property Address': propertyAddress,
      'Insurance Company Name': insuranceCompany,
      'Policy Number': policyNumber,
      'Claim Number': claimNumber || 'N/A',
      'Contract Date': dateStr
    };

    let filledText = fillContractPlaceholders(AOB_TEMPLATE, replacements);
    const docHtml = parseMarkdownToHtml(filledText);

    return res.json({ success: true, docHtml });
  } catch (err) {
    console.error('Error generating AOB doc preview:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error generating doc preview.'
    });
  }
});

/****************************************************
 * STEP 2B: SIGN AOB
 ****************************************************/
router.post('/sign-aob', async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const { signatureData } = req.body;
    const docFields = req.session.onboarding.docFields;

    if (!signatureData) {
      return res.status(400).json({ success: false, message: 'Missing signature data.' });
    }

    const dateStr = new Date().toLocaleDateString();
    const fullName = `${docFields.firstName} ${docFields.lastName}`.trim();

    // Same placeholders as above
    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': fullName,
      'Property Address': docFields.propertyAddress,
      'Insurance Company Name': docFields.insuranceCompany,
      'Policy Number': docFields.policyNumber,
      'Claim Number': docFields.claimNumber || 'N/A',
      'Contract Date': dateStr
    };

    let filledText = fillContractPlaceholders(AOB_TEMPLATE, replacements);

    const pdfOptions = {
      fileName: `AOB-${Date.now()}.pdf`,
      docTitle: 'Assignment of Benefits (AOB)',
      userName: fullName || 'New Roofing Customer',
      signedAt: new Date()
    };

    const pdfPath = await generateContractPDF(filledText, signatureData, pdfOptions);

    req.session.onboarding.aob = {
      signed: true,
      docUrl: `/uploads/docs/${pdfOptions.fileName}`
    };
    req.session.onboarding.aobPdfPath = pdfPath;

    return res.json({
      success: true,
      docUrl: req.session.onboarding.aob.docUrl
    });
  } catch (err) {
    console.error('Error signing AOB:', err);
    return res.status(500).json({ success: false, message: 'Server error signing AOB.' });
  }
});

/****************************************************
 * STEP 3: SELECT SHINGLE
 ****************************************************/
router.post('/select-shingle', (req, res) => {
  try {
    ensureOnboardingSession(req);
    const { shingleName, shingleImageUrl } = req.body;
    if (!shingleName || !shingleImageUrl) {
      return res.status(400).json({ success: false, message: 'Shingle name and image URL are required.' });
    }
    req.session.onboarding.shingleChoice = { name: shingleName, imageUrl: shingleImageUrl };
    return res.json({ success: true });
  } catch (err) {
    console.error('Error selecting shingle:', err);
    return res.status(500).json({ success: false, message: 'Server error selecting shingle.' });
  }
});

/****************************************************
 * FINAL SIGNUP
 ****************************************************/
router.post('/final-signup', async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 chars.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already in use. Please log in or use a different email.' });
    }

    // Build new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      password,
      claimUploadUrls: req.session.onboarding.claimFiles || [],
      documents: {
        aob: {
          signed: req.session.onboarding.aob.signed,
          signedAt: new Date(),
          docUrl: req.session.onboarding.aob.docUrl,
          fields: {
            propertyAddress: req.session.onboarding.docFields.propertyAddress,
            insuranceCompany: req.session.onboarding.docFields.insuranceCompany,
            policyNumber: req.session.onboarding.docFields.policyNumber,
            claimNumber: req.session.onboarding.docFields.claimNumber
          }
        },
        aci: {},
        loi: {}
      },
      shingleChoice: {
        name: req.session.onboarding.shingleChoice.name || '',
        imageUrl: req.session.onboarding.shingleChoice.imageUrl || ''
      }
    });

    await newUser.save();

    // Email doc if present
    if (req.session.onboarding.aobPdfPath) {
      await sendUserDocSignedEmail(newUser, 'aob', req.session.onboarding.aobPdfPath);
      await sendTeamDocSignedEmail(newUser, 'aob', req.session.onboarding.aobPdfPath);
    }

    // Log in the user
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      firstName: newUser.firstName,
      selectedPackage: newUser.selectedPackage
    };

    delete req.session.onboarding;

    return res.json({ success: true, redirectUrl: '/portal' });
  } catch (err) {
    console.error('Error final signup:', err);
    return res.status(500).json({ success: false, message: 'Server error during final signup.' });
  }
});

module.exports = router;
