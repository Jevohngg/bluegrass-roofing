// models/Estimate.js
const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  name        : { type:String, required:true, trim:true },
  description : { type:String, default:'', trim:true },
  catalogItemId: { type:mongoose.Schema.Types.ObjectId, ref:'CatalogItem' },
  color       : { type:String, default:'' },
  qty         : { type:Number, min:0,   required:true },
  unit        : { type:String, enum:['SQ','SF','LF','EA'], required:true },
  builderCost : { type:Number, min:0, required:true },
  retailCost  : { type:Number, min:0, required:true },
  markup      : {
    type : { type:String, enum:['$','%'], required:true },
    value: { type:Number, min:0, required:true }
  }
}, { _id:false });

/* ───── Virtuals ───── */
LineItemSchema.virtual('total').get(function(){
  const base = this.retailCost * this.qty;
  return this.markup.type === '$'
    ? base + this.markup.value
    : base * (1 + this.markup.value / 100);
});
LineItemSchema.virtual('profit').get(function(){
  return this.total - (this.builderCost * this.qty);
});

const EstimateSchema = new mongoose.Schema({
  userId : { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title  : { type:String, default:'Estimate', trim:true },
  status : { type:String, enum:['draft','archived'], default:'draft' },
  lineItems: [LineItemSchema],
  totals : {
    subtotal   : { type:Number, default:0 },
    profit     : { type:Number, default:0 },
    markupTotal: { type:Number, default:0 }
  }
}, { timestamps:true });

/* ───── Pre‑save to refresh cached totals ───── */
EstimateSchema.pre('save', function(next){
  const subtotal   = this.lineItems.reduce((s, li)=> s + (li.retailCost * li.qty), 0);
  const markupTot  = this.lineItems.reduce((s, li)=> s + (li.total - li.retailCost*li.qty), 0);
  const profit     = this.lineItems.reduce((s, li)=> s + li.profit, 0);
  this.totals = { subtotal, markupTotal:markupTot, profit };
  next();
});

module.exports = mongoose.model('Estimate', EstimateSchema);
