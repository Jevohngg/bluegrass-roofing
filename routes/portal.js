// routes/portal.js
const express = require('express');
const router = express.Router();
const { uploadClaim } = require('../utils/aws');
const User = require('../models/User');

// Middleware: ensure user is logged in
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// GET /portal
router.get('/portal', requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    // For success/error flash messages
    const { success, error } = req.query;

    // Define an array of shingle objects
    const shingles = [
      { name: 'GAF Timberline HDZ Charcoal', imageUrl: '/images/shingles/charcoal.jpg' },
      { name: 'CertainTeed Landmark Moire Black', imageUrl: '/images/shingles/moire-black.jpg' },
      { name: 'Owens Corning Duration Estate Gray', imageUrl: '/images/shingles/estate-gray.jpg' }
    ];

    // Render portal.pug, passing user & shingles
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

// 1) POST /portal/upload-claim
// Switch to .array() for multiple files; up to 10 for demonstration
router.post('/portal/upload-claim', requireLogin, uploadClaim.array('claimFiles', 10), async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    // Fallback for old single-file field name
    // (If no 'claimFiles' array was uploaded, check 'claimFile')
    if ((!req.files || !req.files.length) && req.file) {
      req.files = [req.file];
    }

    // If not an AJAX request, handle old single-file fallback
    if (!req.xhr) {
      // Original single-file logic:
      if (req.files && req.files.length > 0 && req.files[0].location) {
        // Store at least the first file in old single slot
        user.claimUploadUrl = req.files[0].location;

        // Also store in array
        user.claimUploadUrls = user.claimUploadUrls || [];
        user.claimUploadUrls.push(req.files[0].location);
        await user.save();
        return res.redirect('/portal?success=claimUploaded');
      } else {
        return res.redirect('/portal?error=claimNotUploaded');
      }
    } else {
      // New multi-file AJAX logic
      if (req.files && req.files.length > 0) {
        user.claimUploadUrls = user.claimUploadUrls || [];
        req.files.forEach((file) => {
          user.claimUploadUrls.push(file.location);
          // Keep single-file URL in sync with the first file
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
    // For AJAX requests:
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Upload Error' });
    }
    return res.redirect('/portal?error=uploadError');
  }
});

// 2) POST /portal/sign-document
// Body: { docType: 'aob'|'aci'|'loi' }
router.post('/portal/sign-document', requireLogin, async (req, res) => {
  try {
    const { docType } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    if (['aob', 'aci', 'loi'].includes(docType)) {
      // If we want a simple "click to sign," do it here:
      user.documents[docType].signed = true;
      user.documents[docType].signedAt = new Date();

      // If AOB is signed, no need for ACI/LOI
      if (docType === 'aob') {
        user.documents.aci.signed = false;
        user.documents.aci.signedAt = null;
        user.documents.loi.signed = false;
        user.documents.loi.signedAt = null;
      }

      await user.save();
      return res.redirect(`/portal?success=${docType}Signed`);
    } else {
      return res.redirect('/portal?error=invalidDocType');
    }
  } catch (err) {
    console.error('Error signing doc:', err);
    return res.redirect('/portal?error=docSignError');
  }
});

// 3) POST /portal/select-shingle
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

/**
 * 4) GET /portal/sign-doc?docType=aob|aci|loi
 *    Display a modal/page to capture actual signature from user
 */
router.get('/portal/sign-doc', requireLogin, async (req, res) => {
  const { docType } = req.query;
  if (!['aob', 'aci', 'loi'].includes(docType)) {
    return res.redirect('/portal?error=invalidDocType');
  }
  try {
    // For demonstration, let's show a simple doc content
    // In production, you might load a template from DB or file
    let docTitle = '';
    let docContent = '';
    switch (docType) {
      case 'aob':
        docTitle = 'Assignment of Benefits (AOB)';
        docContent = 'Full text of your AOB contract goes here...';
        break;
      case 'aci':
        docTitle = 'Authorization to Contact Insurer (ACI)';
        docContent = 'Full text of your ACI contract goes here...';
        break;
      case 'loi':
        docTitle = 'Letter of Intent (LOI)';
        docContent = 'Full text of your LOI contract goes here...';
        break;
    }

    // Render a separate doc-sign page (docSign.pug) with signature pad
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

/**
 * 5) POST /portal/sign-doc
 *    Actually save the signature (base64) to user.documents[docType]
 *    This is for a "real" e-sign approach with a signature pad
 */
router.post('/portal/sign-doc', requireLogin, async (req, res) => {
  try {
    const { docType, signatureData } = req.body; // signatureData is base64
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    user.documents[docType].signed = true;
    user.documents[docType].signedAt = new Date();
    user.documents[docType].signatureData = signatureData;

    // If AOB is signed, reset others
    if (docType === 'aob') {
      user.documents.aci.signed = false;
      user.documents.aci.signedAt = null;
      user.documents.aci.signatureData = undefined;
      user.documents.loi.signed = false;
      user.documents.loi.signedAt = null;
      user.documents.loi.signatureData = undefined;
    }

    await user.save();
    return res.redirect(`/portal?success=${docType}Signed`);
  } catch (err) {
    console.error('Error saving doc signature:', err);
    return res.redirect('/portal?error=docSignError');
  }
});

module.exports = router;
