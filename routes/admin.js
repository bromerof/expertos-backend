// routes/admin.js — Endpoints exclusivos para administradores

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Experto = require('../models/Experto');
const Calificacion = require('../models/Calificacion');
const Necesidad = require('../models/Necesidad');
const Aporte = require('../models/Aporte');
const Busqueda = require('../models/Busqueda');
const verificarToken = require('../middleware/verificarToken');
const verificarAdmin = require('../middleware/verificarAdmin');
const { mensajeErrorDuplicado } = require('../utils/manejarErrores');
const { contraseñaValida } = require('../utils/validaciones');

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

function correoValido(correo) {
  const patron = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return patron.test(correo);
}

// Listar perfiles pendientes de aprobación
router.get('/expertos-pendientes', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const pendientes = await Experto.find({ verificado: false })
      .populate({
        path: 'profesion',
        populate: { path: 'categoria' }
      });
    res.status(200).json(pendientes);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener expertos pendientes', error: error.message });
  }
});

// Aprobar un perfil
router.put('/expertos/:id/aprobar', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { verificado: true },
      { new: true }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Perfil aprobado correctamente', experto });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al aprobar el perfil', error: error.message });
  }
});

// Suspender un perfil
router.put('/expertos/:id/suspender', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { verificado: false },
      { new: true }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Perfil suspendido correctamente', experto });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al suspender el perfil', error: error.message });
  }
});

// Crear un nuevo administrador (solo accesible por un admin ya logueado)
router.post('/crear-admin', verificarToken, verificarAdmin, async (req, res) => {
  try {
    let { nombre, correo, contraseña, tipoDocumento, numeroDocumento } = req.body;

    if (!nombre || !correo || !contraseña || !numeroDocumento) {
      return res.status(400).json({ mensaje: 'Nombre, correo, contraseña y número de documento son obligatorios' });
    }

    if (!contraseñaValida(contraseña)) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener mínimo 6 caracteres' });
    }
    nombre = normalizarTexto(nombre);
    correo = correo.trim().toLowerCase();

    if (!correoValido(correo)) {
      return res.status(400).json({ mensaje: 'El correo electrónico no tiene un formato valido' });
    }

    const contraseñaHasheada = await bcrypt.hash(contraseña, 10);

    const nuevoAdmin = new Experto({
      nombre,
      correo,
      contraseña: contraseñaHasheada,
      tipoDocumento: tipoDocumento || 'CC',
      numeroDocumento: numeroDocumento.trim(),
      rol: 'admin',
      verificado: true
    });

    const adminGuardado = await nuevoAdmin.save();

    const { contraseña: _, ...adminSinContraseña } = adminGuardado.toObject();

    res.status(201).json(adminSinContraseña);
   } catch (error) {
    const mensajeDuplicado = mensajeErrorDuplicado(error);
    res.status(400).json({
      mensaje: mensajeDuplicado || 'Error al crear el administrador',
      error: error.message
    });
  }
});

// Listar TODOS los expertos (no solo pendientes), para poder probar el plan Pro
// manualmente en cualquier cuenta mientras Wompi no esta conectado
router.get('/expertos-todos', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const expertos = await Experto.find({ rol: 'experto' })
      .sort({ nombre: 1 })
      .select('nombre correo plan verificado');
    res.status(200).json(expertos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener expertos', error: error.message });
  }
});

// Activar el plan Pro manualmente (prueba, sin pago real via Wompi todavia)
router.put('/expertos/:id/activar-pro', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { plan: 'pro' },
      { returnDocument: 'after' }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Plan Pro activado (prueba)', experto });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al activar el plan Pro', error: error.message });
  }
});

// Quitar el plan Pro manualmente (volver a gratuito)
router.put('/expertos/:id/quitar-pro', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const experto = await Experto.findByIdAndUpdate(
      req.params.id,
      { plan: 'gratuito' },
      { returnDocument: 'after' }
    );

    if (!experto) {
      return res.status(404).json({ mensaje: 'Experto no encontrado' });
    }

    res.status(200).json({ mensaje: 'Plan Pro desactivado', experto });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al quitar el plan Pro', error: error.message });
  }
});

