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
 * Converts Markdown bold syntax (**text**) to HTML (<strong>text</strong>).
 * @param {string} text - The text with Markdown bold syntax
 * @returns {string} The text with HTML bold tags
 */
function parseMarkdownToHtml(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Converts Markdown bold syntax (**text**) to plain text for PDF (removing ** and applying bold in PDF).
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
        .fontSize(16) // Slightly larger title for better visibility
        .text(docTitle, { align: 'center' })
        .moveDown(1.5); // Increased spacing after title for clarity

      // Remove unnecessary signature line from PDF
      let cleanText = contractText.replace(/\*\(All signatures will be captured through the DocSign interface.\)\*/, '');

      // Parse Markdown for PDF (remove **, handle bold in PDF)
      cleanText = parseMarkdownForPdf(cleanText);

      // Process the text for exact formatting, matching your example
      const lines = cleanText.split('\n').filter(line => line.trim()); // Remove empty lines
      doc.fontSize(12).font('Helvetica'); // Standard font size for readability

      lines.forEach((line, index) => {
        if (line.trim().startsWith('•')) {
          // Handle bullet points with precise indentation and bolding, matching your example
          const bulletMatch = line.match(/• (.*)/);
          if (bulletMatch) {
            const content = bulletMatch[1];
            const boldParts = content.split(/(\*\*.*?\*\*)/);
            doc.text('  • ', { continued: true }); // Two spaces for exact indentation
            boldParts.forEach(part => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldText = part.slice(2, -2);
                doc.font('Helvetica-Bold').text(boldText, { continued: true, lineBreak: true });
              } else {
                doc.font('Helvetica').text(part, { continued: true, lineBreak: true });
              }
            });
            doc.text(''); // New line after bullet
          }
        } else if (line.trim()) { // Handle regular text, including sections and numbered lists
          // Check for numbered lists or sections and handle bolding
          const boldParts = line.split(/(\*\*.*?\*\*)/);
          boldParts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              doc.font('Helvetica-Bold').text(boldText, { continued: true, lineBreak: true });
            } else {
              doc.font('Helvetica').text(part, { continued: true, lineBreak: true });
            }
          });
          doc.text(''); // New line
        }
        if (index < lines.length - 1) {
          doc.moveDown(2); // Increased to double spacing for better readability (instead of 0.4)
        }
      });

      doc.moveDown(4); // Increased space before signature section for clarity

      // Enhanced signature section, matching your example layout exactly
      if (signatureBase64) {
        try {
          const signatureData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
          const signatureBuffer = Buffer.from(signatureData, 'base64');
          doc
            .font('Helvetica')
            .fontSize(12)
            .text('Claim Holder:', { align: 'left' })
            .text(userName, { align: 'left', bold: true })
            .moveDown(4) // Adjusted spacing for better layout
            .text('Signature:', { align: 'left' })
            .image(signatureBuffer, {
              fit: [150, 50], // Size matches your example
              align: 'left'
            })
            .moveDown(4) // Adjusted spacing for better layout
            .text(`Date: ${signedAt}`, { align: 'left' });
        } catch (sigErr) {
          console.error('Error embedding signature:', sigErr);
        }
      }

      // Finalize PDF
      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });

      writeStream.on('error', (err) => {
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