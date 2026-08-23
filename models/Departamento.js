// models/Departamento.js — Departamentos de Colombia (DIVIPOLA - DANE)

const mongoose = require('mongoose');

const departamentoSchema = new mongoose.Schema({
  codigoDane: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  }
});

const Departamento = mongoose.model('Departamento', departamentoSchema);

module.exports = Departamento;