// utils/validaciones.js — Reglas de validacion compartidas para formularios

// Política de contraseña: mínimo 6 caracteres (sin exigir mayúsculas, números ni símbolos)
function contraseñaValida(contraseña) {
  return typeof contraseña === 'string' && contraseña.length >= 6;
}

module.exports = { contraseñaValida };