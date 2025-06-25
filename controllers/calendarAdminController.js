// controllers/calendarAdminController.js
// ------------------------------------------------------------
//  BlueGrass Roofing  •  Admin Calendar (FullCalendar feeds)
//  All times are stored UTC in MongoDB and displayed as
//  Eastern Time (America/New_York) inside the admin dashboard.
// ------------------------------------------------------------
const dayjs        = require('dayjs');
const utc          = require('dayjs/plugin/utc');
const tz           = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);

const Availability = require('../models/AvailabilitySlot');
const Booking      = require('../models/Booking');
const User         = require('../models/User');

const {
  sendClientBookingCancel,
  sendAdminBookingCancel
} = require('../utils/sendEmail');

async function safeSend(p) {
  try { return await p; } catch (e) {
    console.error('[SendGrid]', e?.response?.body || e);
  }
}

// —— Time‑zone constant ———————————————————————————
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';

// —— Booking type → label ——————————————————————————
const TYPE_LABEL = {
  inspection  : 'Roof Inspection',
  sample      : 'Shingle Selection',
  repair      : 'Repair',
  installation: 'Installation'
};

/* ---------- helpers ---------- */

// Convert FullCalendar GET params (start/end ISO) → native Dates
function utcRange(req) {
  return {
    start: dayjs(req.query.start).toDate(),
    end  : dayjs(req.query.end).toDate()
  };
}

// Map a Booking doc → FullCalendar event object
function toFcEvent(b) {
  return {
    id   : b._id,
    start: b.startAt,
    end  : b.endAt,
    allDay: b.type === 'roofRepair',

    title: TYPE_LABEL[b.type] ||
           (b.type[0].toUpperCase() + b.type.slice(1)),

    className: `fc-${b.type}`,
    extendedProps: {
      status : b.status,
      tz     : LOCAL_TZ,
      userId : b.userId?._id || b.userId,
      fullName: b.userId
                  ? [b.userId.firstName, b.userId.lastName]
                      .filter(Boolean).join(' ')
                  : undefined,
      email : b.userId?.email,
      note  : b.purpose || ''
    }
  };
}

/* ---------- ROUTE HANDLERS ---------- */

// 1 ) Render admin calendar page
exports.renderPage = (req, res) =>
  res.render('admin/calendar', {
    pageTitle: 'BlueGrass Roofing | Calendar',
    adminTz  : LOCAL_TZ,            // Pug injects into window.COMPANY_TZ
    activeTab: 'calendar'
  });

// 2 ) Bookings feed (events)
exports.listEvents = async (req, res) => {
  const { start, end } = utcRange(req);

  const bookings = await Booking.find({
    startAt: { $lt: end  },
    endAt  : { $gt: start },
    status : { $ne: 'canceled' }
  })
    .populate('userId', 'firstName lastName email')
    .lean();

  res.json(bookings.map(toFcEvent));
};

// 3 ) Availability feed (background events)
exports.listAvailability = async (req, res) => {
  const { start, end } = utcRange(req);

  // Weekly anchor for recurring templates
  const weekStart = dayjs.tz(start, LOCAL_TZ)
                         .startOf('week')
                         .toDate();

  // Fetch weekly templates + one‑off overrides in current view
  const templates = await Availability.find({
    $or: [
      { repeatWeekly: true },
      { repeatWeekly: false, dateOverride: { $gte: start, $lt: end } }
    ]
  }).lean();

  // Collect override calendar dates (YYYY‑MM‑DD) so they can
  // suppress weekly templates that fall on the same day.
  const overrideDates = new Set(
    templates
      .filter(t => !t.repeatWeekly)
      .map(t => dayjs.tz(t.dateOverride, LOCAL_TZ).format('YYYY-MM-DD'))
  );

  const events = [];
  templates.forEach(raw => {
    const slot = new Availability(raw);
    const ev   = slot.toBackgroundEvent(weekStart);
    const iso  = dayjs.tz(ev.start, LOCAL_TZ).format('YYYY-MM-DD');

    // Rule: any override on that calendar date hides *all*
    // weekly templates for the same date.
    if (raw.repeatWeekly && overrideDates.has(iso)) return;

    events.push(ev);
  });

  res.json(events);
};

