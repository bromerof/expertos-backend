// routes/auth.js — Registro e inicio de sesión de expertos y clientes

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Experto = require('../models/Experto');
const Profesion = require('../models/Profesion');
const { mensajeErrorDuplicado } = require('../utils/manejarErrores');
const { contraseñaValida, correoValido } = require('../utils/validaciones');

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

// Registro de un nuevo experto o cliente (con contraseña)
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
          if (restoDatos.numeroDocumento) {
      restoDatos.numeroDocumento = restoDatos.numeroDocumento.trim();
    }
    }

    if (!contraseña) {
      return res.status(400).json({ mensaje: 'La contraseña es obligatoria' });
    }

    if (!contraseñaValida(contraseña)) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener minimo 6 caracteres' });
    }

    // Medida de seguridad: este endpoint es publico (sin necesidad de iniciar sesion),
    // asi que NUNCA debe permitir crear una cuenta con rol "admin" mandando ese valor
    // en el cuerpo de la peticion. Solo se acepta "experto" (valor por defecto) o
    // "cliente"; cualquier otro valor recibido se ignora silenciosamente.
    restoDatos.rol = restoDatos.rol === 'cliente' ? 'cliente' : 'experto';

    // Validacion obligatoria de aceptacion legal (no basta con la validacion
    // del frontend, porque este endpoint podria llamarse directamente)
    if (!restoDatos.terminosAceptados || !restoDatos.datosAceptados) {
      return res.status(400).json({ mensaje: 'Debes aceptar los Terminos de Uso y la Politica de Tratamiento de Datos Personales' });
    }
    if (restoDatos.rol === 'experto' && !restoDatos.reglasAceptadas) {
      return res.status(400).json({ mensaje: 'Debes aceptar las Reglas para Expertos' });
    }

    // Guardamos la fecha exacta de cada aceptacion, como prueba de consentimiento
    const ahora = new Date();
    restoDatos.terminosFecha = ahora;
    restoDatos.datosFecha = ahora;
    if (restoDatos.reglasAceptadas) {
      restoDatos.reglasFecha = ahora;
    }
    if (restoDatos.comunicacionesAceptadas) {
      restoDatos.comunicacionesFecha = ahora;
    }

    // Si eligio categoria "Otra" y/o profesion "Otra", exigimos que describa
    // cada una por separado; si no, el cliente nunca podria encontrarlo
    // buscando lo que realmente hace.
    if (restoDatos.rol === 'experto' && restoDatos.profesion) {
      const profesionElegida = await Profesion.findById(restoDatos.profesion).populate('categoria');
      if (profesionElegida) {
        const categoriaEsOtra = profesionElegida.categoria &&
          profesionElegida.categoria.nombre.trim().toLowerCase() === 'otra';
        const profesionEsOtra = profesionElegida.nombre.trim().toLowerCase() === 'otra';

        if (categoriaEsOtra && (!restoDatos.otraCategoriaTexto || !restoDatos.otraCategoriaTexto.trim())) {
          return res.status(400).json({ mensaje: 'Debes indicar cual es tu categoria especifica' });
        }
        if (profesionEsOtra && (!restoDatos.otraProfesionTexto || !restoDatos.otraProfesionTexto.trim())) {
          return res.status(400).json({ mensaje: 'Debes indicar cual es tu profesion especifica' });
        }
      }
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
    const mensajeDuplicado = mensajeErrorDuplicado(error);
    res.status(400).json({
      mensaje: mensajeDuplicado || 'Error al registrar el experto',
      error: error.message
    });
  }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
  try {
    const { correo, contraseña, rol } = req.body;

        const correoNormalizado = correo ? correo.trim().toLowerCase() : correo;

    if (!correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    // Como ahora una misma persona puede tener 2 cuentas con el mismo correo
    // (una de experto y una de cliente), si especifica el rol filtramos por
    // ese rol para saber exactamente a cual cuenta quiere entrar. Si no lo
    // especifica, buscamos cualquier cuenta con ese correo (funciona igual
    // que antes para quien solo tiene una sola cuenta).
    const filtro = { correo: correoNormalizado };
    if (rol) {
      filtro.rol = rol;
    }

    // Como "contraseña" tiene select:false, la pedimos explícitamente con +contraseña
        const experto = await Experto.findOne(filtro).select('+contraseña');

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
      experto: { id: experto._id, nombre: experto.nombre, correo: experto.correo, rol: experto.rol }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
});

module.exports = router;