// middleware/verificarExpertoPro.js — Verifica que el usuario autenticado sea
// un experto, que ya haya sido aprobado, y que tenga el plan Pro activo.
// Debe usarse SIEMPRE despues de verificarToken (necesita req.usuario.id).

const Experto = require('../models/Experto');

async function verificarExpertoPro(req, res, next) {
  try {
    const experto = await Experto.findById(req.usuario.id);

    if (!experto) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    if (experto.rol !== 'experto') {
      return res.status(403).json({ mensaje: 'Acceso denegado: esta accion es solo para expertos' });
    }

    if (!experto.verificado) {
      return res.status(403).json({ mensaje: 'Tu cuenta de experto aun no ha sido aprobada por el administrador' });
    }

    if (experto.plan !== 'pro') {
      return res.status(403).json({ mensaje: 'Esta funcion es exclusiva del plan Pro' });
    }

    next();
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar el acceso', error: error.message });
  }
}

module.exports = verificarExpertoPro;