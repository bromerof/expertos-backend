// models/Busqueda.js — Registro de cada búsqueda realizada por un cliente

const mongoose = require('mongoose');

const busquedaSchema = new mongoose.Schema({
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto'
  },
  termino: {
    type: String,
    default: ''
  },
  ubicacion: {
    type: String,
    default: ''
  },
  resultados: {
    type: Number,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const Busqueda = mongoose.model('Busqueda', busquedaSchema);

module.exports = Busqueda;