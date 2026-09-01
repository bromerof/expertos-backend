// models/Articulo.js — Articulos del blog de EXPERTOS

const mongoose = require('mongoose');

const articuloSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  resumen: {
    type: String,
    required: true
  },
  contenido: {
    type: String,
    required: true
  },
  imagenPortada: {
    type: String,
    default: ''
  },
  estado: {
    type: String,
    enum: ['borrador', 'publicado'],
    default: 'borrador'
  },
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaPublicacion: {
    type: Date
  }
});

const Articulo = mongoose.model('Articulo', articuloSchema);

module.exports = Articulo;