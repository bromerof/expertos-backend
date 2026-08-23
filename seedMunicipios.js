// seedMunicipios.js — Script para cargar Departamentos y Municipios de Colombia a MongoDB
// Se ejecuta UNA SOLA VEZ con: node seedMunicipios.js

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Departamento = require('./models/Departamento');
const Municipio = require('./models/Municipio');

async function importar() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB Atlas');

    const rutaArchivo = path.join(__dirname, 'data', 'municipios.json');
    const datos = JSON.parse(fs.readFileSync(rutaArchivo, 'utf-8'));

    console.log('Registros leidos del archivo:', datos.length);

    // Paso 1: Crear los departamentos unicos
    const departamentosUnicos = {};
    datos.forEach((fila) => {
      departamentosUnicos[fila.codigoDepartamento] = fila.departamento;
    });

    const mapaDepartamentos = {};

    for (const codigo in departamentosUnicos) {
      const nombre = departamentosUnicos[codigo];

      let departamento = await Departamento.findOne({ codigoDane: codigo });
      if (!departamento) {
        departamento = await Departamento.create({ codigoDane: codigo, nombre: nombre });
        console.log('Departamento creado:', nombre);
      }
      mapaDepartamentos[codigo] = departamento._id;
    }

    console.log('Total departamentos procesados:', Object.keys(mapaDepartamentos).length);

    // Paso 2: Crear los municipios, enlazados a su departamento
    let creados = 0;
    let existentes = 0;

    for (const fila of datos) {
      const yaExiste = await Municipio.findOne({ codigoDane: fila.codigoDaneMunicipio });
      if (yaExiste) {
        existentes++;
        continue;
      }

      await Municipio.create({
        codigoDane: fila.codigoDaneMunicipio,
        nombre: fila.municipio,
        departamento: mapaDepartamentos[fila.codigoDepartamento]
      });
      creados++;
    }

    console.log('Municipios creados:', creados);
    console.log('Municipios que ya existian (omitidos):', existentes);
    console.log('Importacion completada exitosamente');

    process.exit(0);
  } catch (error) {
    console.error('Error durante la importacion:', error);
    process.exit(1);
  }
}

importar();