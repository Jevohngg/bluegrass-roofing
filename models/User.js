// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Adjust saltRounds if desired (10-12 is common)
const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  // If you want to store the selected package in the user record:
  selectedPackage: {
    type: String,
    default: ''
  }
}, { timestamps: true });

// Pre-save hook to hash password if it's new or modified
UserSchema.pre('save', async function (next) {
  try {
    // Only hash if password is new or has been modified
    if (!this.isModified('password')) {
      return next();
    }
    const hashed = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// Helper method to compare candidate password with hashed password
UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
