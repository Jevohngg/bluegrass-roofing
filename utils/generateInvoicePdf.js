// utils/generateInvoicePdf.js
const { generateHtmlPdf } = require('./docGenerator');
const path = require('path');
const fs   = require('fs');

async function generateInvoicePdf(html, invoiceId){
  const fileName  = `invoice-${invoiceId}-${Date.now()}.pdf`;
  const outputDir = path.join(__dirname,'..','tmp-pdfs');
  fs.mkdirSync(outputDir,{ recursive:true });
  const filePath = await generateHtmlPdf(html, { fileName, outputDir });
  const buffer   = fs.readFileSync(filePath);
  return { buffer, fileName };
}

module.exports = { generateInvoicePdf };
