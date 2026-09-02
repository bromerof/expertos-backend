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
// Quita tildes/diacriticos y pasa a minusculas. Se usa SOLO para comparar
// texto en busquedas (nunca para guardar datos), asi "fotografo" tambien
// encuentra "Fotógrafo" sin importar si el usuario escribio la tilde o no.
function quitarTildes(texto) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Experto = require('./models/Experto');
const Busqueda = require('./models/Busqueda');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const Suscripcion = require('./models/Suscripcion');
const authRoutes = require('./routes/auth');
const verificarToken = require('./middleware/verificarToken');
const verificarClienteAprobado = require('./middleware/verificarClienteAprobado');
const verificarAdmin = require('./middleware/verificarAdmin');
const adminRoutes = require('./routes/admin');
const calificacionesRoutes = require('./routes/calificaciones');
const necesidadesRoutes = require('./routes/necesidades');
const pagosRoutes = require('./routes/pagos');
const blogRoutes = require('./routes/blog');
const multer = require('multer');
const { storage } = require('./config/cloudinary');
const upload = multer({ storage });
const Departamento = require('./models/Departamento');
const Municipio = require('./models/Municipio');
const Categoria = require('./models/Categoria');
const Profesion = require('./models/Profesion');
const { mensajeErrorDuplicado } = require('./utils/manejarErrores');
const { correoValido } = require('./utils/validaciones');

