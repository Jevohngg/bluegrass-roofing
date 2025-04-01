/****************************************
 * routes/quote.js
 ****************************************/
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Pass the current page name for the nav
  res.render('quote', { currentPage: 'quote', pageTitle: 'Free Quote | BlueGrass Roofing' });
});

module.exports = router;
