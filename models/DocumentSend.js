// models/DocumentSend.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentSendSchema = new Schema({
  // The email address of the intended recipient.
  // If there's no existing user, it will still store the email.
  recipientEmail: {
    type: String,
    required: true,
  },

  // References the user once we discover one
  // (either the admin picks an existing user or the user signs up later).
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // The type of document being sent, e.g. "aob", "aci", "loi", "gsa", "coc"
  docType: {
    type: String,
    required: true
  },

  // A place to store key-value pairs of "pre-filled" fields:
  // For example: { propertyAddress: '...', insuranceCompany: '...' }
  prefilledFields: {
    type: Map,
    of: String,
    default: {}
  },

  // A custom message entered by the admin for the email body
  customMessage: {
    type: String,
    default: ''
  },

  // Track the status: 'sent', 'signed', etc.
  status: {
    type: String,
    enum: ['sent', 'signed', 'canceled'],
    default: 'sent'
  },

  // Store date/time of sending, signing, etc.
  sentAt: { type: Date, default: Date.now },
  signedAt: { type: Date, default: null },

  // The final PDF URL if the user has signed.
  docUrl: { type: String, default: '' }
});

module.exports = mongoose.model('DocumentSend', DocumentSendSchema);
