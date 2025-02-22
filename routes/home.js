/****************************************
 * routes/home.js
 ****************************************/
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Notice we pass { currentPage: 'home' }
  res.render('home/index', { currentPage: 'home', pageTitle: 'Home | BlueGrass Roofing' });

});

module.exports = router;
