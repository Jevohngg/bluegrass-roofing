// models/Thread.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// A subdocument schema for messages
const MessageSchema = new Schema({
  sender: { type: String, required: true }, 
  // 'admin' or user._id.toString()

  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false } 
});

const ThreadSchema = new Schema({
  // There's exactly one thread per client
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // Ensure only one thread per user
  },
  messages: [MessageSchema],
  // Optionally store if there's any "lastMessageAt" for sorting
  lastMessageAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Thread', ThreadSchema);
