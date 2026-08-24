// models/Experto.js — Define la estructura de un perfil de experto

const mongoose = require('mongoose');

const expertoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
      profesion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profesion',
    required: function () {
      return this.rol !== 'admin';
    }
  },
  descripcion: {
    type: String
  },
    ubicaciones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipio'
  }],
  atiendePresencial: {
    type: Boolean,
    default: true
  },
  atiendeVirtual: {
    type: Boolean,
    default: false
  },
    coberturaVirtualNacional: {
    type: Boolean,
    default: false
  },
        whatsapp: {
    type: String,
    required: function () {
      return this.rol !== 'admin';
    },
    unique: true,
    sparse: true
  },
    tipoDocumento: {
    type: String,
    enum: ['CC', 'CE', 'Pasaporte'],
    default: 'CC'
  },
  numeroDocumento: {
    type: String,
    required: true,
    unique: true
  },
    fotoDocumentoFrente: {
    type: String,
    default: ''
  },
  fotoDocumentoReverso: {
    type: String,
    default: ''
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