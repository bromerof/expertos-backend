// utils/manejarErrores.js — Traduce errores tecnicos de MongoDB a mensajes claros para el usuario

// Nombres legibles para cada campo que puede tener la restriccion "unique"
const nombresDeCampos = {
  correo: 'El correo electronico',
  whatsapp: 'El numero de WhatsApp',
  numeroDocumento: 'El numero de documento'
};

// Recibe el error capturado en un catch y devuelve un mensaje amigable,
// o null si no es un error de dato duplicado (para que el codigo que llama
// decida que mensaje generico usar en esos otros casos)
function mensajeErrorDuplicado(error) {
  if (error.code === 11000) {
    const campo = Object.keys(error.keyPattern)[0];
    const nombreCampo = nombresDeCampos[campo] || 'Este dato';
    return nombreCampo + ' ya esta registrado en la plataforma.';
  }
  return null;
}

module.exports = { mensajeErrorDuplicado };