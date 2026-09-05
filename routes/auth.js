// routes/auth.js — Registro e inicio de sesión de expertos y clientes

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const clienteGoogle = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Experto = require('../models/Experto');
const Profesion = require('../models/Profesion');
const { mensajeErrorDuplicado } = require('../utils/manejarErrores');
const { contraseñaValida, correoValido } = require('../utils/validaciones');

// Convierte un texto a formato "Primera Letra Mayúscula" en cada palabra
function normalizarTexto(texto) {
  if (!texto) return texto;
  return texto
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(palabra => palabra !== '')
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

// Registro de un nuevo experto o cliente (con contraseña)
router.post('/registro', async (req, res) => {
  try {
    const { contraseña, ...restoDatos } = req.body;

        if (restoDatos.nombre) {
      restoDatos.nombre = normalizarTexto(restoDatos.nombre);
    }

        if (restoDatos.correo) {
      restoDatos.correo = restoDatos.correo.trim().toLowerCase();
      if (!correoValido(restoDatos.correo)) {
        return res.status(400).json({ mensaje: 'El correo electrónico no tiene un formato válido' });
      }
    }

    if (!contraseña) {
      return res.status(400).json({ mensaje: 'La contraseña es obligatoria' });
    }

    if (!contraseñaValida(contraseña)) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener mínimo 6 caracteres' });
    }

    // Verificamos el numero de documento repetido de forma explicita (no
    // dependemos solo del error de indice duplicado de Mongo), para dar un
    // mensaje claro, igual que hacemos con el correo.
    if (restoDatos.numeroDocumento) {
      restoDatos.numeroDocumento = restoDatos.numeroDocumento.trim();
      const rolParaVerificar = restoDatos.rol === 'cliente' ? 'cliente' : 'experto';
      const documentoExistente = await Experto.findOne({
        numeroDocumento: restoDatos.numeroDocumento,
        rol: rolParaVerificar
      });
      if (documentoExistente) {
        return res.status(400).json({ mensaje: 'Este número de documento ya está registrado' });
      }
    }

    // Medida de seguridad: este endpoint es publico (sin necesidad de iniciar sesion),
    // asi que NUNCA debe permitir crear una cuenta con rol "admin" mandando ese valor
    // en el cuerpo de la peticion. Solo se acepta "experto" (valor por defecto) o
    // "cliente"; cualquier otro valor recibido se ignora silenciosamente.
    restoDatos.rol = restoDatos.rol === 'cliente' ? 'cliente' : 'experto';

    // Validacion obligatoria de aceptacion legal (no basta con la validacion
    // del frontend, porque este endpoint podria llamarse directamente)
    if (!restoDatos.terminosAceptados || !restoDatos.datosAceptados) {
      return res.status(400).json({ mensaje: 'Debes aceptar los Términos de Uso y la Política de Tratamiento de Datos Personales' });
    }
    if (restoDatos.rol === 'experto' && !restoDatos.reglasAceptadas) {
      return res.status(400).json({ mensaje: 'Debes aceptar las Reglas para Expertos' });
    }

    // Guardamos la fecha exacta de cada aceptacion, como prueba de consentimiento
    const ahora = new Date();
    restoDatos.terminosFecha = ahora;
    restoDatos.datosFecha = ahora;
    if (restoDatos.reglasAceptadas) {
      restoDatos.reglasFecha = ahora;
    }
    if (restoDatos.comunicacionesAceptadas) {
      restoDatos.comunicacionesFecha = ahora;
    }

    // Si eligio categoria "Otra" y/o profesion "Otra", exigimos que describa
    // cada una por separado; si no, el cliente nunca podria encontrarlo
    // buscando lo que realmente hace.
    if (restoDatos.rol === 'experto' && restoDatos.profesion) {
      const profesionElegida = await Profesion.findById(restoDatos.profesion).populate('categoria');
      if (profesionElegida) {
        const categoriaEsOtra = profesionElegida.categoria &&
          profesionElegida.categoria.nombre.trim().toLowerCase() === 'otra';
        const profesionEsOtra = profesionElegida.nombre.trim().toLowerCase() === 'otra';

        if (categoriaEsOtra && (!restoDatos.otraCategoriaTexto || !restoDatos.otraCategoriaTexto.trim())) {
          return res.status(400).json({ mensaje: 'Debes indicar cuál es tu categoría específica' });
        }
        if (profesionEsOtra && (!restoDatos.otraProfesionTexto || !restoDatos.otraProfesionTexto.trim())) {
          return res.status(400).json({ mensaje: 'Debes indicar cuál es tu profesión específica' });
        }
      }
    }

    const contraseñaHasheada = await bcrypt.hash(contraseña, 10);

    const nuevoExperto = new Experto({
      ...restoDatos,
      contraseña: contraseñaHasheada
    });

    const expertoGuardado = await nuevoExperto.save();

    // No devolvemos la contraseña, ni siquiera el hash, en la respuesta
    const { contraseña: _, ...expertoSinContraseña } = expertoGuardado.toObject();

    // Generamos el token de sesion de una vez, para que la persona quede
    // logueada automaticamente tras registrarse (sin tener que pasar por
    // /login aparte). Esto es necesario, ademas, para poder subir sus fotos
    // de perfil/documento en el mismo formulario de registro.
    const token = jwt.sign(
      { id: expertoGuardado._id, correo: expertoGuardado.correo },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      ...expertoSinContraseña,
      token
    });
  } catch (error) {
    const mensajeDuplicado = mensajeErrorDuplicado(error);
    res.status(400).json({
      mensaje: mensajeDuplicado || 'Error al registrar el experto',
      error: error.message
    });
  }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
  try {
    const { correo, contraseña, rol } = req.body;

        const correoNormalizado = correo ? correo.trim().toLowerCase() : correo;

    if (!correo || !contraseña) {
      return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    // Como ahora una misma persona puede tener 2 cuentas con el mismo correo
    // (una de experto y una de cliente), si especifica el rol filtramos por
    // ese rol para saber exactamente a cual cuenta quiere entrar. Si no lo
    // especifica, buscamos cualquier cuenta con ese correo (funciona igual
    // que antes para quien solo tiene una sola cuenta).
    const filtro = { correo: correoNormalizado };
    if (rol) {
      filtro.rol = rol;
    }

    // Como "contraseña" tiene select:false, la pedimos explícitamente con +contraseña
        const experto = await Experto.findOne(filtro).select('+contraseña');

    if (!experto) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const coincide = await bcrypt.compare(contraseña, experto.contraseña);

    if (!coincide) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: experto._id, correo: experto.correo },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      experto: { id: experto._id, nombre: experto.nombre, correo: experto.correo, rol: experto.rol }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al iniciar sesión', error: error.message });
  }
});

