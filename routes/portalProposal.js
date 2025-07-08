// routes/portalProposal.js

const express  = require('express');
const router   = express.Router();
const Proposal = require('../models/Proposal');
const User     = require('../models/User');
const { notifyAdminProposalAccepted } = require('../utils/sendEmail');

/* ───────── View (public) ───────── */
router.get('/proposal/:id', async (req, res) => {
  const prop = await Proposal.findById(req.params.id)
    .populate('estimateId')
    .lean();

  if (!prop) return res.status(404).render('portal/notFound');

  // ✅ NO login required — anyone with the link can view
  res.render('portal/proposalView', {
    pageTitle: 'Proposal',
    layout: 'portalLayout',
    prop
  });
});

/* ───────── Accept (public, idempotent) ───────── */
router.post('/proposal/:id/accept', async (req, res) => {
  const prop = await Proposal.findById(req.params.id);

  // must exist and still be pending
  if (!prop || prop.status !== 'sent') return res.sendStatus(400);

  prop.status = 'approved';
  await prop.save();

  /* notify admin — Socket.IO + e‑mail */
  const io = req.app.get('io');
  io.to('admin-room').emit('proposalApproved', { id: prop._id });

  const user = await User.findById(prop.userId);
  notifyAdminProposalAccepted(user, prop).catch(console.error);

  // simple thank‑you page; you could redirect elsewhere
  res.send('<h2 style="font-family:Arial,sans-serif;text-align:center;padding:3rem;">Thank you! Your proposal has been accepted.</h2>');
});

module.exports = router;
