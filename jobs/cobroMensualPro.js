// jobs/cobroMensualPro.js — Cobro automatico mensual del plan Pro
//
// Cada dia se revisa quien tiene el cobro programado para hoy o antes, y se
// intenta cobrar usando la tarjeta guardada (la "fuente de pago" de Wompi).
//
// Reglas acordadas con Betsi:
// - Primer mes gratis, despues $4.900 COP/mes.
// - Si el cobro falla, se reintenta 3 dias despues.
// - Si el reintento tambien falla, el experto baja automaticamente a Free.

const Experto = require('../models/Experto');
const CobroPro = require('../models/CobroPro');
const crypto = require('crypto');

const PRECIO_PRO_COP = 4900;
const DIAS_ENTRE_REINTENTO = 3;

function urlBaseWompi() {
  return process.env.WOMPI_ENV === 'produccion'
    ? 'https://production.wompi.co/v1'
    : 'https://sandbox.wompi.co/v1';
}

// Pide un token de aceptacion fresco (algunas transacciones lo piden aunque
// se este usando una fuente de pago ya guardada)
async function obtenerTokenAceptacion() {
  const llavePublica = (process.env.WOMPI_PUBLIC_KEY || '').trim();
  const respuesta = await fetch(`${urlBaseWompi()}/merchants/${llavePublica}`);
  const datos = await respuesta.json();
  return datos.data && datos.data.presigned_acceptance
    ? datos.data.presigned_acceptance.acceptance_token
    : undefined;
}

// Intenta cobrarle a UN experto, usando su fuente de pago guardada
async function cobrarExperto(experto, numeroIntento) {
  const referencia = `suscripcion-${experto._id}-${Date.now()}`;
  const montoEnCentavos = PRECIO_PRO_COP * 100;

  const cuerpoPeticion = {
    amount_in_cents: montoEnCentavos,
    currency: 'COP',
    customer_email: experto.correo,
    payment_source_id: experto.suscripcionFuentePagoId,
    payment_method: { installments: 1 },
    reference: referencia
  };

  // Firma de integridad: SHA256(referencia + monto_en_centavos + moneda + secreto),
  // igual formula que usamos para el aporte voluntario
  const secretoIntegridad = (process.env.WOMPI_INTEGRITY_SECRET || '').trim();
  const cadenaFirma = `${referencia}${montoEnCentavos}COP${secretoIntegridad}`;
  cuerpoPeticion.signature = crypto.createHash('sha256').update(cadenaFirma).digest('hex');

  const tokenAceptacion = await obtenerTokenAceptacion();
  if (tokenAceptacion) {
    cuerpoPeticion.acceptance_token = tokenAceptacion;
  }

  const respuesta = await fetch(`${urlBaseWompi()}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${(process.env.WOMPI_PRIVATE_KEY || '').trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cuerpoPeticion)
  });
  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.data) {
    // Wompi no devolvio una transaccion valida: esto es un ERROR real, no un
    // "pendiente". Lo dejamos bien visible en los logs para poder diagnosticarlo.
    console.error(`[cobro-mensual-pro] Respuesta inesperada de Wompi al cobrarle a ${experto.nombre}:`, JSON.stringify(datos));

    await new CobroPro({
      experto: experto._id,
      montoEnCentavos,
      estado: 'rechazada',
      idTransaccionWompi: '',
      referencia,
      intentoNumero: numeroIntento
    }).save();

    return 'rechazada';
  }

  const estadoWompi = datos.data.status;
  const estadoInterno = estadoWompi === 'APPROVED' ? 'aprobada'
    : (estadoWompi === 'DECLINED' || estadoWompi === 'ERROR' || estadoWompi === 'VOIDED') ? 'rechazada'
    : 'pendiente';

  await new CobroPro({
    experto: experto._id,
    montoEnCentavos,
    estado: estadoInterno,
    idTransaccionWompi: datos.data.id,
    referencia,
    intentoNumero: numeroIntento
  }).save();

  return estadoInterno;
}

// Procesa TODOS los cobros pendientes del dia. Se exporta para poder
// llamarla tanto desde el proceso programado como manualmente si hace falta.
async function procesarCobrosPendientes() {
  const ahora = new Date();

  const expertosPorCobrar = await Experto.find({
    rol: 'experto',
    plan: 'pro',
    suscripcionEstado: { $in: ['mes_gratis', 'activa', 'pago_fallido'] },
    suscripcionProximoCobro: { $lte: ahora },
    suscripcionFuentePagoId: { $ne: '' }
  });

  console.log(`[cobro-mensual-pro] Expertos a cobrar hoy: ${expertosPorCobrar.length}`);

  for (const experto of expertosPorCobrar) {
    // Si el cobro anterior de este experto quedo "pendiente" sin resolver,
    // no intentamos cobrar de nuevo (evita cobros duplicados) — hay que
    // verificarlo manualmente desde el panel de admin primero.
    const cobroPendienteSinResolver = await CobroPro.findOne({
      experto: experto._id,
      estado: 'pendiente'
    });
    if (cobroPendienteSinResolver) {
      console.log(`[cobro-mensual-pro] ${experto.nombre} tiene un cobro pendiente sin resolver, se omite hasta verificarlo.`);
      continue;
    }

    const esReintento = experto.suscripcionEstado === 'pago_fallido';
    const numeroIntento = esReintento ? experto.suscripcionIntentosFallidos + 1 : 1;

    try {
      const resultado = await cobrarExperto(experto, numeroIntento);
      await aplicarResultadoCobro(experto, resultado, esReintento);
    } catch (error) {
      console.error(`[cobro-mensual-pro] Error al cobrarle a ${experto.nombre}:`, error.message);
    }
  }
}

// Aplica las consecuencias de un resultado de cobro (aprobado/rechazado) al
// experto: activa el siguiente mes, programa un reintento, o baja a Free.
// Se usa tanto desde el proceso diario como desde la verificacion manual de
// un cobro que habia quedado pendiente.
async function aplicarResultadoCobro(experto, resultado, esReintento) {
  if (resultado === 'aprobada') {
    const proximoCobro = new Date();
    proximoCobro.setMonth(proximoCobro.getMonth() + 1);

    experto.suscripcionEstado = 'activa';
    experto.suscripcionProximoCobro = proximoCobro;
    experto.suscripcionIntentosFallidos = 0;
    await experto.save();
    console.log(`[cobro-mensual-pro] Cobro aprobado: ${experto.nombre}`);
  } else if (resultado === 'rechazada') {
    if (esReintento) {
      experto.plan = 'gratuito';
      experto.suscripcionEstado = 'cancelada';
      experto.suscripcionIntentosFallidos = experto.suscripcionIntentosFallidos + 1;
      await experto.save();
      console.log(`[cobro-mensual-pro] Cobro fallo 2 veces, bajado a Free: ${experto.nombre}`);
    } else {
      const proximoIntento = new Date();
      proximoIntento.setDate(proximoIntento.getDate() + DIAS_ENTRE_REINTENTO);

      experto.suscripcionEstado = 'pago_fallido';
      experto.suscripcionProximoCobro = proximoIntento;
      experto.suscripcionIntentosFallidos = 1;
      await experto.save();
      console.log(`[cobro-mensual-pro] Cobro fallo, se reintenta en ${DIAS_ENTRE_REINTENTO} dias: ${experto.nombre}`);
    }
  } else {
    console.log(`[cobro-mensual-pro] Cobro pendiente de confirmar: ${experto.nombre}`);
  }
}

module.exports = { procesarCobrosPendientes, aplicarResultadoCobro, urlBaseWompi };