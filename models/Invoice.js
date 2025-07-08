// models/Invoice.js
const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  name:        { type:String, required:true, trim:true },
  description: { type:String, default:'', trim:true },
  color:       { type:String, default:'' },
  qty:         { type:Number, min:0, required:true },
  unit:        { type:String, enum:['SQ','SF','LF','EA'], required:true },
  price:       { type:Number, min:0, required:true }        // retail price *per‑unit*
}, { _id:false });

LineItemSchema.virtual('total').get(function () {
  return this.price * this.qty;
});

const InvoiceSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  proposalId:   { type: mongoose.Schema.Types.ObjectId, ref:'Proposal', default:null },
  estimateId:   { type: mongoose.Schema.Types.ObjectId, ref:'Estimate', default:null },

  businessName:  { type:String, required:true },
  businessAddr:  { type:String, required:true },
  businessPhone: { type:String, required:true },

  invoiceNumber: { type:String, required:true, unique:true, trim:true },
  issuedDate:    { type:Date, default: Date.now },
  dueDate:       { type:Date, required:true },

  builderNotes:  { type:String, default:'' },

  lineItems:   [LineItemSchema],

  totals: {
    subtotal: { type:Number, default:0 },
    total:    { type:Number, default:0 }
  },

  status: { type:String, enum:['draft','sent','paid','overdue'], default:'draft' },

  pdfUrl: { type:String, default:'' }

}, { timestamps:true });

/* ---- auto‑recalc totals ---- */
InvoiceSchema.pre('save', function (next) {
  const subtotal = this.lineItems.reduce((s, li)=> s + (li.price*li.qty), 0);
  this.totals = { subtotal, total: subtotal };   // add tax/fees here if later
  next();
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
