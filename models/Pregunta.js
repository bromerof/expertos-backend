// models/Pregunta.js — Preguntas frecuentes, gestionadas por el admin

const mongoose = require('mongoose');

const preguntaSchema = new mongoose.Schema({
  seccion: {
    type: String,
    required: true,
    trim: true
  },
  pregunta: {
    type: String,
    required: true,
    trim: true
  },
  respuesta: {
    type: String,
    required: true,
    trim: true
  },
  orden: {
    type: Number,
    default: 0
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

const Pregunta = mongoose.model('Pregunta', preguntaSchema);

module.exports = Pregunta;