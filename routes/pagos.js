// routes/pagos.js — Integración con Wompi (aportes voluntarios y, mas adelante, suscripciones Pro)

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Aporte = require('../models/Aporte');
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

    // Firma de integridad: SHA256(referencia + monto_en_centavos + moneda + secreto)
    // SIEMPRE se genera en el backend, nunca en el frontend
    const cadena = `${referencia}${montoEnCentavos}COP${process.env.WOMPI_INTEGRITY_SECRET}`;
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
      llavePublica: process.env.WOMPI_PUBLIC_KEY
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

module.exports = router;