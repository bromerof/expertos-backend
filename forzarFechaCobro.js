// forzarFechaCobro.js — Script de UNA SOLA VEZ, solo para pruebas.
// Adelanta la fecha de "suscripcionProximoCobro" de un experto especifico a
// HOY, para poder probar el cobro automatico sin esperar un mes completo.
//
// Como correrlo: node forzarFechaCobro.js CORREO_DEL_EXPERTO
// Ejemplo:       node forzarFechaCobro.js prueba3@gmail.com

require('dotenv').config();
const mongoose = require('mongoose');
const Experto = require('./models/Experto');

const correo = process.argv[2];

if (!correo) {
  console.log('Debes indicar el correo del experto. Ejemplo:');
  console.log('node forzarFechaCobro.js prueba3@gmail.com');
  process.exit(1);
}

async function forzarFecha() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    const experto = await Experto.findOne({ correo });

    if (!experto) {
      console.log(`No se encontro ningun experto con el correo ${correo}`);
      process.exit(1);
    }

    if (experto.plan !== 'pro') {
      console.log(`${experto.nombre} no tiene el plan Pro activo, no tiene sentido forzar su cobro.`);
      process.exit(1);
    }

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    experto.suscripcionProximoCobro = ayer;
    await experto.save();

    console.log(`Listo. La fecha de proximo cobro de ${experto.nombre} quedo en: ${ayer}`);
    process.exit(0);
  } catch (error) {
    console.error('Error al forzar la fecha:', error);
    process.exit(1);
  }
}

forzarFecha();