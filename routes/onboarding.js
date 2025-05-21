/****************************************
 * routes/onboarding.js
 ****************************************/
const express = require('express');
const router = express.Router();
const { uploadClaim } = require('../utils/aws'); // or your AWS/multer config
const User = require('../models/User');
const {
  generateHtmlPdf,       // Puppeteer-based PDF generator
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
 * AOB Template (with Client/Homeowner signature block at bottom)
 ****************************************************/
const AOB_TEMPLATE = `
  <h2 style="text-align:center;">BLUEGRASS ROOFING ASSIGNMENT OF BENEFITS (AOB)</h2>

  <p>
    This Assignment of Benefits (AOB) is entered into to streamline and simplify the insurance claims process related to roofing services. By signing this agreement, the Client authorizes Bluegrass Roofing (Premier Construction Group, LLC) to act on their behalf in matters relating to insurance claims, including but not limited to filing, negotiating, and settling claims for roofing repairs or replacement. This agreement is designed to relieve the Client of the administrative burden and facilitate the timely and professional completion of the necessary roofing work.
  </p>
  <p><p>
  <p><strong>Date:</strong> [Insert Date]</p>
  <p><p>
  <h3>Identification of Parties</h3>
  <p><strong>This agreement is made between:</strong></p>
  <ul>
    <li>
      <strong>Contractor:</strong> 
      Bluegrass Roofing, a DBA of Premier Construction Group, LLC, a licensed roofing contractor operating in the State of Kentucky 
      (hereinafter referred to as "Contractor")
    </li>
    <li>
      <p><strong>Client/Homeowner:</strong><p>
      <p>
        <strong>Client Name:</strong> [Homeowner’s Full Name]<br>
        <strong>Property Address:</strong> [Property Address]<br>
        <strong>Phone Number:</strong> [Phone Number]<br>
        <strong>Email Address:</strong> [Email Address]
      </p>
    </li>
  </ul>

  <p>
    By signing this AOB, the Client assigns to the Contractor all applicable rights, benefits, and interests under 
    their property insurance policy regarding roofing services required due to damage or loss.
  </p>
  <p>
    This includes the right to file and manage insurance claims, obtain claim-related documentation, communicate and negotiate directly with the insurance company, receive payments issued under the policy, and, if necessary, pursue legal action to recover owed benefits. This assignment is made in exchange for the Contractor’s agreement to complete the scope of work approved by the insurer, subject to the terms and conditions stated herein.
  </p>
  <p><p>
  <h3>1. SCOPE OF ASSIGNMENT</h3>
  <p>
    This Assignment of Benefits applies to all roofing-related insurance claims, regardless of the specific cause of damage. Covered claim types may include, but are not limited to, damage resulting from hail, wind, storms, fire, water intrusion, tree impact, and any other peril covered under the Client’s property insurance policy that affects the roofing system.
  </p>
  <p>
    The Contractor is authorized to act on the Client’s behalf in connection with any such claim related to 
    roofing repairs or replacement.
  </p>
  <p>
    This Assignment may be executed before or after an insurance claim is filed.
  </p>
  <ul>
    <li>
      <em>If executed before claim filing</em>, the Contractor is authorized to assist the Client in initiating the 
      claim process with the insurance company.
    </li>
    <li>
      <em>If executed after a claim has been filed</em>, the Contractor is authorized to manage the existing claim, 
      including communication and negotiation with the insurer regarding the approved scope of work and payment.
    </li>
  </ul>
  <p>
    This Assignment applies explicitly to services provided by the Contractor that are directly related to the insured roofing loss, including but not limited to roof inspections and assessments, preparation and submission of estimates or documentation to the insurer, negotiation of claim terms and scope of work, removal of damaged roofing materials, installation of new roofing systems or materials, coordination with insurance adjusters and representatives, collection of insurance proceeds payable for roofing work, and any necessary administrative or legal steps related to insurance recovery for roofing services.
  </p>
  <p>
    The Contractor agrees to perform all work in a professional and timely manner, in accordance with industry standards and the terms of the Client’s insurance policy, subject to the limitations and conditions set forth in this agreement.
  </p>
  <p><p>
  <h3>2. AUTHORIZATION AND TRANSFER OF RIGHTS</h3>
  <p>
    By signing this Assignment of Benefits, the Client hereby assigns and transfers to Bluegrass Roofing (Premier Construction Group, LLC) all applicable rights and benefits under their property insurance policy related to the roofing loss. This assignment includes, but is not limited to, the following rights:
  </p>
  <p><p>
  <h4>2.1 Right to File Insurance Claims on Client’s Behalf</h4>
  <p>
    The Contractor is authorized to initiate, prepare, and file property insurance claims related to roofing damage directly with the Client’s insurance company. This includes submitting any necessary documentation, estimates, photographs, or other supporting materials required to process the claim.
  </p>
  <p><p>
  <h4>2.2 Right to Communicate, Negotiate, and Settle Claims</h4>
  <p>
    The Contractor is granted full authority to communicate directly with the insurance company, its representatives, and assigned adjusters for the purpose of negotiating the scope, value, and terms of the claim. The Contractor may also settle the claim directly on behalf of the Client, subject to the scope of work outlined in the insurer’s final approval.
  </p>
  <p><p>
  <h4>2.3 Right to Receive Claim-Related Information and Documentation</h4>
  <p>
    The Client authorizes the insurance company to release to the Contractor all documents, records, and communications related to the claim, including policy declarations, coverage details, adjuster reports, payment summaries, and supplement approvals and correspondence.
  </p>
  <p><p>
  <h4>2.4 Right to Direct Payment from Insurance Company</h4>
  <p>
    The Client assigns the right to receive any and all insurance proceeds related to the roofing work directly to Bluegrass Roofing. The Client authorizes the insurance company to issue checks or electronic payments payable solely to the Contractor to avoid delays and simplify the process.
  </p>
  <p><p>
  <h4>2.5 Right to Pursue Litigation or Legal Action</h4>
  <p>
    In the event the insurance company fails to properly honor or pay the claim, the Contractor is authorized to take reasonable legal action on the Client’s behalf to enforce payment, subject to applicable laws. This includes engaging legal counsel, submitting demands, or pursuing litigation or arbitration to recover owed funds for completed or contracted roofing work.
  </p>
  <p>
    The Client understands and agrees that these rights are being transferred for the limited purpose of facilitating 
    the repair and restoration of their roof and the efficient handling of the related insurance claim.
  </p>
  <p><p>
  <h3>3. CLIENT ACKNOWLEDGMENT AND TRANSPARENCY STATEMENT</h3>
  <p>
    By signing this Assignment of Benefits (AOB), the Client affirms that they have read, understood, and voluntarily entered into this agreement. The Contractor has explained the purpose and effect of the AOB, and the Client has had the opportunity to ask questions and receive answers before signing.
  </p>
  <p>
    The Client expressly consents to assign to Bluegrass Roofing (Premier Construction Group, LLC) all rights and benefits under their property insurance policy that are necessary to carry out the services described in this agreement. This includes but is not limited to filing and managing the insurance claim, communicating with the insurer, negotiating the scope and value of the claim, and receiving direct payment of insurance proceeds.
  </p>
  <p>
    This AOB does authorize Bluegrass Roofing (Premier Construction Group, LLC) to handle the roofing insurance claim from start to finish on the Client’s behalf, communicate directly with the insurer and adjusters, negotiate and settle the claim, collect insurance payments directly from the insurance company, and perform the roofing repairs or replacement as approved by the insurer.
  </p>
  <p>
    This AOB does <strong>not</strong> authorize Bluegrass Roofing to make changes to the Client’s insurance policy, incur charges unrelated to the roofing claim, or collect funds in excess of the agreed-upon insurance scope unless approved in writing by the Client.
  </p>
  <p>
    The purpose of this agreement is to simplify the claims process, ensure that the roofing project is handled professionally, and protect the Client from administrative burdens. The Client retains the right to receive copies of all documentation related to the claim and roofing work upon request.
  </p>
  <p><p>
  <h3>4. PAYMENT TERMS AND FINANCIAL RESPONSIBILITY</h3>
  <p>
    The Client authorizes and directs their insurance company to issue all payments related to the roofing claim directly to Bluegrass Roofing (Premier Construction Group, LLC). This includes any initial, supplemental, or final claim payments. The Contractor will apply these proceeds exclusively to the roofing services performed under this agreement.
  </p>
  <p>
    The Client remains solely responsible for paying their insurance policy deductible. The insurer does not cover this amount, and it must be paid directly to the Contractor in accordance with the agreed project schedule or as otherwise required under applicable law.
  </p>
  <p>
    If the Client’s insurance policy includes non-recoverable depreciation or other out-of-pocket costs, the Client agrees to pay those amounts directly to the Contractor. The insurer typically discloses these costs in the claim summary or Explanation of Benefits (EOB). The Contractor will assist in clarifying these terms upon request.
  </p>
  <p>
    The Contractor agrees not to charge the Client any fees or costs beyond what is covered by the insurance claim and identified deductible or depreciation amounts unless the Client requests additional work or materials and such changes are documented in a written change order signed by both parties.
  </p>
  <p><p>
  <h3>5. PRICE GUARANTEE (CONDITIONAL UPON AOB)</h3>
  <p>
    Upon execution of this Assignment of Benefits (AOB), Bluegrass Roofing (Premier Construction Group, LLC) guarantees the completion of all roofing repairs or replacements as outlined in the scope of work approved by the Client’s insurance provider. This guarantee applies to the full insurer-approved amount and ensures that the project will be completed professionally and in accordance with the standards of the insurance settlement.
  </p>
  <p>
    Under this Price Guarantee, the Client is responsible only for their insurance deductible and any unrecoverable depreciation or out-of-pocket costs not covered by their insurance policy. Bluegrass Roofing will bill directly to and collect from the insurance company all other approved costs associated with the roofing work.
  </p>
  <p>
    There will be no additional charges to the Client beyond the amounts stated above unless the Client requests changes or upgrades beyond the insurer-approved scope. Any such changes must be agreed to in writing through a signed change order.
  </p>
  <p>
    This Price Guarantee is part of Bluegrass Roofing’s commitment to honesty, transparency, and a hassle-free experience. By signing this AOB, the Client can confidently rely on the Contractor to manage the claim and complete the work without unexpected costs.
  </p>
  <p><p>
  <h3>6. REVOCATION AND CANCELLATION</h3>
  <p>
    The Client retains the right to revoke or cancel this Assignment of Benefits (AOB) only to the extent state law permits. Any such revocation must comply with statutory notice periods and formalities if required. Clients are encouraged to consult their state’s consumer protection laws or contact the Contractor with any questions before initiating a revocation.
  </p>
  <p>
    To revoke or cancel this Assignment, the Client must submit a written notice of revocation to:
    <br><br>
    <strong>Bluegrass Roofing (Premier Construction Group, LLC)</strong><br>
    3217 Summit Square Place, Suite 100<br>
    Info@bluegrass-roofing.com
  </p>
  <p>
    The written notice must clearly state the Client’s intent to revoke the AOB and must be signed and dated by the Client. The revocation is not effective until it is received and acknowledged in writing by the Contractor.
  </p>
  <p>
    In the event of a valid revocation:
  </p>
  <ul>
    <li>
      The Client remains responsible for any work already performed by the Contractor up to the date of revocation, including the payment of any amounts due for labor, materials, or services rendered.
    </li>
    <li>
      The Contractor will cease all communications with the insurer and halt any additional work not already performed.
    </li>
    <li>
      The Client may be required to handle the remainder of the insurance claim process, including communication with the insurer and payment coordination.
    </li>
  </ul>
  <p>
    Revocation of this AOB does not relieve the Client of payment obligations for work authorized and completed prior to revocation.
  </p>
  <p><p>
  <h3>7. WARRANTIES AND WORKMANSHIP</h3>
  <p>
    Bluegrass Roofing (Premier Construction Group, LLC) stands behind the quality of its work and offers a 1-year workmanship warranty on all roofing services completed under this agreement. This warranty covers defects in installation and workmanship under normal use and conditions.
  </p>
  <p>
    If a covered issue arises within the warranty period, Bluegrass Roofing will repair or correct the problem at no cost to the Client, subject to the warranty terms and conditions.
  </p>
  <p>
    <strong>Note:</strong> The specific terms and duration of the workmanship warranty may vary depending on the type of roofing system installed. Clients will receive a separate warranty document detailing full coverage and limitations.
  </p>
  <p>
    In addition to the workmanship warranty, roofing materials used may be covered by manufacturer warranties, which typically include coverage for material defects over a specified period, depending on the product. Bluegrass Roofing will assist the Client in registering applicable manufacturer warranties and provide all relevant documentation upon project completion.
  </p>
  <p>
    The Client acknowledges that manufacturer warranties are subject to the terms, conditions, and registration requirements set by the manufacturer and are separate from the Contractor’s workmanship warranty.
  </p>
  <p><p>
  <h3>8. CLIENT ACKNOWLEDGMENT AND SIGNATURE</h3>
  <p>
    By signing below, the Client acknowledges that they have read and fully understand the terms and conditions of this Assignment of Benefits (AOB). The Client affirms that they have had an opportunity to ask questions and receive clarification and voluntarily agree to assign the relevant rights and benefits of their insurance policy to Bluegrass Roofing (Premier Construction Group, LLC) for the purposes stated in this agreement.
  </p>
  <p>
    The Client understands that this AOB authorizes the Contractor to manage the insurance claim process, communicate with the insurer, receive payment directly, and perform the roofing services necessary to restore the insured property.
  </p>

  <!-- Additional signature block -->
  <hr>
  <h3>Client/Homeowner Signature</h3>
  <p>
    <strong>[Homeowner’s Full Name]</strong><br>
    [SIGNATURE_IMAGE]
  </p>
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
        phoneNumber: '',
        email: ''
      },
      claimFiles: [],
      aob: {
        signed: false,
        docUrl: ''
      },
      shingleChoice: {}
    };
  }
}

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
      phoneNumber,
      email
    } = req.body;

    if (!firstName || !lastName || !propertyAddress || !phoneNumber || !email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (first/last name, address, phone, or email).'
      });
    }

    // Update session fields
    req.session.onboarding.docFields = {
      firstName,
      lastName,
      propertyAddress,
      phoneNumber,
      email
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
 * Returns the final AOB HTML (for preview)
 ****************************************************/
router.get('/aob-doc', (req, res) => {
  try {
    ensureOnboardingSession(req);
    const {
      firstName,
      lastName,
      propertyAddress,
      phoneNumber,
      email
    } = req.session.onboarding.docFields;

    if (!firstName || !lastName || !propertyAddress || !phoneNumber || !email) {
      return res.status(400).json({
        success: false,
        message: 'Doc fields are incomplete. Please fill them out first.'
      });
    }

    const dateStr = new Date().toLocaleDateString();
    const fullName = `${firstName} ${lastName}`.trim();

    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': fullName,
      'Property Address': propertyAddress,
      'Phone Number': phoneNumber,
      'Email Address': email,
      'Contract Date': dateStr
    };

    // Fill placeholders & convert to HTML
    const filledText = fillContractPlaceholders(AOB_TEMPLATE, replacements);
     let docHtml = parseMarkdownToHtml(filledText);
     docHtml = docHtml.replace('[SIGNATURE_IMAGE]', '');

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
 * STEP 2B: SIGN AOB - Generate PDF with Puppeteer
 ****************************************************/
router.post('/sign-aob', async (req, res) => {
  try {
    ensureOnboardingSession(req);
    const { signatureData } = req.body;
    const docFields = req.session.onboarding.docFields;

    if (!signatureData) {
      return res.status(400).json({ success: false, message: 'Missing signature data.' });
    }

    const {
      firstName,
      lastName,
      propertyAddress,
      phoneNumber,
      email
    } = docFields;

    const dateStr = new Date().toLocaleDateString();
    const fullName = `${firstName} ${lastName}`.trim();

    // Prepare replacements
    const replacements = {
      'Insert Date': dateStr,
      'Homeowner’s Full Name': fullName,
      'Property Address': propertyAddress,
      'Phone Number': phoneNumber,
      'Email Address': email,
      'Contract Date': dateStr
    };

    // 1) Fill placeholders
    let replacedText = fillContractPlaceholders(AOB_TEMPLATE, replacements);

    // 2) Convert to HTML
    let finalHtml = parseMarkdownToHtml(replacedText);

    // Add a style block to reduce paragraph spacing, etc.
    const styleBlock = `
      <style>
        p { margin: 0.3em 0; line-height: 1.3; }
        h2, h3, h4 { margin-top: 0.5em; margin-bottom: 0.3em; }
        ul { margin: 0.5em 1.5em; }
        hr { margin: 1em 0; }
      </style>
    `;
    finalHtml = styleBlock + finalHtml;

    // 3) Insert the signature image
    finalHtml = finalHtml.replace(
      '[SIGNATURE_IMAGE]',
      `<img src="${signatureData}" alt="Signature" style="width:200px;" />`
    );

    // 4) Generate PDF
    const pdfOptions = {
      fileName: `aob-${Date.now()}.pdf`,
      docTitle: 'Assignment of Benefits (AOB)',
      userName: fullName,
      signedAt: new Date()
    };
    const pdfPath = await generateHtmlPdf(finalHtml, pdfOptions);

    // 5) Store in session
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
    console.error('Error signing AOB (Puppeteer):', err);
    return res.status(500).json({ success: false, message: 'Server error signing AOB.' });
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

    // Check existing user
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
            phoneNumber: req.session.onboarding.docFields.phoneNumber,
            email: req.session.onboarding.docFields.email
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

    // Clear onboarding data
    delete req.session.onboarding;

    return res.json({ success: true, redirectUrl: '/portal' });
  } catch (err) {
    console.error('Error final signup:', err);
    return res.status(500).json({ success: false, message: 'Server error during final signup.' });
  }
});

module.exports = router;
