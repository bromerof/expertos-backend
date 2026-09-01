// routes/blog.js — Articulos del blog de EXPERTOS

const express = require('express');
const router = express.Router();
const multer = require('multer');
const Articulo = require('../models/Articulo');
const verificarToken = require('../middleware/verificarToken');
const verificarAdmin = require('../middleware/verificarAdmin');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// Listar articulos PUBLICADOS (publico, sin necesidad de sesion)
router.get('/', async (req, res) => {
  try {
    const articulos = await Articulo.find({ estado: 'publicado' })
      .sort({ fechaPublicacion: -1 })
      .select('titulo resumen imagenPortada fechaPublicacion');
    res.status(200).json(articulos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los articulos', error: error.message });
  }
});

// Ver UN articulo publicado especifico (publico)
router.get('/:id', async (req, res) => {
  try {
    const articulo = await Articulo.findOne({ _id: req.params.id, estado: 'publicado' })
      .populate('autor', 'nombre');

    if (!articulo) {
      return res.status(404).json({ mensaje: 'Articulo no encontrado' });
    }

    res.status(200).json(articulo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el articulo', error: error.message });
  }
});

// Listar TODOS los articulos, incluyendo borradores (PROTEGIDO: solo admin)
router.get('/admin/todos', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const articulos = await Articulo.find().sort({ fechaCreacion: -1 });
    res.status(200).json(articulos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener los articulos', error: error.message });
  }
});

// Crear un articulo nuevo (PROTEGIDO: solo admin)
router.post('/', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { titulo, resumen, contenido, estado } = req.body;

    if (!titulo || !titulo.trim() || !resumen || !resumen.trim() || !contenido || !contenido.trim()) {
      return res.status(400).json({ mensaje: 'Titulo, resumen y contenido son obligatorios' });
    }

    const nuevoArticulo = new Articulo({
      titulo: titulo.trim(),
      resumen: resumen.trim(),
      contenido: contenido.trim(),
      estado: estado === 'publicado' ? 'publicado' : 'borrador',
      autor: req.usuario.id,
      fechaPublicacion: estado === 'publicado' ? new Date() : undefined
    });

    const guardado = await nuevoArticulo.save();
    res.status(201).json(guardado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al crear el articulo', error: error.message });
  }
});

// Editar un articulo existente (PROTEGIDO: solo admin)
router.put('/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const { titulo, resumen, contenido, estado } = req.body;
    const cambios = {};

    if (titulo) cambios.titulo = titulo.trim();
    if (resumen) cambios.resumen = resumen.trim();
    if (contenido) cambios.contenido = contenido.trim();

    if (estado) {
      const articuloActual = await Articulo.findById(req.params.id);
      // Si estaba en borrador y ahora se publica por primera vez, marcamos la fecha
      if (estado === 'publicado' && articuloActual && !articuloActual.fechaPublicacion) {
        cambios.fechaPublicacion = new Date();
      }
      cambios.estado = estado;
    }

    const articuloActualizado = await Articulo.findByIdAndUpdate(req.params.id, cambios, { new: true });

    if (!articuloActualizado) {
      return res.status(404).json({ mensaje: 'Articulo no encontrado' });
    }

    res.status(200).json(articuloActualizado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar el articulo', error: error.message });
  }
});

// Eliminar un articulo (PROTEGIDO: solo admin)
router.delete('/:id', verificarToken, verificarAdmin, async (req, res) => {
  try {
    const eliminado = await Articulo.findByIdAndDelete(req.params.id);

    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Articulo no encontrado' });
    }

    res.status(200).json({ mensaje: 'Articulo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el articulo', error: error.message });
  }
});

// Subir/actualizar la imagen de portada de un articulo (PROTEGIDO: solo admin)
router.post('/:id/portada', verificarToken, verificarAdmin, upload.single('imagenPortada'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: 'No se recibio ningun archivo de imagen' });
    }

    const articulo = await Articulo.findByIdAndUpdate(
      req.params.id,
      { imagenPortada: req.file.path },
      { new: true }
    );

    if (!articulo) {
      return res.status(404).json({ mensaje: 'Articulo no encontrado' });
    }

    res.status(200).json({ mensaje: 'Imagen de portada actualizada correctamente', articulo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al subir la imagen de portada', error: error.message });
  }
});

module.exports = router;