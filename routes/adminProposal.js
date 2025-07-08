// routes/adminProposal.js
const express   = require('express');
const router    = express.Router();
const Proposal  = require('../models/Proposal');
const Estimate  = require('../models/Estimate');
const User      = require('../models/User');
const checkAuth = require('../middleware/checkAuth');

/* ───────── List ───────── */
router.get('/proposals', checkAuth, async (req,res)=>{
  const proposals = await Proposal.find()
    .populate('userId','firstName lastName email')
    .sort({ updatedAt:-1 }).lean();

  const grouped = {};
  proposals.forEach(p=>{
    const uid = p.userId?._id?.toString() || 'unknown';
    (grouped[uid] ||= { user:p.userId, list:[] }).list.push(p);
  });

  const users = await User.find({ status:{ $ne:'archived' } })
    .select('firstName lastName').sort({ firstName:1,lastName:1 }).lean();

  res.render('admin/proposalsList',{
    pageTitle:'Proposals • Admin',
    activeTab:'proposals',
    grouped,
    users
  });
});


  

/* ───────── Create blank ───────── */
router.post('/proposals', checkAuth, async (req,res)=>{
  const { userId } = req.body;
  if (!userId) return res.status(400).send('Missing user');
  const prop = await Proposal.create({ userId });
  res.redirect(`/admin/proposal/${prop._id}`);
});

/* ───────── Builder ───────── */
router.get('/proposal/:id', checkAuth, async (req,res)=>{
  const prop = await Proposal.findById(req.params.id)
  .populate('userId','firstName lastName email').lean();
  if (!prop) return res.status(404).render('admin/notFound');

  // preload client estimates for dropdown
  const estimates = await Estimate.find({ userId: prop.userId._id })
    .select('title totals.subtotal updatedAt').lean();

  res.render('admin/proposalBuilder',{
    pageTitle:`Proposal • ${prop.userId.firstName} ${prop.userId.lastName}`,
    activeTab:'proposals',
    prop: JSON.stringify(prop),
    estimates: JSON.stringify(estimates),
    clientName: `${prop.userId.firstName} ${prop.userId.lastName}`
  });
});

/* ───────── Preview ───────── */
router.get('/proposal/:id/preview', checkAuth, async (req,res)=>{
  const propDoc = await Proposal.findById(req.params.id)
    .populate('estimateId')                   // keep as full doc
    .populate('userId','firstName lastName'); // also full doc

  if (!propDoc) return res.status(404).send('Not found');

  // convert to plain object *with* all virtuals, including sub‑docs
  const prop = propDoc.toObject({ virtuals: true });

  const renderData = { prop, showEstimate: !!prop.includeEstimate };
  if (req.query.raw) return res.render('admin/proposalPreview', { ...renderData, layout:false });
  res.render('admin/proposalPreview', renderData);
});



module.exports = router;
