// routes/portalInvoice.js
const express = require('express');
const router  = express.Router();
const Invoice = require('../models/Invoice');

/* ───────── Public View ───────── */
router.get('/invoice/:id', async (req, res) => {
    const inv = await Invoice.findById(req.params.id).lean();
    if (!inv) return res.status(404).render('portal/notFound');
    res.render('portal/invoiceStandalone', {
      pageTitle: 'Invoice',
      layout: 'portalLayout',
      inv
    });
  });

module.exports = router;