// Pide recuperar la contraseña: genera un token, lo guarda (con fecha de
// vencimiento de 1 hora), y envia un correo con el enlace usando Resend.
// Por seguridad, SIEMPRE respondemos el mismo mensaje generico, exista o no
// una cuenta con ese correo (para no revelar si un correo esta registrado).
router.post('/olvide-contrasena', async (req, res) => {
  try {
    const correo = (req.body.correo || '').trim().toLowerCase();
    const mensajeGenerico = { mensaje: 'Si el correo existe en nuestra plataforma, te enviamos un enlace para restablecer tu contraseña.' };

    if (!correo) {
      return res.status(400).json({ mensaje: 'Debes indicar tu correo electrónico' });
    }

    const experto = await Experto.findOne({ correo });
    if (!experto) {
      // No revelamos si el correo existe o no
      return res.status(200).json(mensajeGenerico);
    }

    const tokenSinCifrar = crypto.randomBytes(32).toString('hex');
    const tokenCifrado = crypto.createHash('sha256').update(tokenSinCifrar).digest('hex');

    experto.resetPasswordToken = tokenCifrado;
    experto.resetPasswordExpira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await experto.save();

    const urlFrontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const enlace = `${urlFrontend}/restablecer-contrasena?token=${tokenSinCifrar}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'EXPERTOS <no-responder@expertosymas.com>',
        to: [experto.correo],
        subject: 'Recupera tu contraseña en EXPERTOS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #2C3E50;">Recupera tu contraseña</h2>
            <p>Hola ${experto.nombre},</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en EXPERTOS. Si fuiste tú, haz clic en el siguiente botón:</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${enlace}" style="background-color: #2C3E50; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Restablecer contraseña</a>
            </p>
            <p style="color: #888; font-size: 13px;">Este enlace vence en 1 hora. Si tú no pediste esto, puedes ignorar este correo.</p>
          </div>
        `
      })
    });

    res.status(200).json(mensajeGenerico);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al procesar la solicitud', error: error.message });
  }
});

// Restablece la contraseña usando el token recibido por correo
router.post('/restablecer-contrasena', async (req, res) => {
  try {
    const { token, nuevaContraseña } = req.body;

    if (!token || !nuevaContraseña) {
      return res.status(400).json({ mensaje: 'Faltan datos para restablecer la contraseña' });
    }

    if (!contraseñaValida(nuevaContraseña)) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener mínimo 6 caracteres' });
    }

    const tokenCifrado = crypto.createHash('sha256').update(token).digest('hex');

    const experto = await Experto.findOne({
      resetPasswordToken: tokenCifrado,
      resetPasswordExpira: { $gt: new Date() }
    });

    if (!experto) {
      return res.status(400).json({ mensaje: 'El enlace no es válido o ya venció. Solicita uno nuevo.' });
    }

    const contraseñaCifrada = await bcrypt.hash(nuevaContraseña, 10);
    experto.contraseña = contraseñaCifrada;
    experto.resetPasswordToken = '';
    experto.resetPasswordExpira = undefined;
    await experto.save();

    res.status(200).json({ mensaje: 'Tu contraseña fue actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al restablecer la contraseña', error: error.message });
  }
});

