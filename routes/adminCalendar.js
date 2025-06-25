// routes/adminCalendar.js
const router      = require('express').Router();
const ctrl        = require('../controllers/calendarAdminController');


router.get('/',                 ctrl.renderPage);
router.get('/events',           ctrl.listEvents);
router.get('/availability',     ctrl.listAvailability);
router.post('/availability',    ctrl.createAvailability);
router.put('/availability/:id', ctrl.updateAvailability);
router.delete('/availability/:id', ctrl.deleteAvailability);
router.post('/test-collision',  ctrl.testCollision);
router.post('/booking/:id/cancel', ctrl.cancelBooking);


module.exports = router;
