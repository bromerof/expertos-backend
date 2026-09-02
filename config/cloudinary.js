// config/cloudinary.js — Configuración de conexión a Cloudinary

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para fotos de perfil y documentos: se recortan a un cuadrado fijo,
// tiene sentido porque son fotos de rostro/documento
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'expertos-perfiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill' }]
  }
});

// Storage para portadas del blog: NO se recortan, solo se limita el ancho
// maximo (para que el archivo no pese demasiado), conservando la forma
// original de la imagen (banners horizontales, verticales, lo que sea)
const storageBlog = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'expertos-blog',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }]
  }
});

module.exports = { cloudinary, storage, storageBlog };