// Verifica el token de Google. Si ya existe una cuenta de cliente con ese
// correo, la deja entrar de una vez (login). Si no existe, devuelve los
// datos basicos de Google para que el frontend muestre el resto del
// formulario de registro (documento, WhatsApp, ciudad, etc.)
router.post('/google/verificar', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ mensaje: 'Falta el token de Google' });
    }

    const ticket = await clienteGoogle.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const datosGoogle = ticket.getPayload();

    const experto = await Experto.findOne({ correo: datosGoogle.email.toLowerCase(), rol: 'cliente' });

    if (experto) {
      const token = jwt.sign(
        { id: experto._id, correo: experto.correo },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
      );
      return res.status(200).json({
        existe: true,
        token,
        experto: { id: experto._id, nombre: experto.nombre, correo: experto.correo, rol: experto.rol }
      });
    }

    // No existe todavia: devolvemos los datos de Google para prellenar el
    // resto del formulario de registro
    res.status(200).json({
      existe: false,
      nombre: datosGoogle.name || '',
      correo: datosGoogle.email,
      foto: datosGoogle.picture || '',
      googleId: datosGoogle.sub
    });
  } catch (error) {
    res.status(401).json({ mensaje: 'No se pudo verificar la cuenta de Google', error: error.message });
  }
});

// Completa el registro de un cliente nuevo que entro con Google, agregando
// los datos que Google no entrega (documento, WhatsApp, ubicacion, legales)
router.post('/google/completar-registro', async (req, res) => {
  try {
    const { credential, tipoDocumento, numeroDocumento, whatsapp, ubicaciones,
      atiendePresencial, atiendeVirtual, coberturaVirtualNacional,
      terminosAceptados, datosAceptados, comunicacionesAceptadas } = req.body;

    if (!credential) {
      return res.status(400).json({ mensaje: 'Falta el token de Google' });
    }
    if (!terminosAceptados || !datosAceptados) {
      return res.status(400).json({ mensaje: 'Debes aceptar los Términos de Uso y autorizar el tratamiento de tus datos personales' });
    }

    // Volvemos a verificar el token (nunca confiamos en datos ya "vistos" sin revalidar)
    const ticket = await clienteGoogle.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const datosGoogle = ticket.getPayload();
    const correo = datosGoogle.email.toLowerCase();

    const yaExiste = await Experto.findOne({ correo, rol: 'cliente' });
    if (yaExiste) {
      return res.status(400).json({ mensaje: 'Ya existe una cuenta de cliente con este correo' });
    }

    if (numeroDocumento) {
      const documentoExistente = await Experto.findOne({ numeroDocumento: numeroDocumento.trim(), rol: 'cliente' });
      if (documentoExistente) {
        return res.status(400).json({ mensaje: 'Este número de documento ya está registrado' });
      }
    }

    // La cuenta nunca inicia sesion con contraseña, pero el campo es
    // obligatorio en el modelo: guardamos un hash aleatorio que nunca se usa
    const contraseñaAleatoria = crypto.randomBytes(32).toString('hex');
    const contraseñaCifrada = await bcrypt.hash(contraseñaAleatoria, 10);

    const nuevoCliente = new Experto({
      nombre: datosGoogle.name || '',
      correo,
      contraseña: contraseñaCifrada,
      googleId: datosGoogle.sub,
      foto: datosGoogle.picture || '',
      rol: 'cliente',
      tipoDocumento: tipoDocumento || 'CC',
      numeroDocumento: numeroDocumento ? numeroDocumento.trim() : '',
      whatsapp,
      ubicaciones: ubicaciones || [],
      atiendePresencial: atiendePresencial !== undefined ? atiendePresencial : true,
      atiendeVirtual: atiendeVirtual || false,
      coberturaVirtualNacional: coberturaVirtualNacional || false,
      terminosAceptados: true,
      terminosFecha: new Date(),
      datosAceptados: true,
      datosFecha: new Date(),
      comunicacionesAceptadas: comunicacionesAceptadas || false,
      comunicacionesFecha: comunicacionesAceptadas ? new Date() : undefined
    });

    const guardado = await nuevoCliente.save();

    const token = jwt.sign(
      { id: guardado._id, correo: guardado.correo },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      _id: guardado._id,
      nombre: guardado.nombre,
      correo: guardado.correo,
      token
    });
  } catch (error) {
    res.status(400).json({ mensaje: mensajeErrorDuplicado(error) || 'Error al completar el registro', error: error.message });
  }
});

module.exports = router;