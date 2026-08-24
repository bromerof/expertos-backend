require('dotenv').config();
const mongoose = require('mongoose');
const Categoria = require('./models/Categoria');
const Profesion = require('./models/Profesion');
const datos = require('./data/categoriasProfesiones');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  // 1. Recorremos cada categoría de la lista principal
  for (const item of datos) {
    // Busca si la categoría ya existe (para no duplicarla si corremos el script otra vez)
    let categoria = await Categoria.findOne({ nombre: item.categoria });
    if (!categoria) {
      categoria = await Categoria.create({ nombre: item.categoria, orden: item.orden });
      console.log(`Categoría creada: ${categoria.nombre}`);
    }

    // A la lista de profesiones de esta categoría le agregamos "Otra" al final
    const profesionesACrear = [...item.profesiones, "Otra"];

    for (const nombreProfesion of profesionesACrear) {
      const existe = await Profesion.findOne({ nombre: nombreProfesion, categoria: categoria._id });
      if (!existe) {
        await Profesion.create({ nombre: nombreProfesion, categoria: categoria._id });
      }
    }
    console.log(`  → ${profesionesACrear.length} profesiones listas para "${categoria.nombre}"`);
  }

  // 2. Categoría especial "Otra" (para cuando ninguna categoría de la lista aplica)
  let categoriaOtra = await Categoria.findOne({ nombre: "Otra" });
  if (!categoriaOtra) {
    categoriaOtra = await Categoria.create({ nombre: "Otra", orden: 999 });
    console.log('Categoría especial "Otra" creada');
  }
  const existeProfesionOtra = await Profesion.findOne({ nombre: "Otra", categoria: categoriaOtra._id });
  if (!existeProfesionOtra) {
    await Profesion.create({ nombre: "Otra", categoria: categoriaOtra._id });
  }

  console.log('✅ Carga de categorías y profesiones completa.');
  mongoose.connection.close();
}

seed();