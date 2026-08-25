// routes/calificaciones.js — Calificaciones bidireccionales entre expertos y clientes

const express = require('express');
const router = express.Router();
const Calificacion = require('../models/Calificacion');
const Experto = require('../models/Experto');
const verificarToken = require('../middleware/verificarToken');

// Calcula el promedio y el total a partir de una lista de calificaciones
function calcularResumen(calificaciones) {
  const total = calificaciones.length;
  const promedio = total > 0
    ? calificaciones.reduce((suma, c) => suma + c.puntuacion, 0) / total
    : 0;
  return { promedio: Math.round(promedio * 10) / 10, total };
}

// Enviar (o actualizar) una calificacion hacia otra persona (PROTEGIDO)
router.post('/', verificarToken, async (req, res) => {
  try {
    const { receptorId, puntuacion, comentario } = req.body;
    const autorId = req.usuario.id;

    if (!receptorId || !puntuacion) {
      return res.status(400).json({ mensaje: 'receptorId y puntuacion son obligatorios' });
    }

    if (autorId === receptorId) {
      return res.status(400).json({ mensaje: 'No puedes calificarte a ti mismo' });
    }

    const [autor, receptor] = await Promise.all([
      Experto.findById(autorId),
      Experto.findById(receptorId)
    ]);

    if (!autor || !receptor) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    // Las calificaciones solo son entre un experto y un cliente (no entre 2
    // expertos, ni 2 clientes, ni con un admin de por medio)
    const rolesValidos = ['experto', 'cliente'];
    const rolesDistintos = autor.rol !== receptor.rol;
    if (!rolesValidos.includes(autor.rol) || !rolesValidos.includes(receptor.rol) || !rolesDistintos) {
      return res.status(400).json({ mensaje: 'Las calificaciones solo son validas entre un experto y un cliente' });
    }

    const calificacion = await Calificacion.findOneAndUpdate(
      { autor: autorId, receptor: receptorId },
      { puntuacion, comentario: comentario || '', fechaCreacion: new Date() },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(calificacion);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar la calificacion', error: error.message });
  }
});

// Buscar la reputacion de alguien por su numero de WhatsApp (PROTEGIDO):
// pensado para que un experto revise a un cliente antes de aceptar el
// servicio, usando el mismo numero por el que ya se contactaron.
router.get('/buscar/:numero', verificarToken, async (req, res) => {
  try {
    const persona = await Experto.findOne({ whatsapp: req.params.numero });

    if (!persona) {
      return res.status(404).json({ mensaje: 'No se encontro ninguna cuenta con ese numero de WhatsApp' });
    }

    const calificaciones = await Calificacion.find({ receptor: persona._id });
    const resumen = calcularResumen(calificaciones);

    res.status(200).json({
      nombre: persona.nombre,
      rol: persona.rol,
      promedio: resumen.promedio,
      total: resumen.total,
      comentarios: calificaciones.map(c => c.comentario).filter(c => c !== '')
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al buscar la reputacion', error: error.message });
  }
});

// Obtener las calificaciones recibidas por alguien, con su promedio (PUBLICO,
// para poder mostrarlo en el perfil publico de un experto)
router.get('/:id', async (req, res) => {
  try {
    const calificaciones = await Calificacion.find({ receptor: req.params.id })
      .populate('autor', 'nombre')
      .sort({ fechaCreacion: -1 });

    const resumen = calcularResumen(calificaciones);

    res.status(200).json({
      promedio: resumen.promedio,
      total: resumen.total,
      calificaciones
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las calificaciones', error: error.message });
  }
});

module.exports = router;