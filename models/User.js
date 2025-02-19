// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const DocumentSchema = new mongoose.Schema({
  signed: { type: Boolean, default: false },
  signedAt: { type: Date },
  docUrl: { type: String } // if you generate a PDF or store a final doc copy
});

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  // Existing:
  selectedPackage: { type: String, default: '' },

  // 1) Claim upload
  claimUploadUrl: { type: String, default: '' },

  // 2) Documents
  // If "aob" is signed, no need for "aci" or "loi"
  documents: {
    aob: { type: DocumentSchema, default: () => ({}) },
    aci: { type: DocumentSchema, default: () => ({}) },
    loi: { type: DocumentSchema, default: () => ({}) }
  },

  // 3) Shingle choice
  shingleChoice: {
    name: { type: String, default: '' },
    imageUrl: { type: String, default: '' }
  }

}, { timestamps: true });

// Pre-save hook to hash password if new or modified
UserSchema.pre('save', async function (next) {
  try {
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

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
