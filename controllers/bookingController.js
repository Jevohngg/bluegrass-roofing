// controllers/bookingController.js
const dayjs = require('dayjs');
const utc   = require('dayjs/plugin/utc');
const tz    = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);

const Availability = require('../models/AvailabilitySlot');
const Booking      = require('../models/Booking');
const User         = require('../models/User');

const {
  sendClientBookingConfirm,
  sendAdminBookingConfirm,
  sendClientBookingCancel,
  sendClientBookingReschedule,
  sendAdminBookingReschedule,
  sendAdminBookingCancel
} = require('../utils/sendEmail');

/* ── constants ─────────────────────────────────────────── */
const ONE_HOUR     = 60;     // minutes
const SLOT_MINUTES = 60;     // slot length

/** Lexington KY → Eastern Time */
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';

/* Friendly labels (extend if you add more types) */
const TYPE_LABEL = {
  inspection  : 'Roof Inspection',
  sample      : 'Shingle Selection',
  repair      : 'Repair',
  installation: 'Installation'
};

/* Mail helper – never crash the route */
async function safeSend(promise) {
  try { return await promise; }
  catch (err) {
    console.error('[SendGrid] mail error:', err?.response?.body || err);
  }
}

/* ──────────────────────────────────────────────────────────
   buildOpenSlots(rangeStartUtc, rangeEndUtc)
────────────────────────────────────────────────────────── */
async function buildOpenSlots(rangeStartUtc, rangeEndUtc) {
  /* 1) Pull all templates once */
  const templates = await Availability.find().lean();

  /* 1-a) Separate non-recurring overrides → { 'YYYY-MM-DD': [template,…] } */
  const overridesByDay = {};
  templates.forEach(t => {
    if (!t.repeatWeekly && t.dateOverride) {
      const key = dayjs.tz(t.dateOverride, LOCAL_TZ).format('YYYY-MM-DD');
      (overridesByDay[key] = overridesByDay[key] || []).push(t);
    }
  });

  /* 1-b) Keep recurring weekly templates in their own list */
  const weekly = templates.filter(t => t.repeatWeekly);

  /* 2) Expand templates to concrete LOCAL-TZ slots within the range */
  const slots = [];
  for (
    let d = dayjs.tz(rangeStartUtc, LOCAL_TZ);
    d.isBefore(rangeEndUtc);
    d = d.add(1, 'day')
  ) {
    const key = d.format('YYYY-MM-DD');  // calendar date in EST
    const dow = d.day();                 // 0–6

    // Overrides win: if any override exists for this date, use those; otherwise use weekly templates
    const todaysTemplates = overridesByDay[key] || weekly.filter(t => t.dayOfWeek === dow);

    todaysTemplates.forEach(t => {
      for (
        let cur = t.startMinutes;
        cur + SLOT_MINUTES <= t.endMinutes;
        cur += SLOT_MINUTES
      ) {
        const localStart = d.startOf('day').add(cur, 'minute');  // LOCAL_TZ
        slots.push({
          start: localStart.toDate(),                            // correct UTC instant
          end:   localStart.add(SLOT_MINUTES, 'minute').toDate()
        });
      }
    });
  }

  /* 3) Fetch existing bookings into “taken” */
  const taken = await Booking.find(
    {
      startAt: { $lt: rangeEndUtc },
      endAt:   { $gt: rangeStartUtc },
      status:  { $ne: 'canceled' }
    },
    'startAt endAt'
  ).lean();

  /* 4) Hide slots that are in the past or <3 h away (LOCAL_TZ) and any that clash */
  const cutoff = dayjs().tz(LOCAL_TZ).add(3, 'hour');
  return slots.filter(s => {
    const clashes = taken.some(b => b.startAt <= s.start && b.endAt > s.start);
    const tooSoon = dayjs(s.start).tz(LOCAL_TZ).isBefore(cutoff);
    return !clashes && !tooSoon;
  });
}


/* ──────────────────────────────────────────────────────────
   Controllers
────────────────────────────────────────────────────────── */

/** GET /portal/booking (wizard) */
exports.renderSelfService = async (req, res, next) => {
  try {
    const rangeStart = dayjs().startOf('day').toDate();
    const rangeEnd   = dayjs().add(28, 'day').endOf('day').toDate();

    const [openSlots, myBookings] = await Promise.all([
      buildOpenSlots(rangeStart, rangeEnd),
      Booking.find({
        userId: req.session.user.id,
        endAt:  { $gte: rangeStart },
        status: { $ne: 'canceled' }
      })
        .sort({ startAt: 1 })
        .lean()
    ]);

    const next = myBookings.length ? myBookings[0] : null;

    /* ⇢ NEW – human-friendly label in Eastern Time */
    const nextBookingLabel = next
      ? (next.type === 'roofRepair'
            ? dayjs(next.startAt).tz(LOCAL_TZ).format('ddd, MMM D')
            : dayjs(next.startAt).tz(LOCAL_TZ).format('ddd, MMM D h:mm A') + ' (EST)')
      : null;

    res.render('portal/booking', {
      pageTitle       : 'Schedule Inspection / Samples',
      openSlots,
      myBookings,
      slotMinutes     : SLOT_MINUTES,
      nextBookingDate : next ? next.startAt       : null,
      nextBookingId   : next ? next._id.toString(): null,
      nextBookingLabel
    });
  } catch (err) { next(err); }
};

