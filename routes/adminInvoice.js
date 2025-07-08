// routes/adminInvoice.js
const express  = require('express');
const router   = express.Router();
const Invoice  = require('../models/Invoice');
const Proposal = require('../models/Proposal');
const Estimate = require('../models/Estimate');
const User     = require('../models/User');
const checkAuth= require('../middleware/checkAuth');

/* ───────── List ───────── */
router.get('/invoices', checkAuth, async (req,res)=>{
  const invoices = await Invoice.find()
    .populate('userId','firstName lastName email')
    .sort({ updatedAt:-1 }).lean();

  const grouped = {};
  invoices.forEach(inv=>{
    const uid = inv.userId?._id?.toString() || 'unknown';
    (grouped[uid] ||= { user:inv.userId, list:[] }).list.push(inv);
  });

  const users = await User.find({ status:{ $ne:'archived' } })
    .select('firstName lastName').sort({ firstName:1,lastName:1 }).lean();

  res.render('admin/invoicesList',{
    pageTitle:'Invoices • Admin',
    activeTab:'invoices',
    grouped,
    users
  });
});

/* ───────── Create Wizard (simplified server side) ───────── */
router.post('/invoices', checkAuth, async (req,res)=>{
  const {
    sourceType,   // 'proposal' | 'estimate' | 'blank'
    sourceId,     // ObjectId or ''
    userId
  } = req.body;

  /* 1) generate next invoice number ------------------------ */
  const last = await Invoice.findOne().sort({ invoiceNumber:-1 }).lean();
  const nextNumber = last ? String(Number(last.invoiceNumber)+1).padStart(4,'0') : '0001';

  /* 2) base payload --------------------------------------- */
  const payload = {
    userId,
    businessName : 'BlueGrass Roofing',      // default; admin edits later
    businessAddr : '3217 Summit Square Place, Suite 100. Lexington, KY 40509',          // –
    businessPhone: '859-433-8120',
    invoiceNumber: nextNumber,
    dueDate      : new Date(Date.now()+14*864e5)   // +14 days
  };

  /* 3) pre‑fill from source ------------------------------- */
  if (sourceType === 'proposal' && sourceId){
    const prop = await Proposal.findById(sourceId).populate('estimateId');
    if (prop){
      payload.proposalId = prop._id;
      if (prop.estimateId){
        payload.estimateId = prop.estimateId._id;
        payload.lineItems  = prop.estimateId.lineItems.map(li=>({
          name:li.name, description:li.description, color:li.color,
          qty:li.qty, unit:li.unit, price:li.total || li.retailCost
        }));
      }
    }
  } else if (sourceType==='estimate' && sourceId){
    const est = await Estimate.findById(sourceId);
    if (est){
      payload.estimateId = est._id;
      payload.lineItems  = est.lineItems.map(li=>({
        name:li.name, description:li.description, color:li.color,
        qty:li.qty, unit:li.unit, price:li.total || li.retailCost
      }));
    }
  }

  const inv = await Invoice.create(payload);
  res.redirect(`/admin/invoice/${inv._id}`);
});

/* ───────── Builder ───────── */
router.get('/invoice/:id', checkAuth, async (req,res)=>{
  const inv = await Invoice.findById(req.params.id)
    .populate('userId','firstName lastName email')
    .lean();
  if (!inv) return res.status(404).render('admin/notFound');

  res.render('admin/invoiceBuilder',{
    pageTitle:`Invoice • ${inv.userId.firstName} ${inv.userId.lastName}`,
    activeTab:'invoices',
    inv: JSON.stringify(inv),
    clientName:`${inv.userId.firstName} ${inv.userId.lastName}`
  });
});

/* ───────── Preview ───────── */
router.get('/invoice/:id/preview', checkAuth, async (req,res)=>{
  const inv = await Invoice.findById(req.params.id).populate('userId').lean();
  if (!inv) return res.status(404).send('Not found');

  if (req.query.raw) return res.render('admin/invoicePreview', { inv, layout:false });
  res.render('admin/invoicePreview', { inv });
});

module.exports = router;
