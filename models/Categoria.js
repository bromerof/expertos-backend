const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true
  },
  orden: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Categoria', categoriaSchema);