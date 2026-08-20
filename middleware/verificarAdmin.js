// middleware/verificarAdmin.js — Verifica que el usuario autenticado sea administrador

const Experto = require('../models/Experto');

async function verificarAdmin(req, res, next) {
  try {
    const experto = await Experto.findById(req.usuario.id);

    if (!experto || experto.rol !== 'admin') {
      return res.status(403).json({ mensaje: 'Acceso denegado: se requieren permisos de administrador' });
    }

    next();
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar permisos', error: error.message });
  }
}

module.exports = verificarAdmin;