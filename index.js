// index.js — Servidor de EXPERTOS conectado a MongoDB

require('dotenv').config();
function normalizarTexto(texto) {
  if (!texto) return texto;
  return texto
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(palabra => palabra !== '')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Experto = require('./models/Experto');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const Suscripcion = require('./models/Suscripcion');
const authRoutes = require('./routes/auth');
const verificarToken = require('./middleware/verificarToken');
const adminRoutes = require('./routes/admin');
const multer = require('multer');
const { storage } = require('./config/cloudinary');
const upload = multer({ storage });
const Departamento = require('./models/Departamento');
const Municipio = require('./models/Municipio');
const Categoria = require('./models/Categoria');
const Profesion = require('./models/Profesion');

// Middleware: permite que el servidor entienda JSON en las peticiones
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

app.get('/', (req, res) => {
  res.send('¡Hola! El servidor de EXPERTOS está funcionando 🎉');
});
// Endpoint para listar todos los departamentos
app.get('/api/departamentos', async (req, res) => {
  try {
    const departamentos = await Departamento.find().sort({ nombre: 1 });
    res.status(200).json(departamentos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener departamentos', error: error.message });
  }
});

// Endpoint para listar municipios, opcionalmente filtrados por departamento
app.get('/api/municipios', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.departamento) {
      filtro.departamento = req.query.departamento;
    }

    const municipios = await Municipio.find(filtro).sort({ nombre: 1 });
    res.status(200).json(municipios);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener municipios', error: error.message });
  }
});
// Endpoint para listar todas las categorías
app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await Categoria.find().sort({ orden: 1 });
    res.status(200).json(categorias);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener categorías', error: error.message });
  }
});
// Endpoint para listar profesiones, opcionalmente filtradas por categoría
app.get('/api/profesiones', async (req, res) => {
  try {
    const filtro = {};
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria;
    }

    const profesiones = await Profesion.find(filtro).sort({ nombre: 1 });
    res.status(200).json(profesiones);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener profesiones', error: error.message });
  }
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

    // Si el usuario envía ?categoria=Plomeria, buscamos las profesiones que coincidan
    // y filtramos los expertos que tengan alguna de esas profesiones
    if (req.query.categoria) {
      const profesionesCoincidentes = await Profesion.find({
        nombre: new RegExp(req.query.categoria, 'i')
      });
      filtro.profesion = { $in: profesionesCoincidentes.map(p => p._id) };
    }

    // Si el usuario envía ?busqueda=algo, buscamos coincidencias en nombre O en la profesión
    if (req.query.busqueda) {
      const profesionesPorBusqueda = await Profesion.find({
        nombre: new RegExp(req.query.busqueda, 'i')
      });
      filtro.$or = [
        { nombre: new RegExp(req.query.busqueda, 'i') },
        { profesion: { $in: profesionesPorBusqueda.map(p => p._id) } }
      ];
    }

    // Si el usuario envía ?ubicacion=Medellin, buscamos el municipio y filtramos por su ID
    if (req.query.ubicacion) {
      const municipiosCoincidentes = await Municipio.find({
        nombre: new RegExp(req.query.ubicacion, 'i')
      });
      filtro.ubicaciones = { $in: municipiosCoincidentes.map(m => m._id) };
    }

    const expertos = await Experto.find(filtro)
      .populate({
        path: 'ubicaciones',
        populate: { path: 'departamento' }
      })
      .populate({
        path: 'profesion',
        populate: { path: 'categoria' }
      });

    res.status(200).json(expertos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar expertos', error: error.message });
  }
});
// Endpoint para obtener UN experto específico por su ID
app.get('/api/expertos/:id', async (req, res) => {
  try {
    const experto = await Experto.findById(req.params.id)
      .populate({
        path: 'ubicaciones',
        populate: { path: 'departamento' }
      })
      .populate({
        path: 'profesion',
        populate: { path: 'categoria' }
      });

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json(experto);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar el experto', error: error.message });
  }
});
// Endpoint para actualizar un experto existente (PROTEGIDO)
app.put('/api/expertos/:id', verificarToken, async (req, res) => {
  try {
    if (req.usuario.id !== req.params.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para editar este perfil' });
    }
    if (req.body.nombre) {
      req.body.nombre = normalizarTexto(req.body.nombre);
    }
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

// Endpoint para eliminar un experto (PROTEGIDO)
app.delete('/api/expertos/:id', verificarToken, async (req, res) => {
  try {
    if (req.usuario.id !== req.params.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para eliminar este perfil' });
    }

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
    const experto = await Experto.findById(req.params.id).populate('profesion');

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    // Limpiar el número: nos aseguramos de que solo tenga dígitos
    const numeroLimpio = experto.whatsapp.replace(/\D/g, '');

    // Agregar el código de país de Colombia si no lo tiene ya
    const numeroConPais = numeroLimpio.startsWith('57')
      ? numeroLimpio
      : `57${numeroLimpio}`;

    const mensaje = `Hola ${experto.nombre}, te contacto a través de EXPERTOS. Vi tu perfil de ${experto.profesion.nombre} y quisiera más información sobre tus servicios.`;

    const enlaceWhatsApp = `https://wa.me/${numeroConPais}?text=${encodeURIComponent(mensaje)}`;

    res.status(200).json({ enlaceWhatsApp });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el enlace de contacto', error: error.message });
  }
});
// Endpoint para activar (simular) la suscripción de un experto
app.post('/api/expertos/:id/suscripcion', async (req, res) => {
  try {
    const experto = await Experto.findById(req.params.id);

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    // Calculamos la fecha de renovación: 1 mes después de hoy
    const fechaRenovacion = new Date();
    fechaRenovacion.setMonth(fechaRenovacion.getMonth() + 1);

    const nuevaSuscripcion = new Suscripcion({
      experto: experto._id,
      fechaRenovacion: fechaRenovacion
    });

    const suscripcionGuardada = await nuevaSuscripcion.save();

    // Activamos el plan Pro del experto
    experto.plan = 'pro';
    await experto.save();

    res.status(201).json({
      mensaje: 'Suscripción activada correctamente',
      suscripcion: suscripcionGuardada,
      experto: experto
    });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al activar la suscripción', error: error.message });
  }
});

// Endpoint para subir/actualizar la foto del FRENTE del documento de identidad
app.post('/api/expertos/:id/foto-documento-frente', verificarToken, upload.single('fotoDocumentoFrente'), async (req, res) => {
  try {
    if (req.usuario.id !== req.params.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para modificar este perfil' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibió ningún archivo de imagen' });
    }

    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { fotoDocumentoFrente: req.file.path },
      { new: true }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Foto del frente del documento actualizada correctamente', experto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al subir la foto del documento', error: error.message });
  }
});

// Endpoint para subir/actualizar la foto del REVERSO del documento de identidad
app.post('/api/expertos/:id/foto-documento-reverso', verificarToken, upload.single('fotoDocumentoReverso'), async (req, res) => {
  try {
    if (req.usuario.id !== req.params.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para modificar este perfil' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibió ningún archivo de imagen' });
    }

    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { fotoDocumentoReverso: req.file.path },
      { new: true }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Foto del reverso del documento actualizada correctamente', experto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al subir la foto del documento', error: error.message });
  }
});
// Endpoint para subir/actualizar la foto de perfil de un experto
app.post('/api/expertos/:id/foto', verificarToken, upload.single('foto'), async (req, res) => {
  try {
    if (req.usuario.id !== req.params.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para modificar este perfil' });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibió ningún archivo de imagen' });
    }

    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { foto: req.file.path },
      { new: true }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Foto actualizada correctamente', experto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al subir la foto', error: error.message });
  }
});