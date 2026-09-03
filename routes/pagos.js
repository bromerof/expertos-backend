// routes/pagos.js — Integración con Wompi (aportes voluntarios y, mas adelante, suscripciones Pro)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Aporte = require('../models/Aporte');
const Experto = require('../models/Experto');
const verificarToken = require('../middleware/verificarToken');

// Wompi usa una URL base distinta segun el ambiente (sandbox vs produccion).
// Por ahora trabajamos siempre en sandbox; cuando pasemos a produccion, solo
// hay que cambiar la variable de entorno WOMPI_ENV.
function urlBaseWompi() {
  return process.env.WOMPI_ENV === 'produccion'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

// Genera una referencia unica y la firma de integridad para un aporte voluntario.
// El cliente debe estar logueado (para poder asociar el aporte a su cuenta),
// pero no exigimos que sea "cliente aprobado" especificamente para esto.
router.post('/aporte/generar', verificarToken, async (req, res) => {
  try {
    const { monto } = req.body;

    if (!monto || monto < 1000) {
      return res.status(400).json({ mensaje: 'El aporte minimo es de $1.000 COP' });
    }

    const montoEnCentavos = Math.round(monto) * 100;
    const referencia = `aporte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Limpiamos espacios/saltos de linea accidentales que a veces quedan al
    // copiar y pegar el secreto desde el dashboard de Wompi
    const secretoIntegridad = (process.env.WOMPI_INTEGRITY_SECRET || '').trim();
    const llavePublica = (process.env.WOMPI_PUBLIC_KEY || '').trim();

    // Firma de integridad: SHA256(referencia + monto_en_centavos + moneda + secreto)
    // SIEMPRE se genera en el backend, nunca en el frontend
    const cadena = `${referencia}${montoEnCentavos}COP${secretoIntegridad}`;
    const firma = crypto.createHash('sha256').update(cadena).digest('hex');

    const nuevoAporte = new Aporte({
      cliente: req.usuario.id,
      referencia,
      montoEnCentavos
    });
    await nuevoAporte.save();

    res.status(200).json({
      referencia,
      firma,
      montoEnCentavos,
      llavePublica,
      // Wompi rechaza (403) cualquier redirect-url que no sea https:// (por
      // ejemplo, localhost). Por eso el backend siempre entrega una URL fija
      // y segura, sin importar desde donde se este probando.
      redirectUrl: process.env.WOMPI_REDIRECT_URL || 'https://www.expertosymas.com/aporte-confirmacion'
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar el aporte', error: error.message });
  }
});

// Verifica el estado REAL de una transaccion consultando directamente a Wompi
// (nunca confiamos solo en la redireccion del navegador)
router.get('/verificar/:idTransaccion', verificarToken, async (req, res) => {
  try {
    const respuesta = await fetch(`${urlBaseWompi()}/transactions/${req.params.idTransaccion}`, {
      headers: { 'Authorization': `Bearer ${process.env.WOMPI_PRIVATE_KEY}` }
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.data) {
      return res.status(400).json({ mensaje: 'No se pudo verificar la transaccion' });
    }

    const transaccion = datos.data;
    const nuevoEstado = transaccion.status === 'APPROVED' ? 'aprobada'
      : transaccion.status === 'DECLINED' || transaccion.status === 'ERROR' || transaccion.status === 'VOIDED' ? 'rechazada'
      : 'pendiente';

    // Actualizamos nuestro registro con el estado real y el ID de Wompi
    const aporte = await Aporte.findOneAndUpdate(
      { referencia: transaccion.reference },
      { estado: nuevoEstado, idTransaccionWompi: transaccion.id },
      { returnDocument: 'after' }
    );

    res.status(200).json({
      estado: nuevoEstado,
      montoEnCentavos: transaccion.amount_in_cents,
      aporte
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al verificar la transaccion', error: error.message });
  }
});


// ===================================================================
// SUSCRIPCION PRO RECURRENTE (en preparacion, pendiente de que Wompi
// active 3D Secure para Fuentes de Pago en la cuenta de EXPERTOS)
// ===================================================================

const PRECIO_PRO_COP = 4900;

// Obtiene los tokens de aceptacion (terminos y datos personales) que Wompi
// exige incluir al crear una fuente de pago. Son publicos, no requieren
// llave privada, y cambian de vez en cuando, por eso se piden en el momento.
router.get('/token-aceptacion', verificarToken, async (req, res) => {
  try {
    const llavePublica = (process.env.WOMPI_PUBLIC_KEY || '').trim();
    const respuesta = await fetch(`${urlBaseWompi()}/merchants/${llavePublica}`);
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.data) {
      return res.status(400).json({ mensaje: 'No se pudo obtener el token de aceptacion de Wompi' });
    }

    res.status(200).json({
      tokenTerminos: datos.data.presigned_acceptance ? datos.data.presigned_acceptance.acceptance_token : null,
      tokenDatosPersonales: datos.data.presigned_personal_data_auth
        ? datos.data.presigned_personal_data_auth.acceptance_token
        : null,
      llavePublica
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el token de aceptacion', error: error.message });
  }
});

// Registra la fuente de pago (tarjeta tokenizada) para el experto logueado,
// y activa su mes gratis del plan Pro. El estado inicial puede quedar
// "PENDING" mientras Wompi resuelve la verificacion 3D Secure.
//
// IMPORTANTE: esta ruta la invoca un envio de formulario REAL del navegador
// (el widget de Wompi arma el <form> y lo envia el solo), no una peticion
// fetch/AJAX de nuestra app. Por eso NO puede llevar el token en el header
// "Authorization" como el resto de la API (los formularios nativos del
// navegador no permiten headers personalizados) — el token viaja como un
// campo oculto mas del formulario, y aqui lo verificamos a mano.
router.post('/registrar-fuente-pago', async (req, res) => {
  const urlFrontend = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  try {
    const { payment_source_token, tokenTerminos, tokenDatosPersonales, authToken } = req.body;

    if (!authToken) {
      return res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('Tu sesion expiro, inicia sesion de nuevo')}`);
    }

    let payload;
    try {
      payload = jwt.verify(authToken, process.env.JWT_SECRET);
    } catch (errorToken) {
      return res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('Tu sesion no es valida, inicia sesion de nuevo')}`);
    }

    if (!payment_source_token || !tokenTerminos) {
      return res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('DEBUG campos recibidos: ' + JSON.stringify(req.body))}`);
    }

    const experto = await Experto.findById(payload.id);
    if (!experto || experto.rol !== 'experto') {
      return res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('Esta accion es solo para expertos')}`);
    }

    const cuerpoPeticion = {
      type: 'CARD',
      token: payment_source_token,
      customer_email: experto.correo,
      acceptance_token: tokenTerminos
    };
    if (tokenDatosPersonales) {
      cuerpoPeticion.accept_personal_auth = tokenDatosPersonales;
    }

    const respuesta = await fetch(`${urlBaseWompi()}/payment_sources`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(process.env.WOMPI_PRIVATE_KEY || '').trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cuerpoPeticion)
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.data) {
      return res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('Wompi rechazo la tarjeta')}`);
    }

    // Guardamos la fuente de pago y activamos el mes gratis. El estado real
    // de la verificacion 3DS puede tardar; se confirma despues consultando
    // GET /api/pagos/fuente-pago/estado
    const ahora = new Date();
    const proximoCobro = new Date();
    proximoCobro.setMonth(proximoCobro.getMonth() + 1);

    experto.suscripcionFuentePagoId = datos.data.id;
    experto.suscripcionEstado = 'mes_gratis';
    experto.suscripcionFechaInicio = ahora;
    experto.suscripcionProximoCobro = proximoCobro;
    experto.suscripcionIntentosFallidos = 0;
    experto.plan = 'pro';
    await experto.save();

    res.redirect(`${urlFrontend}/espera-aprobacion`);
  } catch (error) {
    res.redirect(`${urlFrontend}/activar-pro?error=${encodeURIComponent('Error al registrar la tarjeta')}`);
  }
});

// Consulta el estado REAL de la fuente de pago del experto logueado
// (util mientras la verificacion 3DS pasa de "PENDING" a un estado final)
router.get('/fuente-pago/estado', verificarToken, async (req, res) => {
  try {
    const experto = await Experto.findById(req.usuario.id);

    if (!experto || !experto.suscripcionFuentePagoId) {
      return res.status(404).json({ mensaje: 'Este experto no tiene una fuente de pago registrada' });
    }

    const respuesta = await fetch(`${urlBaseWompi()}/payment_sources/${experto.suscripcionFuentePagoId}`, {
      headers: { 'Authorization': `Bearer ${(process.env.WOMPI_PRIVATE_KEY || '').trim()}` }
    });
    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.data) {
      return res.status(400).json({ mensaje: 'No se pudo consultar el estado de la fuente de pago' });
    }

    res.status(200).json({ estado: datos.data.status });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar el estado de la fuente de pago', error: error.message });
  }
});

module.exports = router;