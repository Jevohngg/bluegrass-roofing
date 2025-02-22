/****************************************
 * routes/guarantee.js
 ****************************************/
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Pass the current page name for the nav
  res.render('guarantee', { currentPage: 'guarantee', pageTitle: 'Guarantee | BlueGrass Roofing' });
});

module.exports = router;
