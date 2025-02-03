// models/Lead.js
const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
    formType: { type: String, required: true },
    fullName: { type: String, required: true },
    emailAddress: { type: String, required: true },
    phoneNumber: { type: String },
    message: { type: String },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'new' }  // Added status field
  });
  

module.exports = mongoose.model('Lead', LeadSchema);
