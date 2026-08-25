// utils/validaciones.js — Reglas de validacion compartidas para formularios

// Politica de contraseña: minimo 6 caracteres (sin exigir mayusculas, numeros ni simbolos)
function contraseñaValida(contraseña) {
  return typeof contraseña === 'string' && contraseña.length >= 6;
}

// Formato de correo: exige algo@algo.dominio con cualquier terminacion de 2+ letras
function correoValido(correo) {
  const patron = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  return patron.test(correo);
}

module.exports = { contraseñaValida, correoValido };