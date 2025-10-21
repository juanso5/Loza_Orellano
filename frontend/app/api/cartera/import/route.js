import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAuthenticated } from '@/lib/authGuard';
import { getSSRClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const getSb = () => getSSRClient();

// Schema de validación
const importSchema = z.object({
  csvText: z.string().min(10, 'CSV debe tener contenido'),
  cliente_id: z.coerce.number().int().positive('cliente_id es requerido'),
  fondo_id: z.coerce.number().int().positive('fondo_id es requerido'),
  tipo_cambio: z.coerce.number().positive('Tipo de cambio debe ser positivo'),
  fecha_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser YYYY-MM-DD'),
});

/**
 * POST /api/cartera/import
 * 
 * Importa cartera completa de un cliente desde CSV/Excel de Inviu
 * Crea movimientos de compra para cada especie con su cantidad
 * 
 * Body:
 * - csvText: contenido del CSV
 * - cliente_id: ID del cliente
 * - fondo_id: ID del fondo destino
 * - tipo_cambio: TC USD/ARS para convertir precios
 * - fecha_compra: Fecha de las compras (YYYY-MM-DD)
 */
export async function POST(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { csvText, cliente_id, fondo_id, tipo_cambio, fecha_compra } = parsed.data;
    const sb = await getSb();

    // ================================================================
    // PASO 1: Validar que el fondo pertenezca al cliente
    // ================================================================
    const { data: fondo, error: fondoError } = await sb
      .from('fondo')
      .select('cliente_id, nombre')
      .eq('id_fondo', fondo_id)
      .single();

    if (fondoError || !fondo) {
      return NextResponse.json({
        success: false,
        error: 'Fondo no encontrado'
      }, { status: 404 });
    }

    if (fondo.cliente_id !== cliente_id) {
      return NextResponse.json({
        success: false,
        error: 'El fondo no pertenece al cliente seleccionado'
      }, { status: 400 });
    }

    // ================================================================
    // PASO 2: Parsear CSV
    // ================================================================
    const lines = csvText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'CSV debe tener al menos una línea de datos'
      }, { status: 400 });
    }

    // Detectar delimitador
    const delimiter = lines[0].includes(';') ? ';' : ',';

    // Validar header
    const header = lines[0].toLowerCase();
    if (!header.includes('instrumento') || !header.includes('cantidad') || !header.includes('moneda')) {
      return NextResponse.json({
        success: false,
        error: 'CSV debe tener columnas: Instrumento, Monto total, Cantidad, Moneda'
      }, { status: 400 });
    }

    // Helper para normalizar números
    const parseNumber = (str) => {
      if (!str) return 0;
      const normalized = str.toString().replace(/,/g, '.');
      return parseFloat(normalized);
    };

    // ================================================================
    // PASO 3: Agrupar por instrumento (deduplicar)
    // ================================================================
    const especiesPorTicker = new Map();
    let skippedCash = 0;
    let errorLines = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(delimiter).map(s => s.trim());

      if (parts.length < 4) {
        errorLines.push({ line: i + 1, error: 'Formato inválido (< 4 columnas)' });
        continue;
      }

      const [Instrumento, montoTotal, cantidad, Moneda] = parts;

      // Skip liquidez (no son especies)
      if (['ARS', 'USD', 'USDC', 'USD.C'].includes(Instrumento)) {
        skippedCash++;
        continue;
      }

      try {
        const cant = parseNumber(cantidad);
        const monto = parseNumber(montoTotal);

        if (isNaN(cant) || isNaN(monto) || cant === 0) {
          errorLines.push({ 
            line: i + 1, 
            ticker: Instrumento,
            error: 'Cantidad o monto inválido' 
          });
          continue;
        }

        const precioUnitario = monto / cant;

        // Normalizar ticker (mantener _E para extranjeras)
        const ticker = Instrumento.toUpperCase();
        const tieneE = Instrumento.endsWith('_E');
        const esUSD = tieneE || Moneda === 'USDC' || Moneda === 'USD';
        const moneda = esUSD ? 'USD' : 'ARS';

        // Acumular cantidades y calcular precio promedio ponderado
        if (especiesPorTicker.has(ticker)) {
          const anterior = especiesPorTicker.get(ticker);
          const nuevaCantidad = anterior.cantidad + cant;
          const nuevoMonto = anterior.montoTotal + monto;
          
          especiesPorTicker.set(ticker, {
            ticker,
            cantidad: nuevaCantidad,
            montoTotal: nuevoMonto,
            precioPromedio: nuevoMonto / nuevaCantidad,
            moneda,
            lineas: [...anterior.lineas, i + 1]
          });
        } else {
          especiesPorTicker.set(ticker, {
            ticker,
            cantidad: cant,
            montoTotal: monto,
            precioPromedio: precioUnitario,
            moneda,
            lineas: [i + 1]
          });
        }
      } catch (err) {
        errorLines.push({ 
          line: i + 1, 
          ticker: Instrumento,
          error: err.message 
        });
      }
    }

    if (especiesPorTicker.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron especies válidas en el CSV',
        details: { errorLines, skippedCash }
      }, { status: 400 });
    }

    // ================================================================
    // PASO 4: Buscar o crear tipo_especie para cada ticker
    // ================================================================
    const tickers = [...especiesPorTicker.keys()];
    
    const { data: tiposExistentes, error: errorBuscar } = await sb
      .from('tipo_especie')
      .select('id_tipo_especie, nombre')
      .in('nombre', tickers);

    if (errorBuscar) {
      throw new Error(`Error buscando especies: ${errorBuscar.message}`);
    }

    const tiposMap = new Map(
      (tiposExistentes || []).map(t => [t.nombre, t.id_tipo_especie])
    );

    // Crear las que no existen
    const tickersNuevos = tickers.filter(t => !tiposMap.has(t));
    let especiesCreadas = 0;

    if (tickersNuevos.length > 0) {
      const { data: nuevos, error: errorCrear } = await sb
        .from('tipo_especie')
        .insert(tickersNuevos.map(nombre => ({ nombre })))
        .select('id_tipo_especie, nombre');

      if (errorCrear) {
        throw new Error(`Error creando especies: ${errorCrear.message}`);
      }

      (nuevos || []).forEach(t => tiposMap.set(t.nombre, t.id_tipo_especie));
      especiesCreadas = nuevos.length;
    }

    // ================================================================
    // PASO 5: Crear movimientos de compra para cada especie
    // ================================================================
    const movimientos = [];
    let erroresMovimientos = [];

    for (const [ticker, data] of especiesPorTicker.entries()) {
      const tipoEspecieId = tiposMap.get(ticker);
      
      if (!tipoEspecieId) {
        erroresMovimientos.push(`${ticker}: No se pudo obtener ID de especie`);
        continue;
      }

      // Calcular precio en USD
      const precioUSD = data.moneda === 'USD' 
        ? data.precioPromedio 
        : data.precioPromedio / tipo_cambio;

      movimientos.push({
        cliente_id: cliente_id,
        fondo_id: fondo_id,
        tipo_especie_id: tipoEspecieId,
        tipo_mov: 'compra',
        nominal: Math.round(data.cantidad), // Cantidad de títulos
        precio_compra: data.precioPromedio,
        precio_compra_usd: precioUSD,
        moneda_compra: data.moneda,
        tipo_cambio_compra: data.moneda === 'ARS' ? tipo_cambio : null,
        fecha_alta: fecha_compra
      });
    }

    // Insertar todos los movimientos en batch
    const { data: movimientosCreados, error: errorMovimientos } = await sb
      .from('movimiento')
      .insert(movimientos)
      .select('id_movimiento');

    if (errorMovimientos) {
      throw new Error(`Error creando movimientos: ${errorMovimientos.message}`);
    }

    // ================================================================
    // PASO 6: Respuesta con estadísticas
    // ================================================================
    return NextResponse.json({
      success: true,
      data: {
        mensaje: `Cartera importada exitosamente al fondo "${fondo.nombre}"`,
        cliente_id,
        fondo_id,
        estadisticas: {
          lineas_procesadas: lines.length - 1,
          especies_importadas: especiesPorTicker.size,
          especies_nuevas: especiesCreadas,
          movimientos_creados: movimientosCreados?.length || 0,
          liquidez_omitida: skippedCash,
          errores: errorLines.length
        },
        detalles: {
          fecha_compra,
          tipo_cambio_usado: tipo_cambio,
          especies: Array.from(especiesPorTicker.values()).map(e => ({
            ticker: e.ticker,
            cantidad: e.cantidad,
            precio_promedio: e.precioPromedio.toFixed(2),
            moneda: e.moneda,
            monto_total: e.montoTotal.toFixed(2)
          })).slice(0, 20) // Primeras 20 para preview
        },
        errores: errorLines.slice(0, 10) // Primeros 10 errores
      }
    });

  } catch (error) {
    console.error('Error en importación de cartera:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al importar cartera'
    }, { status: 500 });
  }
}