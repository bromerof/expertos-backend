// models/Suscripcion.js — Define la estructura de una suscripción mensual

const mongoose = require('mongoose');

const suscripcionSchema = new mongoose.Schema({
  experto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto',
    required: true
  },
  estado: {
    type: String,
    enum: ['activa', 'vencida', 'cancelada'],
    default: 'activa'
  },
  fechaInicio: {
    type: Date,
    default: Date.now
  },
  fechaRenovacion: {
    type: Date,
    required: true
  },
  monto: {
    type: Number,
    default: 4200 // valor de referencia en COP (~1 USD)
  }
});

const Suscripcion = mongoose.model('Suscripcion', suscripcionSchema);

module.exports = Suscripcion;