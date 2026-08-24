// routes/admin.js — Endpoints exclusivos para administradores

const express = require('express');
const router = express.Router();
const Experto = require('../models/Experto');
const verificarToken = require('../middleware/verificarToken');
const verificarAdmin = require('../middleware/verificarAdmin');

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

module.exports = router;