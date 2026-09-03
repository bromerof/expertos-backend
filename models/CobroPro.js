// models/CobroPro.js — Historial de cobros automaticos de la suscripcion Pro

const mongoose = require('mongoose');

const cobroProSchema = new mongoose.Schema({
  experto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto',
    required: true
  },
  montoEnCentavos: {
    type: Number,
    required: true
  },
  estado: {
    type: String,
    enum: ['aprobada', 'rechazada', 'pendiente'],
    required: true
  },
  idTransaccionWompi: {
    type: String,
    default: ''
  },
  referencia: {
    type: String,
    required: true
  },
  intentoNumero: {
    type: Number,
    default: 1
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const CobroPro = mongoose.model('CobroPro', cobroProSchema);

module.exports = CobroPro;