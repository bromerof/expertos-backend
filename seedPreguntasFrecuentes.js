// seedPreguntasFrecuentes.js — Corre este script UNA SOLA VEZ para migrar las
// preguntas frecuentes que ya existian escritas en el codigo hacia la base de
// datos, ahora que el admin las gestiona desde el panel.
//
// Como correrlo: node seedPreguntasFrecuentes.js
// (desde la carpeta backend, con el archivo .env ya configurado)

require('dotenv').config();
const mongoose = require('mongoose');
const Pregunta = require('./models/Pregunta');

const preguntas = [
  // General
  { seccion: 'General', orden: 1, pregunta: '¿Qué es EXPERTOS?', respuesta: 'EXPERTOS es una plataforma que conecta a personas o empresas que necesitan un servicio con profesionales independientes que lo ofrecen. Tú buscas, contactas por WhatsApp, y acuerdas el servicio directamente con el experto.' },
  { seccion: 'General', orden: 2, pregunta: '¿Es gratis usar la plataforma?', respuesta: 'Sí, tanto buscar expertos (como cliente) como crear un perfil profesional (como experto) es gratuito. Los expertos tienen además la opción de un plan Pro con beneficios adicionales.' },
  { seccion: 'General', orden: 3, pregunta: '¿Cómo protegen mis datos personales?', respuesta: 'Seguimos la Ley 1581 de 2012 (Hábeas Data). Puedes ver el detalle completo en nuestra Política de Tratamiento de Datos Personales.' },
  { seccion: 'General', orden: 4, pregunta: '¿Puedo eliminar mi cuenta?', respuesta: 'Sí, desde tu panel puedes eliminar tu perfil en cualquier momento con el botón "Eliminar perfil".' },

  // Para clientes
  { seccion: 'Para clientes', orden: 1, pregunta: '¿Cómo busco un experto?', respuesta: 'Inicia sesión como cliente y ve a "Buscar expertos". Puedes filtrar por nombre, categoría, departamento o ciudad.' },
  { seccion: 'Para clientes', orden: 2, pregunta: '¿Cómo contacto a un experto?', respuesta: 'Desde su perfil o su tarjeta de resultados, presiona "Contactar por WhatsApp". Se abrirá una conversación directa con él, ya con un mensaje inicial listo para enviar.' },
  { seccion: 'Para clientes', orden: 3, pregunta: '¿Por qué mi cuenta está pendiente de aprobación?', respuesta: 'Un administrador revisa cada cuenta nueva antes de activarla, para mantener la plataforma segura. Esto normalmente toma poco tiempo; vuelve a revisar tu panel más tarde para verificar tu acceso.' },
  { seccion: 'Para clientes', orden: 4, pregunta: '¿Qué pasa si tengo un problema con el servicio contratado?', respuesta: 'EXPERTOS conecta a clientes y expertos, pero el servicio se acuerda y se presta directamente entre ambas partes. Te recomendamos dejar claras las condiciones antes de empezar, y puedes calificar tu experiencia al finalizar.' },
  { seccion: 'Para clientes', orden: 5, pregunta: '¿Puedo confiar en las calificaciones que veo?', respuesta: 'Las calificaciones las dejan clientes que efectivamente contactaron al experto a través de la plataforma. Aun así, te recomendamos usarlas como una referencia más, no como garantía absoluta.' },

  // Para expertos
  { seccion: 'Para expertos', orden: 1, pregunta: '¿Cómo me registro como experto?', respuesta: 'Entra a "Soy Experto", elige tu plan, y completa tu perfil con tu categoría, profesión, experiencia, ubicación y tus fotos (perfil y documento).' },
  { seccion: 'Para expertos', orden: 2, pregunta: '¿Qué necesito para ser aprobado?', respuesta: 'Debes subir tu foto de perfil y las fotos (frente y reverso) de tu documento de identidad, que ahora se piden directamente en el formulario de registro. Un administrador revisa esta información antes de aprobarte.' },
  { seccion: 'Para expertos', orden: 3, pregunta: '¿Cuánto tarda la aprobación?', respuesta: 'Normalmente toma entre 20 y 30 minutos. Te recomendamos volver a revisar tu panel pasado ese tiempo para verificar tu acceso completo.' },
  { seccion: 'Para expertos', orden: 4, pregunta: '¿No encuentro mi profesión en la lista, qué hago?', respuesta: 'Busca la opción "Otra" en el buscador de profesión, y describe específicamente a qué te dedicas en el campo que aparece. Esto ayuda a que los clientes te encuentren igual.' },
  { seccion: 'Para expertos', orden: 5, pregunta: '¿Qué es el plan Pro y en qué se diferencia del Free?', respuesta: 'Con el plan Pro tu perfil aparece primero en los resultados de búsqueda, se muestra un sello "Pro" en tu perfil y tarjeta, puedes publicar varias profesiones, acceder a Oportunidades, y ver estadísticas detalladas. El plan Free te permite crear tu perfil, aparecer en búsquedas y recibir contactos sin costo.' },
  { seccion: 'Para expertos', orden: 6, pregunta: '¿Cómo activo el plan Pro?', respuesta: 'Puedes elegirlo desde el inicio de tu registro, con el primer mes gratis. Por ahora la activación completa del cobro automático está en fase de pruebas.' }
];

async function migrar() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    const yaExisten = await Pregunta.countDocuments();
    if (yaExisten > 0) {
      console.log(`Ya existen ${yaExisten} preguntas en la base de datos. No se insertara nada para evitar duplicados.`);
      console.log('Si de verdad quieres reinsertarlas, borra la coleccion "preguntas" manualmente primero.');
      process.exit(0);
    }

    await Pregunta.insertMany(preguntas);
    console.log(`${preguntas.length} preguntas frecuentes migradas correctamente.`);
    process.exit(0);
  } catch (error) {
    console.error('Error al migrar las preguntas frecuentes:', error);
    process.exit(1);
  }
}

migrar();