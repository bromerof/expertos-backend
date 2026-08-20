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
  correo: {
    type: String,
    required: true,
    unique: true
  },
  contraseña: {
    type: String,
    required: true,
    select: false
  },
    foto: {
    type: String,
    default: ''
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
    rol: {
    type: String,
    enum: ['experto', 'admin'],
    default: 'experto'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

const Experto = mongoose.model('Experto', expertoSchema);

module.exports = Experto;