// Estadisticas generales de la plataforma (solo admin)
router.get('/estadisticas', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const [
      totalExpertos,
      expertosAprobados,
      expertosPendientes,
      expertosPro,
      totalClientes,
      clientesAprobados,
      totalCalificaciones,
      totalNecesidades,
      necesidadesAbiertas,
      totalAportesAprobados,
      todasLasCalificaciones,
      rankingContactos,
      expertosProSinContactos,
      expertosParaOferta,
      personasParaCobertura,
      totalesVistasContactos,
      totalBusquedas,
      busquedasConResultado,
      busquedasSinResultado,
      terminosSinResultado,
      montoAportesAgregado
    ] = await Promise.all([
      Experto.countDocuments({ rol: 'experto' }),
      Experto.countDocuments({ rol: 'experto', verificado: true }),
      Experto.countDocuments({ rol: 'experto', verificado: false }),
      Experto.countDocuments({ rol: 'experto', plan: 'pro' }),
      Experto.countDocuments({ rol: 'cliente' }),
      Experto.countDocuments({ rol: 'cliente', verificado: true }),
      Calificacion.countDocuments(),
      Necesidad.countDocuments(),
      Necesidad.countDocuments({ estado: 'abierta' }),
      Aporte.countDocuments({ estado: 'aprobada' }),
      Calificacion.find().select('puntuacion'),
      Experto.find({ rol: 'experto', verificado: true })
        .sort({ contactosRecibidos: -1 })
        .limit(5)
        .select('nombre contactosRecibidos'),
      Experto.find({ rol: 'experto', plan: 'pro', verificado: true, contactosRecibidos: 0 })
        .select('nombre'),
      Experto.find({ rol: 'experto', verificado: true })
        .populate({ path: 'profesion', populate: { path: 'categoria' } }),
      Experto.find({ rol: { $in: ['experto', 'cliente'] }, verificado: true })
        .populate({ path: 'ubicaciones', populate: { path: 'departamento' } })
        .select('rol ubicaciones'),
      Experto.aggregate([
        { $match: { rol: 'experto' } },
        { $group: { _id: null, totalVistas: { $sum: '$vistasPerfil' }, totalContactos: { $sum: '$contactosRecibidos' } } }
      ]),
      Busqueda.countDocuments(),
      Busqueda.countDocuments({ resultados: { $gt: 0 } }),
      Busqueda.countDocuments({ resultados: 0 }),
      Busqueda.aggregate([
        { $match: { resultados: 0, termino: { $ne: '' } } },
        { $group: { _id: { $toLower: '$termino' }, veces: { $sum: 1 } } },
        { $sort: { veces: -1 } },
        { $limit: 5 }
      ]),
      Aporte.aggregate([
        { $match: { estado: 'aprobada' } },
        { $group: { _id: null, totalCentavos: { $sum: '$montoEnCentavos' } } }
      ])
    ]);

    // Calificacion promedio general y distribucion de estrellas (1 a 5)
    const distribucionEstrellas = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sumaPuntuaciones = 0;
    todasLasCalificaciones.forEach((c) => {
      distribucionEstrellas[c.puntuacion] = (distribucionEstrellas[c.puntuacion] || 0) + 1;
      sumaPuntuaciones += c.puntuacion;
    });
    const calificacionPromedioGeneral = todasLasCalificaciones.length > 0
      ? Math.round((sumaPuntuaciones / todasLasCalificaciones.length) * 10) / 10
      : 0;

    // Oferta por categoria: cuantos expertos aprobados hay en cada una
    const ofertaPorCategoria = {};
    expertosParaOferta.forEach((e) => {
      const nombreCategoria = e.profesion && e.profesion.categoria ? e.profesion.categoria.nombre : 'Sin categoria';
      ofertaPorCategoria[nombreCategoria] = (ofertaPorCategoria[nombreCategoria] || 0) + 1;
    });
    const ofertaPorCategoriaLista = Object.entries(ofertaPorCategoria)
      .map(([categoria, cantidad]) => ({ categoria, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // Expertos y clientes por departamento (una persona con varias ciudades
    // cuenta en cada departamento donde tenga ubicacion)
    const coberturaPorDepartamento = {};
    personasParaCobertura.forEach((p) => {
      (p.ubicaciones || []).forEach((u) => {
        const nombreDepto = u.departamento ? u.departamento.nombre : 'Sin departamento';
        if (!coberturaPorDepartamento[nombreDepto]) {
          coberturaPorDepartamento[nombreDepto] = { departamento: nombreDepto, expertos: 0, clientes: 0 };
        }
        if (p.rol === 'experto') {
          coberturaPorDepartamento[nombreDepto].expertos += 1;
        } else {
          coberturaPorDepartamento[nombreDepto].clientes += 1;
        }
      });
    });
    const coberturaPorDepartamentoLista = Object.values(coberturaPorDepartamento)
      .sort((a, b) => (b.expertos + b.clientes) - (a.expertos + a.clientes));

    // Tasa de busqueda exitosa: de las busquedas registradas, cuantas
    // encontraron al menos un resultado
    const tasaBusquedaExitosa = totalBusquedas > 0
      ? Math.round((busquedasConResultado / totalBusquedas) * 1000) / 10
      : 0;

    // Terminos que los clientes buscaron y NO encontraron ningun resultado
    const terminosSinResultadoLista = terminosSinResultado.map((t) => ({
      termino: t._id,
      veces: t.veces
    }));

    // Embudo aproximado: usamos la calificacion dejada como señal de que el
    // servicio realmente se realizo (no tenemos otra forma de saberlo hoy)
    const embudo = {
      busquedas: totalBusquedas,
      vistasPerfil: totalesVistasContactos[0] ? totalesVistasContactos[0].totalVistas : 0,
      contactos: totalesVistasContactos[0] ? totalesVistasContactos[0].totalContactos : 0,
      calificaciones: totalCalificaciones
    };

    // Ingresos: separamos lo real (aportes ya cobrados de verdad) de una
    // proyeccion simulada de Pro (Wompi todavia no procesa cobros reales)
    const PRECIO_PRO_SIMULADO_COP = 4900;
    const ingresos = {
      aportesRecaudadosCOP: montoAportesAgregado[0] ? montoAportesAgregado[0].totalCentavos / 100 : 0,
      proSimuladoMensualCOP: expertosPro * PRECIO_PRO_SIMULADO_COP,
      proEsSimulado: true
    };

    res.status(200).json({
      totalExpertos,
      expertosAprobados,
      expertosPendientes,
      expertosPro,
      totalClientes,
      clientesAprobados,
      totalCalificaciones,
      totalNecesidades,
      necesidadesAbiertas,
      totalAportesAprobados,
      calificacionPromedioGeneral,
      distribucionEstrellas,
      rankingContactos,
      expertosProSinContactos: {
        total: expertosProSinContactos.length,
        nombres: expertosProSinContactos.map((e) => e.nombre)
      },
      ofertaPorCategoria: ofertaPorCategoriaLista,
      coberturaPorDepartamento: coberturaPorDepartamentoLista,
      totalVistas: totalesVistasContactos[0] ? totalesVistasContactos[0].totalVistas : 0,
      totalContactos: totalesVistasContactos[0] ? totalesVistasContactos[0].totalContactos : 0,
      totalBusquedas,
      busquedasConResultado,
      busquedasSinResultado,
      tasaBusquedaExitosa,
      terminosSinResultado: terminosSinResultadoLista,
      embudo,
      ingresos
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las estadisticas', error: error.message });
  }
});

module.exports = router;