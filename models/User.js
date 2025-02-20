const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const SALT_ROUNDS = 10;

const DocumentSchema = new mongoose.Schema({
  signed: { type: Boolean, default: false },
  signedAt: { type: Date },
  docUrl: { type: String } // Store signature data (e.g., base64 or URL to PDF)
});

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  // Existing:
  selectedPackage: { type: String, default: '' },

  // Claim uploads
  claimUploadUrl: { type: String, default: '' }, // Legacy single file (optional, can be removed if unused)
  claimUploadUrls: [{ type: String, default: [] }], // Array of S3 URLs for multiple files

  // Documents
  documents: {
    aob: { type: DocumentSchema, default: () => ({}) },
    aci: { type: DocumentSchema, default: () => ({}) },
    loi: { type: DocumentSchema, default: () => ({}) }
  },

  // Shingle choice
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
    const hashed = await bcryptjs.hash(this.password, SALT_ROUNDS);
    this.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcryptjs.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);