/** GET /portal/booking/feed */
exports.feedAvailability = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const slots = await buildOpenSlots(new Date(start), new Date(end));
    res.json(
      slots.map(s => ({
        start    : s.start,
        end      : s.end,
        display  : 'background',
        className: 'fc-available'
      }))
    );
  } catch (err) { next(err); }
};

/** POST /portal/booking (create | cancel | reschedule) */
exports.createOrCancel = async (req, res, next) => {
  try {
    const { bookingId, startAt, purpose, type } = req.body;

    /* ─────── RESCHEDULE ─────── */
    if (bookingId && startAt) {
      const booking = await Booking.findById(bookingId);
      if (!booking || booking.userId.toString() !== req.session.user.id) {
        return res.status(403).json({ ok:false, msg:'Not yours' });
      }
      if (!booking.canBeRescheduled(/*defaults to*/)) {
        return res.status(400).json({
          ok:  false,
          msg: `Rescheduling requires at least 3 hours’ notice.`
        });
      }

      const oldStart = booking.startAt;

      const newStart = dayjs(startAt);
      const newEnd   = newStart.add(SLOT_MINUTES, 'minute');
      if (!newStart.isValid()) {
        return res.status(400).json({ ok:false, msg:'Invalid startAt' });
      }

      const clash = await Booking.overlaps(newStart.toDate(), newEnd.toDate(), bookingId);
      if (clash) return res.status(409).json({ ok:false, msg:'Slot taken' });

      booking.startAt = newStart.toDate();
      booking.endAt   = newEnd.toDate();
      booking.history.push({
        evt    :'rescheduled',
        by     : req.session.user.id,
        details: { from: oldStart, to: newStart.toDate() }
      });
      await booking.save();

      req.app.get('io').to('calendarRoom').emit('calendarUpdated');
      const userDb = await User.findById(req.session.user.id).lean();
      await Promise.all([
        safeSend(sendClientBookingReschedule(userDb, booking, oldStart)),
        safeSend(sendAdminBookingReschedule(userDb, booking, oldStart))
      ]);

      return res.json({ ok:true, booking, rescheduled:true });
    }

    /* ─────── CANCEL ─────── */
    if (bookingId !== undefined) {
      if (!bookingId) {
        return res.status(400).json({ ok:false, msg:'Missing bookingId' });
      }

      const booking = await Booking.findById(bookingId);
      if (!booking || booking.userId.toString() !== req.session.user.id) {
        return res.status(403).json({ ok:false, msg:'Not yours' });
      }
      if (!booking.canBeCanceled(/*defaults to*/)) {
        return res.status(400).json({
          ok:  false,
          msg: `Cancellation requires at least 3 hours’ notice. Please contact us if you need to change sooner.`
        });
      }

      const snap = booking.toObject();
      await booking.deleteOne();

      /*  Re‑activate the client’s repair invite if a roof‑repair booking was cancelled  */
if (snap.type === 'roofRepair') {
  const invite =
    await require('../models/RepairInvite')
      .findOne({ userId: snap.userId, active: false });
  if (invite) {
    invite.active = true;      // resurrect the original invite
    await invite.save();
  } else {
    // Fallback safety: create a fresh invite with the same duration
    await require('../models/RepairInvite').create({
      userId      : snap.userId,
      durationDays: snap.durationDays || 1,
      active      : true
    });
  }
}


      req.app.get('io').to('calendarRoom').emit('calendarUpdated');
      const userDb = await User.findById(req.session.user.id).lean();
      await Promise.all([
        safeSend(sendClientBookingCancel(userDb, snap)),
        safeSend(sendAdminBookingCancel(userDb, snap))
      ]);

      return res.json({ ok:true, booking: snap });
    }

    /* ─────── CREATE ─────── */
    const start = dayjs(startAt);
    const end   = start.add(SLOT_MINUTES, 'minute');
    if (!start.isValid()) {
      return res.status(400).json({ ok:false, msg:'Invalid startAt' });
    }

    const clash = await Booking.overlaps(start.toDate(), end.toDate());
    if (clash) {
      return res.status(409).json({ ok:false, msg:'Slot taken' });
    }

    const openSlots = await buildOpenSlots(start.toDate(), end.toDate());
    const isInside  = openSlots.some(s => dayjs(s.start).isSame(start));
    if (!isInside) {
      return res.status(400).json({ ok:false, msg:'Not available' });
    }

    if (!['inspection','sample'].includes(type)) {
      return res.status(400).json({ ok:false, msg:'Bad type' });
    }

    const booking = await Booking.create({
      userId       : req.session.user.id,
      startAt      : start.toDate(),
      endAt        : end.toDate(),
      type,
      purpose,
      status       : 'confirmed',
      isSelfService: true,
      history      : [{ evt:'created', by:req.session.user.id }]
    });

    req.app.get('io').to('calendarRoom').emit('calendarUpdated');
    const userDb = await User.findById(req.session.user.id).lean();
    await Promise.all([
      safeSend(sendClientBookingConfirm(userDb, booking)),
      safeSend(sendAdminBookingConfirm(userDb, booking))
    ]);

    res.status(201).json({ ok:true, booking });
  } catch (err) {
    next(err);
  }
};
