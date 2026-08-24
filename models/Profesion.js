const mongoose = require('mongoose');

const profesionSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    required: true
  }
});

// Evita que la misma profesión se repita dos veces dentro de la MISMA categoría
// (pero sí permite que, por ejemplo, "Otra" exista una vez en cada categoría distinta)
profesionSchema.index({ nombre: 1, categoria: 1 }, { unique: true });

module.exports = mongoose.model('Profesion', profesionSchema);