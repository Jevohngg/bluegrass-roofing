// routes/adminEstimates.js
const express  = require('express');
const router   = express.Router();
const Estimate = require('../models/Estimate');
const Proposal = require('../models/Proposal');
const User     = require('../models/User');
const checkAuth= require('../middleware/checkAuth');

/* ───────── List ───────── */
router.get('/estimates', checkAuth, async (req,res)=>{
  const estimates = await Estimate.find()
    .populate('userId','firstName lastName email')
    .sort({ updatedAt:-1 })
    .lean();

    /* 1) Find which estimates are referenced by a proposal */
  const usedIds = new Set(
    (await Proposal.find({ estimateId:{ $in: estimates.map(e=>e._id) } })
                   .select('estimateId')
                   .lean())
      .map(p => p.estimateId.toString())
  );

  /* 2) Flag each estimate */
  estimates.forEach(e => {
    e.used = usedIds.has(e._id.toString());
  });

  /* group by userId for table sections */
  const grouped = {};
  estimates.forEach(e=>{
    const uid = e.userId?._id?.toString() || 'unknown';
    (grouped[uid] ||= { user:e.userId, list:[] }).list.push(e);
  });

  /* 3️⃣ NEW — fetch all active clients for the dropdown */
  const users = await User.find({ status: { $ne: 'archived' } })
    .select('firstName lastName')          // minimal fields
    .sort({ firstName: 1, lastName: 1 })   // nice alpha sort
    .lean();

  res.render('admin/estimatesList',{
    pageTitle:'Estimates • Admin',
    activeTab:'estimates',
    grouped,
    users
  });
});

/* ───────── Create blank estimate ───────── */
router.post('/estimates', checkAuth, async (req,res)=>{
  const { userId } = req.body;
  if (!userId) return res.status(400).send('Missing user');
  const est = await Estimate.create({ userId, lineItems:[] });
  res.redirect(`/admin/estimate/${est._id}`);
});

/* ───────── Builder UI ───────── */
router.get('/estimate/:id', checkAuth, async (req,res)=>{
  const est = await Estimate.findById(req.params.id)
    .populate('userId','firstName lastName')
    .lean();
  if (!est) return res.status(404).render('admin/notFound');

  res.render('admin/estimateBuilder',{
    pageTitle:`Estimate • ${est.userId.firstName} ${est.userId.lastName}`,
    activeTab:'estimates',
    est: JSON.stringify(est),
    clientName: `${est.userId.firstName} ${est.userId.lastName}`
  });
});

module.exports = router;
