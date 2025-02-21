const express = require('express');
const router = express.Router();
const path = require('path');
const { S3 } = require('aws-sdk');
const User = require('../models/User');
const { fillContractPlaceholders, parseMarkdownToHtml, generateContractPDF } = require('../utils/docGenerator');
const { sendUserDocSignedEmail, sendTeamDocSignedEmail } = require('../utils/sendEmail'); // Import new email functions

const { uploadClaim } = require('../utils/aws');

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

const CONTRACT_TEMPLATES = {
  aob: `
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
`,

  aci: `
AUTHORIZATION TO CONTACT INSURER (ACI)
**Date: [Insert Date]**

**Parties:**  
• **Homeowner**: **[Homeowner’s Full Name]**, residing at **[Property Address]**  
• **Contractor**: BlueGrass Roofing, 123 Mock Lane, Louisville, KY 40202  

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
123 Mock Lane, Louisville, KY 40202

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

router.get('/portal', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const { success, error } = req.query;

    const shingles = [
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
    
    res.render('auth/portal', {
      currentPage: 'portal',
      userName: user.firstName,
      packageName: user.selectedPackage,
      user,
      shingles,
      success,
      error
    });
  } catch (err) {
    console.error('Error loading portal:', err);
    return res.status(500).send('Server error');
  }
});

router.post('/portal/upload-claim', requireLogin, uploadClaim.array('claimFiles', 10), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if ((!req.files || !req.files.length) && req.file) {
      req.files = [req.file];
    }

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

router.get('/portal/sign-doc', requireLogin, async (req, res) => {
  const { docType } = req.query;
  if (!['aob', 'aci', 'loi'].includes(docType)) {
    return res.redirect('/portal?error=invalidDocType');
  }
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    const fields = user.documents[docType].fields || {};

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

    console.log('User fetched in POST /portal/sign-doc:', user); // Debug log

    const { docType, signatureData } = req.body;
    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    const signedAt = new Date();
    user.documents[docType].signed = true;
    user.documents[docType].signedAt = signedAt;

    if (docType === 'aob') {
      user.documents.aci.signed = false;
      user.documents.aci.signedAt = null;
      user.documents.aci.docUrl = '';
      user.documents.loi.signed = false;
      user.documents.loi.signedAt = null;
      user.documents.loi.docUrl = '';
    }

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

    const pdfFileName = `${docType}-${user._id}-${Date.now()}.pdf`;
    const savedPdfPath = await generateContractPDF(filledText, signatureData, {
      fileName: pdfFileName,
      docTitle: docTitle,
      userName: `${user.firstName} ${user.lastName}`,
      signedAt: signedAt
    });

    user.documents[docType].docUrl = `/uploads/docs/${pdfFileName}`;
    await user.save();

    // Send emails with logging
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

module.exports = router;