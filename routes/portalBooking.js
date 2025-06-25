// routes/portalBooking.js

const router  = require('express').Router();
const ctrl    = require('../controllers/bookingController');

// reuse same auth middleware as portal routes
const requireLogin = (req,res,next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};

router.get('/',            requireLogin, ctrl.renderSelfService);
router.get('/feed',        requireLogin, ctrl.feedAvailability);
router.post('/',           requireLogin, ctrl.createOrCancel);

module.exports = router;
