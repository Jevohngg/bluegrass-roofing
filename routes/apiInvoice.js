// routes/apiInvoice.js
const express = require('express');
const router  = express.Router();
const Invoice = require('../models/Invoice');
const checkAuth = require('../middleware/checkAuth');
const { generateInvoicePdf } = require('../utils/generateInvoicePdf');
const { sendClientInvoiceEmail } = require('../utils/sendEmail');

/* ───── Autosave ───── */
router.put('/:id', checkAuth, async (req,res)=>{
try {
  const allowed = (({
    businessName,businessAddr,businessPhone,
    invoiceNumber,issuedDate,dueDate,builderNotes,
    lineItems,status
  })=>({
    businessName,businessAddr,businessPhone,
    invoiceNumber,issuedDate,dueDate,builderNotes,
    lineItems,status
  }))(req.body);

    /* strip empty strings/null so we don’t wipe good data */
    Object.keys(allowed).forEach(k => {
      if (allowed[k] === '' || allowed[k] === null) delete allowed[k];
    });

    await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },            // PATCH semantics
      { runValidators: true }
    );
    res.json({ ok: true });
  
  } catch (err) {
    console.error('[Invoice PUT]', err);
    res.status(400).json({ ok: false, msg: err.message });
  }
});

/* ───── Send (PDF + Email) ───── */
router.post('/:id/send', checkAuth, async (req,res)=>{
  try{
    const onlyPdf   = !!req.body?.onlyPdf;
    const customMsg = req.body?.customMsg || '';

    const invDoc = await Invoice.findById(req.params.id).populate('userId');
    if (!invDoc) return res.sendStatus(404);

    /* get HTML ------------------------------------------------ */
    const origin = `${req.protocol}://${req.get('host')}`;
    const html   = await (await fetch(
      `${origin}/admin/invoice/${invDoc._id}/preview?raw=1`,
      { headers:{ Cookie:req.headers.cookie }}
    )).text();

    /* PDF ----------------------------------------------------- */
    const { buffer, fileName } = await generateInvoicePdf(html, invDoc._id);

    /* store --------------------------------------------------- */
    const fs   = require('fs');
    const path = require('path');
    const outDir = path.join(__dirname,'..','public','uploads','invoices');
    fs.mkdirSync(outDir,{ recursive:true });
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, buffer);
    invDoc.pdfUrl = `/uploads/invoices/${fileName}`;
    if (!onlyPdf) invDoc.status = 'sent';
    await invDoc.save();

    /* email --------------------------------------------------- */
    if (!onlyPdf){
      await sendClientInvoiceEmail(
        invDoc.userId,
        invDoc,
        buffer,
        `${origin}/portal/invoice/${invDoc._id}`,
        customMsg
      );
    }

    res.json({ ok:true, url: invDoc.pdfUrl });
  }catch(err){
    console.error('[invoice send]',err);
    res.status(500).json({ ok:false, msg:'Failed to send invoice.' });
  }
});

/* ───── Delete ───── */
router.delete('/:id', checkAuth, async (req,res)=>{
  await Invoice.findByIdAndDelete(req.params.id);
  const wantsHtml = req.headers.accept?.includes('text/html');
  if (wantsHtml) return res.redirect(303,'/admin/invoices');
  res.json({ success:true });
});

module.exports = router;
