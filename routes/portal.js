const express = require('express');
const router = express.Router();
const { uploadClaim } = require('../utils/aws');
const User = require('../models/User');
const { S3 } = require('aws-sdk');
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

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

// POST /portal/upload-claim
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

// POST /portal/delete-claim
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

    // Log the fileUrl for debugging
    console.log('Attempting to delete file with URL:', fileUrl);

    // Extract the S3 Key from the fileUrl
    let key;
    try {
      const url = new URL(fileUrl);
      key = decodeURIComponent(url.pathname.substring(1)); // Remove leading '/' and decode
      console.log('Extracted S3 Key:', key);
    } catch (err) {
      console.error('Error parsing fileUrl:', err);
      return res.status(400).json({ success: false, message: 'Invalid file URL format' });
    }

    if (!key) {
      return res.status(400).json({ success: false, message: 'Unable to extract S3 Key from URL' });
    }

    // Remove from user's schema
    user.claimUploadUrls = user.claimUploadUrls.filter(url => url !== fileUrl);
    if (user.claimUploadUrl === fileUrl) {
      user.claimUploadUrl = user.claimUploadUrls[0] || '';
    }

    // Delete from S3
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key
    }).promise();

    await user.save();
    return res.status(200).json({ success: true, message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting claim:', err);
    return res.status(500).json({ success: false, message: 'Delete Error' });
  }
});

// POST /portal/sign-document
router.post('/portal/sign-document', requireLogin, async (req, res) => {
  try {
    const { docType } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    if (['aob', 'aci', 'loi'].includes(docType)) {
      user.documents[docType].signed = true;
      user.documents[docType].signedAt = new Date();

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

// POST /portal/select-shingle
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
 * GET /portal/sign-doc?docType=aob|aci|loi
 * Display a modal/page to capture actual signature from user
 */
router.get('/portal/sign-doc', requireLogin, async (req, res) => {
  const { docType } = req.query;
  if (!['aob', 'aci', 'loi'].includes(docType)) {
    return res.redirect('/portal?error=invalidDocType');
  }
  try {
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
 * POST /portal/sign-doc
 * Actually save the signature (base64) to user.documents[docType]
 */
router.post('/portal/sign-doc', requireLogin, async (req, res) => {
  try {
    const { docType, signatureData } = req.body;
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    if (!['aob', 'aci', 'loi'].includes(docType)) {
      return res.redirect('/portal?error=invalidDocType');
    }

    user.documents[docType].signed = true;
    user.documents[docType].signedAt = new Date();
    user.documents[docType].docUrl = signatureData; // Store signature data as URL or base64

    if (docType === 'aob') {
      user.documents.aci.signed = false;
      user.documents.aci.signedAt = null;
      user.documents.aci.docUrl = undefined;
      user.documents.loi.signed = false;
      user.documents.loi.signedAt = null;
      user.documents.loi.docUrl = undefined;
    }

    await user.save();
    return res.redirect(`/portal?success=${docType}Signed`);
  } catch (err) {
    console.error('Error saving doc signature:', err);
    return res.redirect('/portal?error=docSignError');
  }
});

module.exports = router;