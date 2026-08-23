// routes/auth.js — Registro e inicio de sesión de expertos

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Experto = require('../models/Experto');

// Convierte un texto a formato "Primera Letra Mayúscula" en cada palabra
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

// Registro de un nuevo experto (con contraseña)
router.post('/registro', async (req, res) => {
  try {
    const { contraseña, ...restoDatos } = req.body;

        if (restoDatos.nombre) {
      restoDatos.nombre = normalizarTexto(restoDatos.nombre);
    }

        if (restoDatos.correo) {
      restoDatos.correo = restoDatos.correo.trim().toLowerCase();
      if (!correoValido(restoDatos.correo)) {
        return res.status(400).json({ mensaje: 'El correo electronico no tiene un formato valido' });
      }
    }

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

        const correoNormalizado = correo ? correo.trim().toLowerCase() : correo;

    if (!correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    // Como "contraseña" tiene select:false, la pedimos explícitamente con +contraseña
        const experto = await Experto.findOne({ correo: correoNormalizado }).select('+contraseña');

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