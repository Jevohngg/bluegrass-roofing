/****************************************
 * routes/contact.js
 ****************************************/
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Pass the current page name for the nav
  res.render('contact', { currentPage: 'contact' });
});

module.exports = router;