// 4 ) Create availability slot
exports.createAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime, repeatWeekly, dateOverride } = req.body;

    const [sh, sm]   = startTime.split(':').map(Number);
    const [eh, em]   = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes   = eh * 60 + em;

    if (endMinutes <= startMinutes)
      return res.status(400).json({ msg: 'End > start' });
    if (endMinutes - startMinutes < 15)
      return res.status(400).json({ msg: 'Too short' });
    if (endMinutes - startMinutes > 720)
      return res.status(400).json({ msg: 'Too long' });

    if (!repeatWeekly && !dateOverride)
      return res.status(400).json({ msg: 'Specific date is required for one‑off slots.' });

    const dow = repeatWeekly
      ? dayOfWeek
      : dayjs.tz(dateOverride, LOCAL_TZ).day();

    const slot = await Availability.create({
      dayOfWeek   : dow,
      startMinutes,
      endMinutes,
      repeatWeekly,
      // NEW – lock the override to midnight in the company timezone
dateOverride: repeatWeekly
? null
: dayjs.tz(dateOverride, LOCAL_TZ).startOf('day').toDate()

    });

    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    return res.status(201).json(slot);

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        msg: 'That availability slot already exists for this day and time.'
      });
    }
    return next(err);
  }
};

// 5 ) Update availability slot
exports.updateAvailability = async (req, res, next) => {
  try {
    const { dayOfWeek, startTime, endTime, repeatWeekly, dateOverride } = req.body;

    const [sh, sm]   = startTime.split(':').map(Number);
    const [eh, em]   = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes   = eh * 60 + em;

    if (endMinutes <= startMinutes)
      return res.status(400).json({ msg: 'End time must be after start time' });
    if (endMinutes - startMinutes < 15)
      return res.status(400).json({ msg: 'Slot must be ≥15 minutes' });
    if (endMinutes - startMinutes > 720)
      return res.status(400).json({ msg: 'Slot cannot exceed 12 hours' });

    if (!repeatWeekly && !dateOverride)
      return res.status(400).json({ msg: 'Specific date is required for one‑off slots.' });

    const dow = repeatWeekly
      ? dayOfWeek
      : dayjs.tz(dateOverride, LOCAL_TZ).day();

    const update = {
      dayOfWeek   : dow,
      startMinutes,
      endMinutes,
      repeatWeekly,
      dateOverride: repeatWeekly ? null : new Date(dateOverride)
    };

    const slot = await Availability.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!slot) return res.status(404).end();

    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    res.json(slot);
  } catch (err) { next(err); }
};

// 6 ) Delete availability slot
exports.deleteAvailability = async (req, res, next) => {
  try {
    const [templateId] = req.params.id.split('-');
    const slot = await Availability.findById(templateId);
    if (!slot) return res.status(404).end();

    // Check for booking conflict this week
    const weekStart = dayjs().tz(LOCAL_TZ).startOf('week').toDate();
    const { start, end } = slot.toBackgroundEvent(weekStart);
    const clash = await Booking.findOne({
      startAt: { $lt: end },
      endAt  : { $gt: start }
    }).lean();
    if (clash) return res.status(409).json({ msg: 'Slot has bookings' });

    await slot.deleteOne();
    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// 8 ) Cancel a booking (admin)
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking)
      return res.status(404).json({ ok: false, msg: 'Not found' });
    if (booking.status === 'canceled')
      return res.status(409).json({ ok: false, msg: 'Already canceled' });

    const snap = booking.toObject();
    await booking.deleteOne();

    // live refresh
    req.app.get('io').to('calendarRoom').emit('calendarUpdated');

    // e‑mail both sides
    const user = await User.findById(snap.userId).lean();
    await Promise.all([
      safeSend(sendClientBookingCancel(user, snap)),
      safeSend(sendAdminBookingCancel(user, snap))
    ]);

    res.json({ ok: true });
  } catch (err) { next(err); }
};

// 7 ) Optional overlap tester
exports.testCollision = async (req, res) => {
  const { startAt, endAt } = req.body;
  const conflict = await Booking.findOne({
    startAt: { $lt: endAt },
    endAt  : { $gt: startAt }
  }).lean();
  res.json({ ok: !conflict, conflict });
};
