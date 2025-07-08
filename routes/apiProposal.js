// routes/apiProposal.js
const express   = require('express');
const router    = express.Router();
const Proposal  = require('../models/Proposal');
const Estimate  = require('../models/Estimate');
const checkAuth = require('../middleware/checkAuth');
const { generateProposalPdf } = require('../utils/generateProposalPdf');
const { sendClientProposalEmail } = require('../utils/sendEmail');

/* ───────── Create ───────── */
router.post('/', checkAuth, async (req,res)=>{
  const { userId } = req.body;
  if (!userId) return res.status(400).send('Missing user');
  const prop = await Proposal.create({ userId });
  res.json({ id: prop._id });
});

// add **before** the existing POST/PUT/DELETE handlers
router.get('/', checkAuth, async (req, res) => {
    const { userId } = req.query;
    if (!userId)  return res.status(400).json({ ok: false, msg: 'Missing userId' });
    const props = await Proposal.find({ userId })
      .select('title estimateId')
      .populate({ path: 'estimateId', select: 'totals.subtotal' })
      .lean();
    res.json(props);
  });


/* ───────── Autosave ───────── */
router.put('/:id', checkAuth, async (req,res)=>{
  const allowed = (({
    title, intro, includeIntro,
    includeEstimate, estimateId,
    includeOutro, outro
  })=>({
    title, intro, includeIntro,
    includeEstimate, estimateId,
    includeOutro, outro
  }))(req.body);

  if (allowed.estimateId === '') allowed.estimateId = null;

  await Proposal.findByIdAndUpdate(req.params.id, allowed, { runValidators:true });
  res.json({ ok:true });
});

/* ───────── Send (PDF + E‑mail) ───────── */
router.post('/:id/send', checkAuth, async (req, res) => {
    try {
      /* flags & custom message ------------------------------------------- */
      const onlyPdf   = !!(req.body && req.body.onlyPdf);
      const customMsg = (req.body && req.body.customMsg) || '';
  
      /* 0) fetch proposal & relations ------------------------------------ */
      const prop = await Proposal.findById(req.params.id)
        .populate('userId')
        .populate({
          path: 'estimateId',
          populate: { path: 'lineItems.catalogItemId' }
        });
      if (!prop) return res.sendStatus(404);
  
      /* 1) get exact HTML via preview route ------------------------------ */
      const origin  = `${req.protocol}://${req.get('host')}`;
      const htmlRes = await fetch(
        `${origin}/admin/proposal/${prop._id}/preview?raw=1`,
        { headers: { Cookie: req.headers.cookie } }          // re‑use admin session
      );
      const html = await htmlRes.text();
  
      /* 2) generate PDF --------------------------------------------------- */
      const { buffer, fileName } = await generateProposalPdf(html, prop._id);
  
      /* 3) store PDF under /public/uploads/proposals ---------------------- */
      const fs   = require('fs');
      const path = require('path');
      const outDir = path.join(__dirname, '..', 'public', 'uploads', 'proposals');
      fs.mkdirSync(outDir, { recursive: true });
      const filePath = path.join(outDir, fileName);
      fs.writeFileSync(filePath, buffer);
      prop.pdfUrl = `/uploads/proposals/${fileName}`;
  
      if (!onlyPdf) {
        prop.status = 'sent';                         // mark “sent” only for e‑mail
      }
      await prop.save();
  
      /* 4) e‑mail client (skipped for download‑only) ---------------------- */
      if (!onlyPdf) {
        await sendClientProposalEmail(
          prop.userId,
          prop,
          buffer,
          `${origin}/portal/proposal/${prop._id}`,
          customMsg                                   // ← personal note from modal
        );
      }
  
      /* 5) response ------------------------------------------------------- */
      if (onlyPdf) {
        return res.json({ ok: true, url: prop.pdfUrl });   // browser will download
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[proposal send]', err);
      res.status(500).json({ ok: false, msg: 'Failed to send proposal.' });
    }
  });


  /* ───────────── Delete proposal permanently ───────────── */
router.delete('/:id', checkAuth, async (req, res) => {
    await Proposal.findByIdAndDelete(req.params.id);
  
    // If the request came from an HTML form, redirect back to the list;
    // otherwise return JSON for fetch/XHR calls.
    const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (wantsHtml) {
      return res.redirect(303, '/admin/proposals');   // 303 = “See Other”
    }
    res.json({ success: true });
  });
  
  

module.exports = router;
