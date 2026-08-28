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
      return this.rol !== 'admin' && this.rol !== 'cliente';
    }
  }, 
  descripcion: {
    type: String
  },
  otraCategoriaTexto: {
    type: String,
    default: ''
  },
  otraProfesionTexto: {
    type: String,
    default: ''
  },
  terminosAceptados: {
    type: Boolean,
    default: false
  },
  terminosFecha: {
    type: Date
  },
  datosAceptados: {
    type: Boolean,
    default: false
  },
  datosFecha: {
    type: Date
  },
  reglasAceptadas: {
    type: Boolean,
    default: false
  },
  reglasFecha: {
    type: Date
  },
  comunicacionesAceptadas: {
    type: Boolean,
    default: false
  },
  comunicacionesFecha: {
    type: Date
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
    }
  },
    tipoDocumento: {
    type: String,
    enum: ['CC', 'CE', 'Pasaporte'],
    default: 'CC'
  },
  numeroDocumento: {
    type: String,
    required: true
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
    required: true
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
    enum: ['experto', 'admin', 'cliente'],
    default: 'experto'
  }, 
  
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

// Indices combinados: una misma persona puede tener una cuenta de experto Y una
// cuenta de cliente con el mismo correo, whatsapp o numeroDocumento (son cuentas
// distintas). Lo que NO se permite es que DOS personas distintas registren el
// mismo dato bajo el MISMO rol (ej. dos expertos con el mismo correo).
expertoSchema.index({ correo: 1, rol: 1 }, { unique: true });
expertoSchema.index(
  { whatsapp: 1, rol: 1 },
  { unique: true, partialFilterExpression: { whatsapp: { $exists: true } } }
);
expertoSchema.index({ numeroDocumento: 1, rol: 1 }, { unique: true });

const Experto = mongoose.model('Experto', expertoSchema);

module.exports = Experto;