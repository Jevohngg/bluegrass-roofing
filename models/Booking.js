// models/Booking.js
const mongoose = require('mongoose');
const BookingSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startAt:  { type: Date, required: true },
  endAt:    { type: Date, required: true },
  /** inspection | sample | repair | installation */
  type:     { type: String, required: true, enum:
              ['inspection','sample','repair','installation'] },
  /** invited | pending | confirmed | completed | canceled (etc.) */
  status:   { type: String, default: 'confirmed' },
  /** sys1 | sys2 */
  source:   { type: String, required: true },
  meta:     { type: mongoose.Schema.Types.Mixed, default: {} },
  history:  [{
    at:  { type: Date, default: Date.now },
    evt: { type: String },
    by:  { type: String }                    // userId | 'system'
  }]
}, { timestamps: true });

/* No‑overlap guard */
BookingSchema.index(
  { startAt: 1, endAt: 1 },
  { unique: false }
);

module.exports = mongoose.model('Booking', BookingSchema);
