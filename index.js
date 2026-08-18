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
// Endpoint para obtener UN experto específico por su ID
app.get('/api/expertos/:id', async (req, res) => {
  try {
    const experto = await Experto.findById(req.params.id);

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json(experto);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar el experto', error: error.message });
  }
});
// Endpoint para actualizar un experto existente
app.put('/api/expertos/:id', async (req, res) => {
  try {
    const expertoActualizado = await Experto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!expertoActualizado) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json(expertoActualizado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar el experto', error: error.message });
  }
});

// Endpoint para eliminar un experto
app.delete('/api/expertos/:id', async (req, res) => {
  try {
    const expertoEliminado = await Experto.findByIdAndDelete(req.params.id);

    if (!expertoEliminado) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Experto eliminado correctamente', experto: expertoEliminado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el experto', error: error.message });
  }
});
// Endpoint para generar el enlace de contacto por WhatsApp
app.get('/api/expertos/:id/contacto', async (req, res) => {
  try {
    const experto = await Experto.findById(req.params.id);

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    // Limpiar el número: nos aseguramos de que solo tenga dígitos
    const numeroLimpio = experto.whatsapp.replace(/\D/g, '');

    // Agregar el código de país de Colombia si no lo tiene ya
    const numeroConPais = numeroLimpio.startsWith('57')
      ? numeroLimpio
      : `57${numeroLimpio}`;

    const mensaje = `Hola ${experto.nombre}, te contacto a través de EXPERTOS. Vi tu perfil de ${experto.categoria} y quisiera más información sobre tus servicios.`;

    const enlaceWhatsApp = `https://wa.me/${numeroConPais}?text=${encodeURIComponent(mensaje)}`;

    res.status(200).json({ enlaceWhatsApp });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el enlace de contacto', error: error.message });
  }
});