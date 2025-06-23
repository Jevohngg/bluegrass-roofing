// models/AvailabilitySlot.js
const mongoose = require('mongoose');
const dayjs    = require('dayjs');
const utc      = require('dayjs/plugin/utc');
const tz       = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(tz);

/**  Lexington, KY ⇒ Eastern Time  */
const LOCAL_TZ = process.env.LOCAL_TZ || 'America/New_York';

/* ──────────────────────────────────────────────────────────
   Schema
────────────────────────────────────────────────────────── */
const AvailabilitySlotSchema = new mongoose.Schema(
  {
    /** 0 = Sun … 6 = Sat  (local contractor TZ) */
    dayOfWeek:    { type: Number,  required: true, min: 0, max: 6 },

    /** Minutes since 00:00 local (e.g. 540 = 09:00) */
    startMinutes: { type: Number,  required: true, min: 0,   max: 1439 },
    endMinutes:   { type: Number,  required: true, min: 1,   max: 1440 },

    /** True = weekly template; False = single-date override */
    repeatWeekly: { type: Boolean, default: true },

    /** If repeatWeekly === false, set the exact LOCAL date */
    dateOverride: { type: Date }               // optional
  },
  { timestamps: true }
);

/* Prevent duplicates within the same template */
AvailabilitySlotSchema.index(
  { dayOfWeek: 1, startMinutes: 1, repeatWeekly: 1, dateOverride: 1 },
  { unique: true }
);

/* ──────────────────────────────────────────────────────────
   Helper – convert to FullCalendar background event
────────────────────────────────────────────────────────── */
AvailabilitySlotSchema.methods.toBackgroundEvent = function (weekStartUtc) {
  // 1) Take the passed-in UTC date, interpret in LOCAL_TZ,
  //    move to Sunday 00:00, then shift by this.dayOfWeek days.
  const localBase = dayjs
    .tz(weekStartUtc, LOCAL_TZ)   // e.g. “2025-06-21T00:00:00” Eastern
    .add(this.dayOfWeek, 'day')    // shift to Mon/Tue/etc
    .startOf('day');               // reset to 00:00 that weekday

  // 2) Add minutes offset local→UTC
  const start = localBase
    .add(this.startMinutes, 'minute')
    .toDate();
  const end = localBase
    .add(this.endMinutes, 'minute')
    .toDate();

  // 3) Build a per-day unique suffix so each slot instance
  //    gets its own ID (prevents FC collapsing them)
  const iso = start.toISOString().slice(0, 10); // “YYYY-MM-DD”

  // 4) Return the FC “background” event object
  return {
    id             : `${this._id}-${iso}`,
    start,
    end,
    display        : 'background',
    backgroundColor: '#28a745',
    borderColor    : '#28a745',
    className      : 'fc-available'
  };
};

module.exports = mongoose.model('AvailabilitySlot', AvailabilitySlotSchema);
