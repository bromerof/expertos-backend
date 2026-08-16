// models/Experto.js — Define la estructura de un perfil de experto

const mongoose = require('mongoose');

const expertoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    required: true
  },
  descripcion: {
    type: String
  },
  ubicacion: {
    type: String,
    required: true
  },
  whatsapp: {
    type: String,
    required: true
  },
  anosExperiencia: {
    type: Number,
    default: 0
  },
  plan: {
    type: String,
    enum: ['gratuito', 'pro'],
    default: 'gratuito'
  },
  verificado: {
    type: Boolean,
    default: false
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

const Experto = mongoose.model('Experto', expertoSchema);

module.exports = Experto;