/****************************************
 * routes/services.js
 ****************************************/
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Pass the current page name for the nav
  res.render('services', { currentPage: 'services' });
});

module.exports = router;
