// models/RepairInvite.js
const mongoose = require('mongoose');

module.exports = mongoose.model('RepairInvite', new mongoose.Schema({
  userId      : { type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  durationDays: { type:Number, enum:[0.5,1,2,3,4,5], required:true },
  active      : { type:Boolean, default:true },          // false ⇒ removed/used
  createdAt   : { type:Date, default:Date.now }
}));