// Middleware: permite que el servidor entienda JSON en las peticiones
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calificaciones', calificacionesRoutes);
app.use('/api/necesidades', necesidadesRoutes);
app.use('/api/pagos', pagosRoutes);
app.use('/api/blog', blogRoutes);

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

    const profesiones = await Profesion.find(filtro).sort({ nombre: 1 }).populate('categoria');
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
// Endpoint para listar y buscar expertos (PROTEGIDO: solo clientes aprobados)
app.get('/api/expertos', verificarToken, verificarClienteAprobado, async (req, res) => {
  try {
    // Solo deben aparecer EXPERTOS aprobados (nunca clientes ni admins)
    const filtro = { verificado: true, rol: 'experto' };

    // Vamos acumulando aqui cada condicion "O" por separado (categoria,
    // busqueda de texto, ubicacion), para poder combinarlas todas juntas con
    // $and al final sin que una sobrescriba a la otra
    const condicionesAnd = [];

    // Busqueda por categoria/profesion (parametro categoria), sin tildes.
    // Revisa tanto la profesion principal como las profesiones adicionales (Pro).
    if (req.query.categoria) {
      const termino = quitarTildes(req.query.categoria);
      const todasLasProfesiones = await Profesion.find();
      const idsCoincidentes = todasLasProfesiones
        .filter(p => quitarTildes(p.nombre).includes(termino))
        .map(p => p._id);
      condicionesAnd.push({
        $or: [
          { profesion: { $in: idsCoincidentes } },
          { profesionesAdicionales: { $in: idsCoincidentes } }
        ]
      });
    }

    // Busqueda libre por nombre del experto O por su profesion (parametro busqueda), sin tildes
    if (req.query.busqueda) {
      const termino = quitarTildes(req.query.busqueda);

      const todasLasProfesiones = await Profesion.find();
      const profesionesPorBusqueda = todasLasProfesiones.filter(p =>
        quitarTildes(p.nombre).includes(termino)
      );

      // Para el nombre del experto y sus textos de "Otra" tambien comparamos
      // sin tildes: traemos los candidatos ya filtrados por rol/verificado y
      // comparamos en memoria
      const candidatos = await Experto.find(filtro).select('_id nombre otraCategoriaTexto otraProfesionTexto');
      const idsPorNombre = candidatos
        .filter(c =>
          quitarTildes(c.nombre).includes(termino) ||
          quitarTildes(c.otraCategoriaTexto).includes(termino) ||
          quitarTildes(c.otraProfesionTexto).includes(termino)
        )
        .map(c => c._id);

      condicionesAnd.push({
        $or: [
          { _id: { $in: idsPorNombre } },
          { profesion: { $in: profesionesPorBusqueda.map(p => p._id) } },
          { profesionesAdicionales: { $in: profesionesPorBusqueda.map(p => p._id) } }
        ]
      });
    }

    // Filtro por ciudad especifica (parametro ubicacion), sin tildes.
    // Ademas de coincidir por ciudad fisica, tambien incluimos a expertos con
    // cobertura virtual nacional, sin importar en que ciudad esten ubicados.
    if (req.query.ubicacion) {
      const termino = quitarTildes(req.query.ubicacion);
      const todosLosMunicipios = await Municipio.find();
      const municipiosCoincidentes = todosLosMunicipios.filter(m =>
        quitarTildes(m.nombre).includes(termino)
      );
      condicionesAnd.push({
        $or: [
          { ubicaciones: { $in: municipiosCoincidentes.map(m => m._id) } },
          { coberturaVirtualNacional: true }
        ]
      });
    } else if (req.query.departamento) {
      // Filtro por Departamento completo, sin elegir una ciudad especifica:
      // buscamos todos los municipios que pertenecen a ese departamento,
      // y de igual forma incluimos a los expertos con cobertura nacional.
      const municipiosDelDepartamento = await Municipio.find({ departamento: req.query.departamento });
      condicionesAnd.push({
        $or: [
          { ubicaciones: { $in: municipiosDelDepartamento.map(m => m._id) } },
          { coberturaVirtualNacional: true }
        ]
      });
    }

    if (condicionesAnd.length > 0) {
      filtro.$and = condicionesAnd;
    }

    const expertos = await Experto.find(filtro)
      .populate({
        path: 'ubicaciones',
        populate: { path: 'departamento' }
      })
      .populate({
        path: 'profesion',
        populate: { path: 'categoria' }
      })
      .populate({
        path: 'profesionesAdicionales',
        populate: { path: 'categoria' }
      });

    // Los expertos con plan Pro aparecen primero. El orden entre expertos
    // del mismo plan se mantiene igual (sort es estable en Node).
    expertos.sort((a, b) => (b.plan === 'pro') - (a.plan === 'pro'));

    // Registramos una aparicion en busqueda para cada experto mostrado
    // (estadistica exclusiva del plan Pro, no bloquea la respuesta)
    if (expertos.length > 0) {
      Experto.updateMany(
        { _id: { $in: expertos.map(e => e._id) } },
        { $inc: { aparicionesBusqueda: 1 } }
      ).catch(err => console.error('Error al registrar apariciones en busqueda:', err));
    }

    // Registramos el evento de busqueda solo cuando el cliente realmente uso
    // un filtro (texto, categoria o ubicacion) — no cuando solo carga la lista
    // completa sin buscar nada especifico.
    const terminoBusqueda = req.query.busqueda || req.query.categoria || '';
    const ubicacionBusqueda = req.query.ubicacion || (req.query.departamento ? 'Departamento seleccionado' : '');
    if (terminoBusqueda || ubicacionBusqueda) {
      new Busqueda({
        cliente: req.usuario.id,
        termino: terminoBusqueda,
        ubicacion: ubicacionBusqueda,
        resultados: expertos.length
      }).save().catch(err => console.error('Error al registrar la busqueda:', err));
    }

    res.status(200).json(expertos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar expertos', error: error.message });
  }
});
// Endpoint para obtener UN experto o cliente especifico por su ID (PROTEGIDO)
// Caso 1: ver tu propio perfil -> siempre permitido
// Caso 2: ver el perfil de un EXPERTO -> exige ser cliente aprobado, y que ese experto este aprobado
// Caso 3: ver el perfil de un CLIENTE -> exige ser experto aprobado (ej. pantalla de Calificar)
app.get('/api/expertos/:id', verificarToken, async (req, res) => {
  try {
    const esPerfilPropio = req.usuario.id === req.params.id;

    const experto = await Experto.findById(req.params.id)
      .populate({
        path: 'ubicaciones',
        populate: { path: 'departamento' }
      })
      .populate({
        path: 'profesion',
        populate: { path: 'categoria' }
      })
      .populate({
        path: 'profesionesAdicionales',
        populate: { path: 'categoria' }
      });

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    if (!esPerfilPropio) {
      const solicitante = await Experto.findById(req.usuario.id);

      if (!solicitante) {
        return res.status(401).json({ mensaje: 'Usuario no encontrado' });
      }

      if (experto.rol === 'experto') {
        if (solicitante.rol !== 'cliente' || !solicitante.verificado) {
          return res.status(403).json({ mensaje: 'Acceso denegado: esta accion es solo para clientes aprobados' });
        }
        if (!experto.verificado) {
          return res.status(404).json({ mensaje: 'Experto no encontrado' });
        }
        // Registramos la vista (estadistica), sin bloquear la respuesta
        Experto.findByIdAndUpdate(experto._id, { $inc: { vistasPerfil: 1 } })
          .catch(err => console.error('Error al registrar vista de perfil:', err));
      } else if (experto.rol === 'cliente') {
        if (solicitante.rol !== 'experto' || !solicitante.verificado) {
          return res.status(403).json({ mensaje: 'Acceso denegado: esta accion es solo para expertos aprobados' });
        }
      } else {
        // admin u otro caso: no hay ningun flujo legitimo para consultarlo asi
        return res.status(403).json({ mensaje: 'Acceso denegado' });
      }
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

    // El numero de documento no se puede cambiar despues del registro:
    // ya fue revisado por un admin al aprobar el perfil, y permitir cambiarlo
    // libremente anularia esa verificacion. Se ignora aunque llegue en la peticion.
    delete req.body.numeroDocumento;

    // profesionesAdicionales solo aplica para cuentas con plan Pro. Si llega
    // en la peticion pero la cuenta no es Pro, la ignoramos silenciosamente
    // (no rompe el guardado, solo no aplica el cambio).
    if (req.body.profesionesAdicionales) {
      const expertoParaPlan = await Experto.findById(req.params.id).select('plan');
      if (!expertoParaPlan || expertoParaPlan.plan !== 'pro') {
        delete req.body.profesionesAdicionales;
      }
    }

    // Si esta cambiando (o confirmando) su categoria/profesion y alguna es
    // "Otra", exigimos que describa cada una por separado, igual que en el registro.
    // Revisamos tanto la profesion principal como las profesiones adicionales (Pro).
    if (req.body.profesion) {
      const idsARevisar = [req.body.profesion, ...(req.body.profesionesAdicionales || [])];
      const profesionesElegidas = await Profesion.find({ _id: { $in: idsARevisar } }).populate('categoria');

      const categoriaEsOtra = profesionesElegidas.some(p =>
        p.categoria && p.categoria.nombre.trim().toLowerCase() === 'otra'
      );
      const profesionEsOtra = profesionesElegidas.some(p =>
        p.nombre.trim().toLowerCase() === 'otra'
      );

      if (categoriaEsOtra && (!req.body.otraCategoriaTexto || !req.body.otraCategoriaTexto.trim())) {
        return res.status(400).json({ mensaje: 'Debes indicar cual es tu categoria especifica' });
      }
      if (profesionEsOtra && (!req.body.otraProfesionTexto || !req.body.otraProfesionTexto.trim())) {
        return res.status(400).json({ mensaje: 'Debes indicar cual es tu profesion especifica' });
      }
    }

    if (req.body.correo) {
      req.body.correo = req.body.correo.trim().toLowerCase();
      if (!correoValido(req.body.correo)) {
        return res.status(400).json({ mensaje: 'El correo electronico no tiene un formato valido' });
      }

      // Si el correo realmente cambio respecto al que ya tenia guardado,
      // el perfil vuelve a quedar pendiente de aprobacion por el admin.
      const expertoActual = await Experto.findById(req.params.id);
      if (expertoActual && expertoActual.correo !== req.body.correo) {
        req.body.verificado = false;
      }
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
    const mensajeDuplicado = mensajeErrorDuplicado(error);
    res.status(400).json({
      mensaje: mensajeDuplicado || 'Error al actualizar el experto',
      error: error.message
    });
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
// Endpoint para generar el enlace de contacto por WhatsApp (PROTEGIDO)
// Solo un cliente aprobado puede contactar, y solo puede contactar a un EXPERTO aprobado
// (nunca a otro cliente, ni a si mismo)
app.get('/api/expertos/:id/contacto', verificarToken, async (req, res) => {
  try {
    if (req.usuario.id === req.params.id) {
      return res.status(400).json({ mensaje: 'No puedes contactarte a ti mismo' });
    }

    const solicitante = await Experto.findById(req.usuario.id);
    if (!solicitante || solicitante.rol !== 'cliente' || !solicitante.verificado) {
      return res.status(403).json({ mensaje: 'Esta accion es solo para clientes aprobados' });
    }

    const experto = await Experto.findById(req.params.id).populate('profesion');

    if (!experto || experto.rol !== 'experto' || !experto.verificado) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    // Registramos el contacto recibido (estadistica), sin bloquear la respuesta
    Experto.findByIdAndUpdate(experto._id, { $inc: { contactosRecibidos: 1 } })
      .catch(err => console.error('Error al registrar contacto recibido:', err));

    // Limpiar el número: nos aseguramos de que solo tenga dígitos
    const numeroLimpio = experto.whatsapp.replace(/\D/g, '');

    // Agregar el código de país de Colombia si no lo tiene ya
    const numeroConPais = numeroLimpio.startsWith('57')
      ? numeroLimpio
      : `57${numeroLimpio}`;

    // Si la profesion es "Otra", usamos la especialidad especifica que el
    // experto describio; si no, usamos el nombre normal de la profesion.
    const esOtra = experto.profesion.nombre.trim().toLowerCase() === 'otra';
    const nombreServicio = esOtra && experto.otraProfesionTexto
      ? experto.otraProfesionTexto
      : experto.profesion.nombre;

    let mensaje = `Hola ${experto.nombre}, te contacto a través de EXPERTOS. Vi tu perfil de ${nombreServicio} y quisiera más información sobre tus servicios. Recuerda que puedes verificar mi información como cliente en la plataforma EXPERTOS.`;

    // FRONTEND_URL: variable de entorno nueva.
    // En local usa el valor por defecto (localhost:5173); en produccion debe
    // apuntar a https://www.expertosymas.com
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const enlaceCalificar = `${frontendUrl}/calificar/${req.usuario.id}`;
    mensaje += ` (Cuando terminemos, puedes calificarme aqui: ${enlaceCalificar})`;

    const enlaceWhatsApp = `https://wa.me/${numeroConPais}?text=${encodeURIComponent(mensaje)}`;

    res.status(200).json({ enlaceWhatsApp });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el enlace de contacto', error: error.message });
  }
});
// Endpoint para activar (simular) la suscripción de un experto (PROTEGIDO: solo admin)
app.post('/api/expertos/:id/suscripcion', verificarToken, verificarAdmin, async (req, res) => {
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