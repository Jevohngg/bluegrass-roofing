// routes/apiEstimate.js
const express  = require('express');
const router   = express.Router();
const Estimate = require('../models/Estimate');
const checkAuth= require('../middleware/checkAuth');  // extra defence

/* Autosave: partial PATCH */
router.patch('/:id', checkAuth, async (req,res)=>{
    try {
        const payload = req.body;
        const est = await Estimate.findById(req.params.id);
        if (!est) return res.sendStatus(404);

        /* merge allowed fields only */
        if (payload.title)  est.title  = payload.title;
        if (Array.isArray(payload.lineItems)) est.lineItems = payload.lineItems;
        if (payload.status) est.status = payload.status;

        await est.save();                // ← may throw ValidationError
        res.json({ ok: true });
        } catch (err) {
        console.error('[Estimate PATCH]', err);
        res.status(400).json({ ok: false, msg: err.message });
        }
});

// add **before** the existing PATCH/DELETE handlers
router.get('/', checkAuth, async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, msg: 'Missing userId' });
    const ests = await Estimate.find({ userId })
      .select('title totals.subtotal')
      .lean();
    res.json(ests);
  });
  

// ───────────── Delete estimate permanently ─────────────
router.delete('/:id', checkAuth, async (req, res) => {
    await Estimate.findByIdAndDelete(req.params.id);
    // If the client expects an HTML response (a form submit),
    // redirect back to the estimates list. Otherwise keep JSON for XHR/fetch.
    const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (wantsHtml) {
        return res.redirect(303, '/admin/estimates');  // 303 = “see other” (safe for POST/DELETE forms)
    }
    res.json({ success: true });   
  });
  

module.exports = router;
