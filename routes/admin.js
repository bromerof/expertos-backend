// routes/admin.js — Endpoints exclusivos para administradores

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Experto = require('../models/Experto');
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

module.exports = router;