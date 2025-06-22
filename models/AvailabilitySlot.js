// models/AvailabilitySlot.js
const mongoose = require('mongoose');

const AvailabilitySlotSchema = new mongoose.Schema({
  /** 0 = Sun … 6 = Sat  (local contractor TZ) */
  dayOfWeek:     { type: Number,  required: true, min: 0, max: 6 },
  /** Minutes since 00:00 local (e.g. 540 = 09:00) */
  startMinutes:  { type: Number,  required: true, min: 0, max: 1439 },
  endMinutes:    { type: Number,  required: true, min: 1,  max: 1440 },

  /** True = weekly template; False = single‑date override */
  repeatWeekly:  { type: Boolean, default: true },

  /** If repeatWeekly===false, set the exact UTC date yy‑mm‑dd */
  dateOverride:  { type: Date },

}, { timestamps: true });

/* Prevent duplicates within the same template */
AvailabilitySlotSchema.index(
  { dayOfWeek: 1, startMinutes: 1, repeatWeekly: 1, dateOverride: 1 },
  { unique: true }
);

/* Utility – convert to FullCalendar “backgroundEvent” */
AvailabilitySlotSchema.methods.toBackgroundEvent = function (weekStartUtc) {
  // Convert minutes to a concrete date inside the requested week
    const dayOffset = this.dayOfWeek;              // 0-6 Sunday-Saturday
    // 1) Build a base date at UTC week start
    const base = new Date(weekStartUtc);
    base.setUTCDate(base.getUTCDate() + dayOffset);
  
    // 2) Convert slot minutes → local hours/minutes
    const startHour   = Math.floor(this.startMinutes / 60);
    const startMinute = this.startMinutes % 60;
    const start       = new Date(base);
    start.setHours(startHour, startMinute, 0, 0);
  
    const endHour     = Math.floor(this.endMinutes / 60);
    const endMinute   = this.endMinutes % 60;
    const end         = new Date(start);
    end.setHours(endHour, endMinute, 0, 0);
      return {
        id:        this._id.toString(),
        start,
        end,
        display:   'background',
        className: 'fc-available'
      };
};

module.exports = mongoose.model('AvailabilitySlot', AvailabilitySlotSchema);
