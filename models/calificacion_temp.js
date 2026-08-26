// models/Calificacion.js — Calificaciones bidireccionales entre expertos y clientes

const mongoose = require('mongoose');

const calificacionSchema = new mongoose.Schema({
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto',
    required: true
  },
  receptor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Experto',
    required: true
  },
  puntuacion: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comentario: {
    type: String,
    default: ''
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

// Una persona solo puede tener UNA calificacion vigente hacia otra persona
// (si vuelve a calificarla, se actualiza la misma en vez de crear otra)
calificacionSchema.index({ autor: 1, receptor: 1 }, { unique: true });

const Calificacion = mongoose.model('Calificacion', calificacionSchema);

module.exports = Calificacion;