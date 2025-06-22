// controllers/calendarAdminController.js
const dayjs          = require('dayjs');
const Availability   = require('../models/AvailabilitySlot');
const Booking        = require('../models/Booking');

/* –––– Helpers –––– */
function utcRange(req) {
  return {
    start: dayjs(req.query.start).toDate(),
    end:   dayjs(req.query.end).toDate()
  };
}

/* –––– ROUTE HANDLERS –––– */

// 1) Page render
exports.renderPage = (req, res) =>
  res.render('admin/calendar', {
    pageTitle: 'BlueGrass Roofing | Calendar',
    adminTz:   Intl.DateTimeFormat().resolvedOptions().timeZone,
    activeTab: 'calendar'
  });

// 2) Return all bookings for FullCalendar “event source”
exports.listEvents = async (req, res) => {
  const { start, end } = utcRange(req);
  const bookings = await Booking.find({
    startAt: { $lt: end  },
    endAt:   { $gt: start }
  }).lean();

  /* Map → FC event */
  res.json(bookings.map(b => ({
    id:     b._id,
    start:  b.startAt,
    end:    b.endAt,
    title:  b.type[0].toUpperCase() + b.type.slice(1),
    className: `fc-${b.type}`,
    extendedProps: { status: b.status }
  })));
};

// 3) Weekly availability background events
exports.listAvailability = async (req, res) => {
  const { start, end } = utcRange(req);
  const weekStart = dayjs(start).startOf('week').toDate();   // Sunday
  const slots     = await Availability.find().lean();

  /* Convert templates to concrete dates inside the requested range */
  const events = [];
  slots.forEach(raw => {
    const s = new Availability(raw);
    events.push(s.toBackgroundEvent(weekStart));
  });
  res.json(events);
};

// 4) Create slot
exports.createAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime, repeatWeekly, dateOverride } = req.body;

    // Validation R‑1 / R‑2
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes   = eh * 60 + em;
    if (endMinutes <= startMinutes) return res.status(400).json({ msg:'End > start' });
    if (endMinutes - startMinutes < 15) return res.status(400).json({ msg:'Too short' });
    if (endMinutes - startMinutes > 720) return res.status(400).json({ msg:'Too long' });

    const slot = await Availability.create({
      dayOfWeek,
      startMinutes,
      endMinutes,
      repeatWeekly,
      dateOverride: repeatWeekly ? null : dateOverride
    });

    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    res.status(201).json(slot);
  } catch (err) { next(err); }
};

// 5) Update slot
exports.updateAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime, repeatWeekly, dateOverride } = req.body;

    // Convert times (HH:MM) → minutes since midnight
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes   = eh * 60 + em;

    // Validate R-1,R-2: length & ordering
    if (endMinutes <= startMinutes) {
      return res.status(400).json({ msg: 'End time must be after start time' });
    }
    if (endMinutes - startMinutes < 15) {
      return res.status(400).json({ msg: 'Slot must be at least 15 minutes' });
    }
    if (endMinutes - startMinutes > 720) {
      return res.status(400).json({ msg: 'Slot cannot exceed 12 hours' });
    }

    // Build the actual update object
    const update = {
      dayOfWeek,
      startMinutes,
      endMinutes,
      repeatWeekly,
      dateOverride: repeatWeekly ? null : dateOverride
    };

    const slot = await Availability.findByIdAndUpdate(
      req.params.id, update, { new: true }
    );
    if (!slot) return res.status(404).end();

    // Notify live clients
    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    res.json(slot);
  } catch (err) {
    next(err);
  }
};

// 6) Delete slot – R‑4
exports.deleteAvailability = async (req, res, next) => {
  try {
    const slot = await Availability.findById(req.params.id);
    if (!slot) return res.status(404).end();

    // Conflict – any booking overlapping?
    const weekStart = dayjs().startOf('week').toDate();
    const { start, end } = slot.toBackgroundEvent(weekStart);
    const clash = await Booking.findOne({
      startAt: { $lt: end },
      endAt:   { $gt: start }
    }).lean();
    if (clash) return res.status(409).json({ msg:'Slot has bookings' });

    await slot.deleteOne();
    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    res.json({ ok:true });
  } catch (err) { next(err); }
};

/* (Optional) collision test */
exports.testCollision = async (req, res) => {
  const { startAt, endAt } = req.body;
  const conflict = await Booking.findOne({
    startAt: { $lt: endAt },
    endAt:   { $gt: startAt }
  }).lean();
  res.json({ ok: !conflict, conflict });
};
