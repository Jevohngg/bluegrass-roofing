/****************************************
 * routes/contact.js
 ****************************************/

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');

router.get('/', (req, res) => {
  // Pass the current page name for the nav
  res.render('contact', { currentPage: 'contact', pageTitle: 'Contact | BlueGrass Roofing' });
});

// POST endpoint to handle form submissions from any form posting to /contact
router.post('/', leadController.createLead);

module.exports = router;



