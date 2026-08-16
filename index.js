// index.js — Servidor de EXPERTOS conectado a MongoDB

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Experto = require('./models/Experto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: permite que el servidor entienda JSON en las peticiones
app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

app.get('/', (req, res) => {
  res.send('¡Hola! El servidor de EXPERTOS está funcionando 🎉');
});

// Endpoint para crear un nuevo experto
app.post('/api/expertos', async (req, res) => {
  try {
    const nuevoExperto = new Experto(req.body);
    const expertoGuardado = await nuevoExperto.save();
    res.status(201).json(expertoGuardado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear el experto', error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});