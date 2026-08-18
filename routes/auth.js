// routes/auth.js — Registro e inicio de sesión de expertos

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Experto = require('../models/Experto');

// Registro de un nuevo experto (con contraseña)
router.post('/registro', async (req, res) => {
  try {
    const { contraseña, ...restoDatos } = req.body;

    if (!contraseña) {
      return res.status(400).json({ mensaje: 'La contraseña es obligatoria' });
    }

    const contraseñaHasheada = await bcrypt.hash(contraseña, 10);

    const nuevoExperto = new Experto({
      ...restoDatos,
      contraseña: contraseñaHasheada
    });

    const expertoGuardado = await nuevoExperto.save();

    // No devolvemos la contraseña, ni siquiera el hash, en la respuesta
    const { contraseña: _, ...expertoSinContraseña } = expertoGuardado.toObject();

    res.status(201).json(expertoSinContraseña);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al registrar el experto', error: error.message });
  }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
  try {
    const { correo, contraseña } = req.body;

    if (!correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    // Como "contraseña" tiene select:false, la pedimos explícitamente con +contraseña
    const experto = await Experto.findOne({ correo }).select('+contraseña');

    if (!experto) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const coincide = await bcrypt.compare(contraseña, experto.contraseña);

    if (!coincide) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: experto._id, correo: experto.correo },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      experto: { id: experto._id, nombre: experto.nombre, correo: experto.correo }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
});

module.exports = router;