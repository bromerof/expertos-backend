// models/Municipio.js — Municipios de Colombia (DIVIPOLA - DANE)

const mongoose = require('mongoose');

const municipioSchema = new mongoose.Schema({
  codigoDane: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  },
  departamento: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Departamento',
    required: true
  }
});

const Municipio = mongoose.model('Municipio', municipioSchema);

module.exports = Municipio;