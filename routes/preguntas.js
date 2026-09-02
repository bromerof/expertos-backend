// routes/preguntas.js — Preguntas frecuentes

const express = require('express');
const router = express.Router();
const Pregunta = require('../models/Pregunta');
const verificarToken = require('../middleware/verificarToken');
const verificarAdmin = require('../middleware/verificarAdmin');

// Listar todas las preguntas (publico, sin necesidad de sesion)
router.get('/', async (req, res) => {
  try {
    const preguntas = await Pregunta.find().sort({ seccion: 1, orden: 1, fechaCreacion: 1 });
    res.status(200).json(preguntas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener las preguntas frecuentes', error: error.message });
  }
});

// Crear una pregunta nueva (PROTEGIDO: solo admin)
router.post('/', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { seccion, pregunta, respuesta, orden } = req.body;

    if (!seccion || !seccion.trim() || !pregunta || !pregunta.trim() || !respuesta || !respuesta.trim()) {
      return res.status(400).json({ mensaje: 'Seccion, pregunta y respuesta son obligatorias' });
    }

    const nuevaPregunta = new Pregunta({
      seccion: seccion.trim(),
      pregunta: pregunta.trim(),
      respuesta: respuesta.trim(),
      orden: orden || 0
    });

    const guardada = await nuevaPregunta.save();
    res.status(201).json(guardada);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear la pregunta', error: error.message });
  }
});

// Editar una pregunta existente (PROTEGIDO: solo admin)
router.put('/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { seccion, pregunta, respuesta, orden } = req.body;
    const cambios = {};

    if (seccion) cambios.seccion = seccion.trim();
    if (pregunta) cambios.pregunta = pregunta.trim();
    if (respuesta) cambios.respuesta = respuesta.trim();
    if (orden !== undefined) cambios.orden = orden;

    const actualizada = await Pregunta.findByIdAndUpdate(req.params.id, cambios, { new: true });

    if (!actualizada) {
      return res.status(404).json({ mensaje: 'Pregunta no encontrada' });
    }

    res.status(200).json(actualizada);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar la pregunta', error: error.message });
  }
});

// Eliminar una pregunta (PROTEGIDO: solo admin)
router.delete('/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const eliminada = await Pregunta.findByIdAndDelete(req.params.id);

    if (!eliminada) {
      return res.status(404).json({ mensaje: 'Pregunta no encontrada' });
    }

    res.status(200).json({ mensaje: 'Pregunta eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar la pregunta', error: error.message });
  }
});

module.exports = router;