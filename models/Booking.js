// models/Booking.js
const mongoose = require('mongoose');

// ─── dayjs + TZ setup ───────────────────────────────
const dayjs = require('dayjs');
const utc   = require('dayjs/plugin/utc');
const tz    = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);

/** Eastern Time for Lexington, KY */
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';

/* ──────────────────────────────────────────────────────────
   Booking  ▸ Schema
   ────────────────────────────────────────────────────────── */
const BookingSchema = new mongoose.Schema(
  {
    /* — Core — */
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startAt: { type: Date, required: true },
    endAt:   { type: Date, required: true },
    durationDays: { type:Number, default: 0.0417 },

    /* — Enums — */
    type: {
      type: String,
      enum: ['inspection','sample','repair','installation','roofRepair'],
      required: true
    },
    status: {
      type: String,
      enum: ['confirmed', 'canceled', 'pending', 'completed'],
      default: 'confirmed'
    },

    /* — Metadata / misc — */
    purpose:       { type: String, maxlength: 120 },  // free‑text note
    isSelfService: { type: Boolean, default: true },  // distinguishes System #1
    source:        { type: String, default: 'sys1' }, // keeps existing field happy
    meta:          { type: mongoose.Schema.Types.Mixed, default: {} },

    /* — Audit trail — */
    history: [
      {
        at:     { type: Date,   default: Date.now },
        evt:    { type: String },         // created | canceled | rescheduled | …
        by:     { type: String },         // userId | 'system'
        details:{ type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ]
  },
  { timestamps: true }
);

/* — Indices — */
BookingSchema.index({ startAt: 1, endAt: 1 }); // overlap detection

/* ──────────────────────────────────────────────────────────
   Static helpers
   ────────────────────────────────────────────────────────── */

/**
 * Find a booking that overlaps the given interval.
 * If `ignoreId` is provided, that booking will be excluded
 * (useful when rescheduling an existing record so it doesn’t
 * conflict with itself).
 *
 * @param {Date}  start
 * @param {Date}  end
 * @param {String|mongoose.Types.ObjectId|null} [ignoreId]
 * @returns {Promise<Object|null>}
 */
BookingSchema.statics.overlaps = function (start, end, ignoreId = null) {
  const query = {
    startAt: { $lt: end },
    endAt:   { $gt: start },
    status:  { $ne: 'canceled' }
  };
  if (ignoreId) query._id = { $ne: ignoreId };
  return this.findOne(query).lean();
};

/* ──────────────────────────────────────────────────────────
   Instance helpers
   ────────────────────────────────────────────────────────── */

/**
 * Can this booking still be canceled / rescheduled?
 * Rule: at least 24 hours before start time.
 *
 * @returns {Boolean}
 */
BookingSchema.methods.canBeCanceled = function(cutoffHours = 3) {    // ← was 2
  return dayjs()
    .tz(LOCAL_TZ)
    .isBefore(dayjs(this.startAt).tz(LOCAL_TZ).subtract(cutoffHours, 'hour'));
};

// (optional) likewise for reschedule if you want the same window:
BookingSchema.methods.canBeRescheduled = function(cutoffHours = 3) {
  return dayjs()
    .tz(LOCAL_TZ)
    .isBefore(dayjs(this.startAt).tz(LOCAL_TZ).subtract(cutoffHours, 'hour'));
};

module.exports = mongoose.model('Booking', BookingSchema);
