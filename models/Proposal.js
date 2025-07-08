// models/Proposal.js
const mongoose = require('mongoose');

const ProposalSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  estimateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Estimate' },
  title:      { type: String, default: 'Proposal', trim: true },
  intro:      { type: String, default: '' },
  includeIntro:   { type: Boolean, default: false },
  includeEstimate:{ type: Boolean, default: false },
  includeOutro:   { type: Boolean, default: false },
  outro:      { type: String, default: '' },
  status:     { type: String, enum: ['draft','sent','approved','rejected'], default: 'draft' },
  pdfUrl:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Proposal', ProposalSchema);
