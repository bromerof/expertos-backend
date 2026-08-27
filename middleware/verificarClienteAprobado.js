// middleware/verificarClienteAprobado.js — Verifica que el usuario autenticado
// sea un cliente Y que ya haya sido aprobado (verificado) por el administrador.
// Debe usarse SIEMPRE después de verificarToken (necesita req.usuario.id).

const Experto = require('../models/Experto');

async function verificarClienteAprobado(req, res, next) {
  try {
    const experto = await Experto.findById(req.usuario.id);

    if (!experto) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }

    if (experto.rol !== 'cliente') {
      return res.status(403).json({ mensaje: 'Acceso denegado: esta accion es solo para clientes' });
    }

    if (!experto.verificado) {
      return res.status(403).json({ mensaje: 'Tu cuenta de cliente aun no ha sido aprobada por el administrador' });
    }

    next();
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar el acceso', error: error.message });
  }
}

module.exports = verificarClienteAprobado;