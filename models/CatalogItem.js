// models/CatalogItem.js
const mongoose = require('mongoose');

const CatalogItemSchema = new mongoose.Schema({
  name:        { type: String,  required: true, trim: true },
  description: { type: String,  default: '',   trim: true },
  type:        { type: String,  enum: ['product', 'service'], required: true },
  color:       { type: String,  default: '' },             // e.g. “#FF0000” or “Weathered Wood”
  builderCost: { type: Number,  required: true, min: 0 },
  retailCost:  { type: Number,  required: true, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model('CatalogItem', CatalogItemSchema);
