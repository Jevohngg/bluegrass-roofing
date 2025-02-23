// models/User.js

const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const SALT_ROUNDS = 10;

const DocumentFieldsSchema = new mongoose.Schema({
  propertyAddress: { type: String, default: '' },
  insuranceCompany: { type: String, default: '' },
  policyNumber: { type: String, default: '' },
  claimNumber: { type: String, default: '' },
  expirationCondition: { type: String, default: '' }
});

const DocumentSchema = new mongoose.Schema({
  signed: { type: Boolean, default: false },
  signedAt: { type: Date },
  docUrl: { type: String, default: '' },
  fields: { type: DocumentFieldsSchema, default: () => ({}) }
});

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  selectedPackage: { type: String, default: '' },

  claimUploadUrl: { type: String, default: '' },
  claimUploadUrls: [{ type: String, default: [] }],

  documents: {
    aob: { type: DocumentSchema, default: () => ({}) },
    aci: { type: DocumentSchema, default: () => ({}) },
    loi: { type: DocumentSchema, default: () => ({}) }
  },

  shingleChoice: {
    name: { type: String, default: '' },
    imageUrl: { type: String, default: '' }
  },

  resetPasswordCode: { type: String, default: '' },
  resetPasswordExpires: { type: Date },

  // New field to allow archiving users without deleting them
  status: { 
    type: String, 
    enum: ['active', 'archived'], 
    default: 'active' 
  }
}, { timestamps: true });

// Hash password on save
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
