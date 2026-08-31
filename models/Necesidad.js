// models/Necesidad.js — Necesidades/ofertas de trabajo publicadas por clientes

const mongoose = require('mongoose');

const necesidadSchema = new mongoose.Schema({
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto',
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  profesion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profesion'
  },
  municipio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipio'
  },
  modalidad: {
    type: String,
    enum: ['presencial', 'virtual', 'cualquiera'],
    default: 'cualquiera'
  },
  estado: {
    type: String,
    enum: ['abierta', 'cerrada'],
    default: 'abierta'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

const Necesidad = mongoose.model('Necesidad', necesidadSchema);

module.exports = Necesidad;