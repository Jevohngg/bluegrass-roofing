/****************************************
 * utils/docGenerator.js
 * Generates AOB PDFs using Puppeteer,
 * includes a repeating footer on each page
 * for a logo.
 ****************************************/
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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
 * (if you still need it in some other part of your code).
 * @param {string} text - The text with Markdown bold syntax
 * @returns {string} The text with ** removed (bold applied in PDF generation)
 */
function parseMarkdownForPdf(text) {
  // If you no longer need PDFKit, you can leave this or remove it.
  return text.replace(/\*\*(.*?)\*\*/g, '$1');
}

/**
 * Generates a PDF by rendering full HTML with Puppeteer,
 * and adds a repeating footer logo on each page.
 * @param {string} html - The full HTML content (with placeholders replaced).
 * @param {Object} options - Additional options (fileName, outputDir, etc.).
 * @returns {Promise<string>} The absolute path of the saved PDF file.
 */
async function generateHtmlPdf(html, options = {}) {
  // 1) Determine file output path
  const fileName   = options.fileName   || `contract-${Date.now()}.pdf`;
  const outputDir  = options.outputDir  || path.join(__dirname, '..', 'public', 'uploads', 'docs');
  const outputPath = path.join(outputDir, fileName);

  // 2) Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // 3) Read and base64-encode your footer logo
  let base64Logo = '';
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'images', 'bg-logo.png');
    base64Logo = fs.readFileSync(logoPath).toString('base64');
  } catch (err) {
    console.warn('Could not load logo file:', err);
  }

  // 4) Launch Puppeteer with Heroku-friendly flags

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    // Prefer the buildpack’s CHROME_PATH, then fall back to Puppeteer’s
    executablePath: process.env.CHROME_PATH || puppeteer.executablePath()
  });
  

  const page = await browser.newPage();

  // 5) Render the HTML
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // 6) Build the footer template
  const footerTemplate = `
    <div style="width:100%; text-align:center; font-size:10px; padding:5px 0;">
      ${
        base64Logo
          ? `<img src="data:image/png;base64,${base64Logo}" style="width:80px;" />`
          : 'My Company Logo'
      }
    </div>
  `;

  // 7) Generate the PDF
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate,
    margin: {
      top:    '50px',
      right:  '50px',
      bottom: '80px',
      left:   '50px'
    }
  });

  // 8) Cleanup
  await browser.close();

  return outputPath;
}


module.exports = {
  fillContractPlaceholders,
  parseMarkdownToHtml,
  parseMarkdownForPdf,
  generateHtmlPdf // Puppeteer-based HTML to PDF with repeated footer
};
