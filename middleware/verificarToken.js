// middleware/verificarToken.js — Protege rutas que requieren autenticación

const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'Acceso denegado: token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const datosDecodificados = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = datosDecodificados; // guardamos { id, correo } para usarlo después
    next(); // deja continuar hacia el endpoint real
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
}

module.exports = verificarToken;