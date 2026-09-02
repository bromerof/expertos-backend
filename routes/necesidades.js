// routes/necesidades.js — Necesidades/ofertas de trabajo publicadas por clientes

const express = require('express');
const router = express.Router();
const Necesidad = require('../models/Necesidad');
const Experto = require('../models/Experto');
const verificarToken = require('../middleware/verificarToken');
const verificarClienteAprobado = require('../middleware/verificarClienteAprobado');
const verificarExpertoPro = require('../middleware/verificarExpertoPro');
const verificarAdmin = require('../middleware/verificarAdmin');

// Publicar una nueva necesidad (PROTEGIDO: solo clientes aprobados)
router.post('/', verificarToken, verificarClienteAprobado, async (req, res) => {
  try {
    const { titulo, descripcion, profesion, municipio, modalidad } = req.body;

    if (!titulo || !titulo.trim() || !descripcion || !descripcion.trim()) {
      return res.status(400).json({ mensaje: 'El titulo y la descripcion son obligatorios' });
    }

    const nuevaNecesidad = new Necesidad({
      cliente: req.usuario.id,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      profesion: profesion || undefined,
      municipio: municipio || undefined,
      modalidad: modalidad || 'cualquiera'
    });

    const guardada = await nuevaNecesidad.save();
    res.status(201).json(guardada);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al publicar la necesidad', error: error.message });
  }
});

// Listar las necesidades abiertas (PROTEGIDO: solo expertos Pro aprobados)
router.get('/', verificarToken, verificarExpertoPro, async (req, res) => {
  try {
    const filtro = { estado: 'abierta' };

    if (req.query.profesion) {
      filtro.profesion = req.query.profesion;
    }

    const necesidades = await Necesidad.find(filtro)
      .populate('cliente', 'nombre whatsapp')
      .populate({ path: 'profesion', populate: { path: 'categoria' } })
      .populate('municipio')
      .sort({ fechaCreacion: -1 });

    res.status(200).json(necesidades);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las necesidades', error: error.message });
  }
});

// Ver mis propias necesidades publicadas (PROTEGIDO: el cliente que las creo)
router.get('/mias', verificarToken, async (req, res) => {
  try {
    const necesidades = await Necesidad.find({ cliente: req.usuario.id })
      .populate({ path: 'profesion', populate: { path: 'categoria' } })
      .populate('municipio')
      .sort({ fechaCreacion: -1 });

    res.status(200).json(necesidades);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener tus necesidades', error: error.message });
  }
});

// Ver TODAS las ofertas publicadas, abiertas y cerradas (PROTEGIDO: solo admin)
router.get('/admin/todas', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const necesidades = await Necesidad.find()
      .populate('cliente', 'nombre correo whatsapp')
      .populate({ path: 'profesion', populate: { path: 'categoria' } })
      .populate('municipio')
      .sort({ fechaCreacion: -1 });

    res.status(200).json(necesidades);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las ofertas', error: error.message });
  }
});

// Cerrar una necesidad (PROTEGIDO: solo el cliente dueño)
router.put('/:id/cerrar', verificarToken, async (req, res) => {
  try {
    const necesidad = await Necesidad.findById(req.params.id);

    if (!necesidad) {
      return res.status(404).json({ mensaje: 'Necesidad no encontrada' });
    }

    if (necesidad.cliente.toString() !== req.usuario.id) {
      return res.status(403).json({ mensaje: 'No tienes permiso para cerrar esta necesidad' });
    }

    necesidad.estado = 'cerrada';
    await necesidad.save();

    res.status(200).json({ mensaje: 'Necesidad cerrada correctamente', necesidad });
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al cerrar la necesidad', error: error.message });
  }
});

// Eliminar una necesidad (PROTEGIDO: el cliente dueño, o el admin para moderacion)
router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const necesidad = await Necesidad.findById(req.params.id);

    if (!necesidad) {
      return res.status(404).json({ mensaje: 'Necesidad no encontrada' });
    }

    const esDueño = necesidad.cliente.toString() === req.usuario.id;

    if (!esDueño) {
      const solicitante = await Experto.findById(req.usuario.id);
      if (!solicitante || solicitante.rol !== 'admin') {
        return res.status(403).json({ mensaje: 'No tienes permiso para eliminar esta necesidad' });
      }
    }

    await Necesidad.findByIdAndDelete(req.params.id);

    res.status(200).json({ mensaje: 'Necesidad eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar la necesidad', error: error.message });
  }
});

module.exports = router;