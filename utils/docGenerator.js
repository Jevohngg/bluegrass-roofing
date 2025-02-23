// utils/docGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Replaces placeholders in the contract text with actual user data.
 * @param {string} template - The raw contract text with placeholders
 * @param {Object} data - The data object containing the values to replace
 * @returns {string} The contract text with placeholders replaced
 */
function fillContractPlaceholders(template, data) {
  let filled = template;
  
  Object.entries(data).forEach(([placeholder, value]) => {
    const regex = new RegExp(`\\[${placeholder}\\]`, 'g'); 
    filled = filled.replace(regex, value);
  });

  return filled;
}

/**
 * Converts Markdown bold syntax (**text**) to HTML, 
 * and also converts blank lines/newlines into <p> and <br> 
 * so the text is spaced out properly in the front-end.
 * 
 * - Double newlines => new paragraph <p>
 * - Single newline => <br>
 * - **bold** => <strong>bold</strong>
 */
function parseMarkdownToHtml(text) {
  // 1) Replace **bold** segments with <strong>
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2) Normalize line endings (just in case of Windows \r\n)
  text = text.replace(/\r\n/g, '\n');

  // 3) Split on double newlines => separate paragraphs
  const paragraphs = text.split(/\n\s*\n/);

  // 4) Convert each paragraph's single newlines to <br>
  const htmlParagraphs = paragraphs.map(par => par.replace(/\n/g, '<br>'));

  // 5) Wrap each paragraph in <p> ... </p>
  const finalHtml = htmlParagraphs.map(par => `<p>${par.trim()}</p>`).join('\n');

  return finalHtml;
}

/**
 * Converts Markdown bold syntax (**text**) to plain text for PDF 
 * (removing ** and applying bold in PDF).
 * @param {string} text - The text with Markdown bold syntax
 * @returns {string} The text with ** removed (bold applied in PDF generation)
 */
function parseMarkdownForPdf(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove ** for PDF, handle bold later
}

/**
 * Generates a PDF file from the given contract text and signature data.
 * @param {string} contractText - The fully replaced text
 * @param {string} signatureBase64 - Base64 data for the user's signature image
 * @param {Object} options - Additional options like output path, title, userName, signedAt
 * @returns {Promise<string>} - Resolves to the absolute path of the saved PDF
 */
function generateContractPDF(contractText, signatureBase64, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' }); // Use letter-sized paper for standard contracts
      const fileName = options.fileName || `contract-${Date.now()}.pdf`;
      const outputDir = options.outputDir || path.join(__dirname, '..', 'public', 'uploads', 'docs');
      const outputPath = path.join(outputDir, fileName);
      const docTitle = options.docTitle || 'Contract'; // Dynamic title from options
      const userName = options.userName || 'Claim Holder'; // Full name for signature
      const signedAt = options.signedAt ? new Date(options.signedAt).toLocaleDateString() : ''; // Signing date

      // Ensure output directory exists
      fs.mkdirSync(outputDir, { recursive: true });

      // Pipe PDFKit output to file
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      // Add dynamic contract title (centered, bold, matching your example)
      doc
        .font('Helvetica-Bold')
        .fontSize(16) 
        .text(docTitle, { align: 'center' })
        .moveDown(1.5);

      // Remove unnecessary signature line from PDF
      let cleanText = contractText.replace(/\*\(All signatures will be captured through the DocSign interface.\)\*/, '');

      // Parse out markdown bold for PDF
      cleanText = parseMarkdownForPdf(cleanText);

      // Break text into lines
      const lines = cleanText.split('\n').filter(line => line.trim());
      doc.fontSize(12).font('Helvetica'); 

      lines.forEach((line, index) => {
        if (line.trim().startsWith('•')) {
          // Handle bullet points with indentation and bolding
          const bulletMatch = line.match(/• (.*)/);
          if (bulletMatch) {
            const content = bulletMatch[1];
            const boldParts = content.split(/(\*\*.*?\*\*)/);
            doc.text('  • ', { continued: true }); 
            boldParts.forEach(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                doc.font('Helvetica-Bold').text(boldText, { continued: true, lineBreak: true });
              } else {
                doc.font('Helvetica').text(part, { continued: true, lineBreak: true });
              }
            });
            doc.text(''); 
          }
        } else if (line.trim()) {
          // Handle normal lines, including sections & numbered lists
          const boldParts = line.split(/(\*\*.*?\*\*)/);
          boldParts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              doc.font('Helvetica-Bold').text(boldText, { continued: true, lineBreak: true });
            } else {
              doc.font('Helvetica').text(part, { continued: true, lineBreak: true });
            }
          });
          doc.text('');
        }
        if (index < lines.length - 1) {
          doc.moveDown(2); // Extra space between lines for readability
        }
      });

      doc.moveDown(4);

      // If there's a signature
      if (signatureBase64) {
        try {
          const signatureData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
          const signatureBuffer = Buffer.from(signatureData, 'base64');
          doc
            .font('Helvetica')
            .fontSize(12)
            .text('Claim Holder:', { align: 'left' })
            .text(userName, { align: 'left', bold: true })
            .moveDown(4)
            .text('Signature:', { align: 'left' })
            .image(signatureBuffer, {
              fit: [150, 50],
              align: 'left'
            })
            .moveDown(4)
            .text(`Date: ${signedAt}`, { align: 'left' });
        } catch (sigErr) {
          console.error('Error embedding signature:', sigErr);
        }
      }

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', err => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  fillContractPlaceholders,
  parseMarkdownToHtml,
  parseMarkdownForPdf,
  generateContractPDF
};
