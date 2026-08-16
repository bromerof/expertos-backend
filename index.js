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
// Endpoint para listar y buscar expertos
app.get('/api/expertos', async (req, res) => {
  try {
    const filtro = {};

    // Si el usuario envía ?categoria=Plomeria, lo agregamos al filtro
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria;
    }

    // Si el usuario envía ?ubicacion=Medellin, lo agregamos al filtro
    if (req.query.ubicacion) {
      filtro.ubicacion = req.query.ubicacion;
    }

    const expertos = await Experto.find(filtro);
    res.status(200).json(expertos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar expertos', error: error.message });
  }
});