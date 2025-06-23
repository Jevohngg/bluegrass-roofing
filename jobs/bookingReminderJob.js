// jobs/bookingReminderJob.js
const cron           = require('node-cron');
const dayjs          = require('dayjs');
const Booking        = require('../models/Booking');
const User           = require('../models/User');
const {
  sendClientBookingReminder,
  sendAdminBookingReminder
} = require('../utils/sendEmail');

/**
 * Run every 15 minutes and pick up bookings that are
 *  *exactly* 24h ±15 m or 2h ±15 m in the future,
 *  skipping anything we’ve already reminded for.
 *
 * Requires two extra history events: “reminded24h” / “reminded2h”
 */
function startReminderJob(io) {
  // cron‑exp “*/15 * * * *”  → every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    const now = dayjs();
    const in24h = now.add(24, 'hour');
    const in2h  = now.add(2,  'hour');

    // rounded windows (±15 m)
    const windowStart24 = in24h.subtract(15, 'minute').toDate();
    const windowEnd24   = in24h.add(15, 'minute').toDate();
    const windowStart2  = in2h.subtract(15, 'minute').toDate();
    const windowEnd2    = in2h.add(15, 'minute').toDate();

    const bookings = await Booking.find({
      status: 'confirmed',
      startAt: {
        $gte: Math.min(windowStart24, windowStart2),
        $lte: Math.max(windowEnd24,   windowEnd2)
      }
    }).lean();

    for (const b of bookings) {
      const start = b.startAt;
      const user  = await User.findById(b.userId).lean();
      if (!user) continue;

      const diffMs = start.getTime() - now.valueOf();
      const is24h  = diffMs > 23.5 * 60 * 60 * 1000 && diffMs < 24.5 * 60 * 60 * 1000;
      const is2h   = diffMs >  1.5 * 60 * 60 * 1000 && diffMs <  2.5 * 60 * 60 * 1000;

      // helper to check history flag
      const wasSent = (code) => b.history?.some(h => h.evt === code);

      if (is24h && !wasSent('reminded24h')) {
        await Promise.all([
          safeSend(sendClientBookingReminder(user, b, '24 hours')),
          safeSend(sendAdminBookingReminder(user, b, '24 hours'))
        ]);
        await Booking.updateOne({ _id: b._id }, { $push:{ history:{ evt:'reminded24h', at:new Date() } } });
        io.to('calendarRoom').emit('calendarUpdated'); // optional UI ping
      }

      if (is2h && !wasSent('reminded2h')) {
        await Promise.all([
          safeSend(sendClientBookingReminder(user, b, '2 hours')),
          safeSend(sendAdminBookingReminder(user, b, '2 hours'))
        ]);
        await Booking.updateOne({ _id: b._id }, { $push:{ history:{ evt:'reminded2h', at:new Date() } } });
        io.to('calendarRoom').emit('calendarUpdated');
      }
    }
  });
}

/* wrapper reused from controller */
async function safeSend(p) { try { await p; } catch(e){ console.error('[SendGrid]',e?.response?.body||e);} }

module.exports = startReminderJob;
