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
/* ---------- PATCH START ---------- */
AvailabilitySlotSchema.methods.toBackgroundEvent = function (weekStartUtc) {
  let localBase;
  if (this.repeatWeekly) {
    // weekly template: align to same weekday inside requested week
    localBase = dayjs
      .tz(weekStartUtc, LOCAL_TZ)      // Sun 00:00 local
      .add(this.dayOfWeek, 'day')
      .startOf('day');
  } else {
    // one‑off override: anchor to specific calendar date
    localBase = dayjs.tz(this.dateOverride, LOCAL_TZ).startOf('day');
  }

  const start = localBase.add(this.startMinutes, 'minute').toDate();
  const end   = localBase.add(this.endMinutes, 'minute').toDate();
  const iso   = start.toISOString().slice(0, 10);

  return {
    id             : `${this._id}-${iso}`,
    start,
    end,
    display        : 'background',
    backgroundColor: '#28a745',
    borderColor    : '#28a745',
    className      : 'fc-available',
    extendedProps  : { repeatWeekly: this.repeatWeekly, dateOverride: this.dateOverride }
  };
};
/* ----------  PATCH END  ---------- */


module.exports = mongoose.model('AvailabilitySlot', AvailabilitySlotSchema);
