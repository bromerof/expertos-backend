// models/Aporte.js — Aportes voluntarios de clientes para el mantenimiento de la plataforma

const mongoose = require('mongoose');

const aporteSchema = new mongoose.Schema({
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto'
  },
  referencia: {
    type: String,
    required: true,
    unique: true
  },
  montoEnCentavos: {
    type: Number,
    required: true
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobada', 'rechazada'],
    default: 'pendiente'
  },
  idTransaccionWompi: {
    type: String,
    default: ''
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

const Aporte = mongoose.model('Aporte', aporteSchema);

module.exports = Aporte;