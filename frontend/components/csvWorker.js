/* eslint-disable no-restricted-globals */
// Worker ESM. No accede al DOM.
// Carga papaparse dinámicamente dentro del worker y calcula precios ponderados por instrumento.
// Filtra filas de “caja” típicas (ARS/USD/USDC/USD.C).
const BOX_SET = new Set(['ARS', 'USD', 'USDC', 'USD.C']);
self.onmessage = async (ev) => {
  const { type, payload } = ev.data || {};
  if (type !== 'parse') return;
  try {
    const { csv } = payload;
    const Papa = await import('papaparse');
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    if (parsed.errors?.length) {
      postMessage({ type: 'error', error: parsed.errors[0]?.message || 'CSV inválido' });
      return;
    }
    const rows = (parsed.data || []).map((r) => ({
      instrumento: String(r['Instrumento'] ?? r['instrumento'] ?? '').trim(),
      monto: Number(r['Monto total'] ?? r['monto total'] ?? r['monto'] ?? 0) || 0,
      cantidad: Number(r['Cantidad'] ?? r['cantidad'] ?? 0) || 0,
      moneda: String(r['Moneda'] ?? r['moneda'] ?? '').trim().toUpperCase(),
    })).filter((r) => r.instrumento && !BOX_SET.has(r.instrumento));
    const agg = new Map();
    for (const r of rows) {
      if (!agg.has(r.instrumento)) agg.set(r.instrumento, { monto: 0, cantidad: 0 });
      const acc = agg.get(r.instrumento);
      acc.monto += r.monto;
      acc.cantidad += r.cantidad;
    }
    const items = [];
    agg.forEach((acc, instrumento) => {
      if (acc.cantidad > 0) items.push({ instrumento, precio: acc.monto / acc.cantidad });
    });
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    postMessage({ type: 'result', payload: { fecha, items } });
  } catch (e) {
    postMessage({ type: 'error', error: e?.message || String(e) });
  }
};