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
  tipo_cambio_default: z.coerce.number().positive('TC debe ser positivo'),
  cliente_id: z.coerce.number().int().positive().optional(),
});
/**
 * POST /api/precio/import
 * 
 * Importa precios desde CSV de Inviu con:
 * - Batch processing (1 query en vez de 1000+)
 * - Deduplicación automática (múltiples AAPL → 1 promedio ponderado)
 * - Normalización a USD
 * - Mapeo de tickers con sufijo _E
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
    const { csvText, tipo_cambio_default } = parsed.data;
    const sb = await getSb();
    // ================================================================
    // PASO 1: Parsear y validar CSV
    // ================================================================
    const lines = csvText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'CSV debe tener al menos una línea de datos (además del header)'
      }, { status: 400 });
    }
    
    // 🔥 Detectar delimitador automáticamente (coma o punto y coma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    
    // Validar header (soporta formato Tenencias y Precios)
    const header = lines[0].toLowerCase();
    const tieneFormatoTenencias = header.includes('instrumento') && 
                                  header.includes('monto total') && 
                                  header.includes('cantidad') && 
                                  header.includes('moneda');
    const tieneFormatoPrecios = header.includes('símbolo') && 
                                header.includes('precio') && 
                                header.includes('valorización');
    if (!tieneFormatoTenencias && !tieneFormatoPrecios) {
      return NextResponse.json({
        success: false,
        error: 'CSV debe tener formato Tenencias (Instrumento,Monto total,Cantidad,Moneda) o Precios (Símbolo,Precio Último,Valorización)'
      }, { status: 400 });
    }
    // ================================================================
    // PASO 2: Procesar CSV en memoria (deduplicación + normalización)
    // ================================================================
    const preciosPorTicker = new Map();
    let skippedCash = 0;
    let errorLines = [];
    const formatoTenencias = tieneFormatoTenencias;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(delimiter).map(s => s.trim());
      if (parts.length < 3) {
        errorLines.push({ line: i + 1, error: 'Formato inválido (< 3 columnas)' });
        continue;
      }
      let Instrumento, precio_unitario, Moneda;
      if (formatoTenencias) {
        // Formato: Instrumento,Monto total,Cantidad,Moneda
        if (parts.length < 4) {
          errorLines.push({ line: i + 1, error: 'Formato Tenencias requiere 4 columnas' });
          continue;
        }
        const [inst, montoTotal, cantidad, mon] = parts;
        Instrumento = inst;
        Moneda = mon;
        // Skip cash lines (son liquidez, no especies)
        if (['ARS', 'USD', 'USDC'].includes(Instrumento)) {
          skippedCash++;
          continue;
        }
        // Calcular precio por unidad
        const cant = parseFloat(cantidad);
        const monto = parseFloat(montoTotal);
        if (isNaN(cant) || isNaN(monto) || cant === 0) {
          errorLines.push({ 
            line: i + 1, 
            ticker: Instrumento,
            error: 'Cantidad o monto inválido' 
          });
          continue;
        }
        precio_unitario = monto / cant;
      } else {
        // Formato: Símbolo,Precio Último,Valorización
        const [inst, precio, mon] = parts;
        Instrumento = inst;
        Moneda = mon;
        // Skip cash lines
        if (['ARS', 'USD', 'USDC'].includes(Instrumento)) {
          skippedCash++;
          continue;
        }
        const prec = parseFloat(precio);
        if (isNaN(prec) || prec <= 0) {
          errorLines.push({ 
            line: i + 1, 
            ticker: Instrumento,
            error: 'Precio inválido' 
          });
          continue;
        }
        precio_unitario = prec;
      }
      try {
        // Normalizar ticker (AAPL_E → AAPL)
        const ticker = Instrumento.replace(/_E$/, '').toUpperCase();
        // Detectar moneda
        const tieneE = Instrumento.endsWith('_E');
        const esUSD = tieneE || Moneda === 'USDC' || Moneda === 'USD';
        const moneda = esUSD ? 'USD' : 'ARS';
        // Clave única: ticker + moneda (para evitar mezclar AAPL ARS con AAPL USD)
        const clave = `${ticker}_${moneda}`;
        // Deduplicar: Si ya existe, hacer promedio ponderado por cantidad
        if (preciosPorTicker.has(clave)) {
          const anterior = preciosPorTicker.get(clave);
          // Para formato tenencias: promedio ponderado
          // Para formato precios: tomar el último (o promedio simple)
          const precioFinal = formatoTenencias 
            ? ((anterior.precio * anterior.cantidad) + precio_unitario) / (anterior.cantidad + 1)
            : (anterior.precio + precio_unitario) / 2;
          preciosPorTicker.set(clave, {
            ticker: ticker,  // El ticker sin moneda
            precio: precioFinal,
            cantidad: anterior.cantidad + 1,
            moneda: moneda,
            lineas: [...anterior.lineas, i + 1]
          });
        } else {
          preciosPorTicker.set(clave, {
            ticker: ticker,  // El ticker sin moneda
            precio: precio_unitario,
            cantidad: 1,
            moneda: moneda,
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
    if (preciosPorTicker.size === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron especies válidas en el CSV',
        details: { errorLines, skippedCash }
      }, { status: 400 });
    }
    // ================================================================
    // PASO 3: Buscar o crear tipo_especie (BATCH)
    // ================================================================
    // Extraer tickers únicos (sin duplicar por moneda)
    const tickersUnicos = [...new Set(
      Array.from(preciosPorTicker.values()).map(p => p.ticker)
    )];
    // Query batch: Buscar todos los tickers de una vez
    const { data: tiposExistentes, error: errorBuscar } = await sb
      .from('tipo_especie')
      .select('id_tipo_especie, nombre')
      .in('nombre', tickersUnicos);
    if (errorBuscar) {
      throw new Error(`Error buscando tipo_especie: ${errorBuscar.message}`);
    }
    const tiposMap = new Map(
      (tiposExistentes || []).map(t => [t.nombre, t.id_tipo_especie])
    );
    // Crear los que no existen (batch insert)
    const tickersNuevos = tickersUnicos.filter(t => !tiposMap.has(t));
    if (tickersNuevos.length > 0) {
      const { data: nuevos, error: errorCrear } = await sb
        .from('tipo_especie')
        .insert(tickersNuevos.map(nombre => ({ nombre })))
        .select('id_tipo_especie, nombre');
      if (errorCrear) {
        throw new Error(`Error creando tipo_especie: ${errorCrear.message}`);
      }
      // Agregar al map
      (nuevos || []).forEach(t => tiposMap.set(t.nombre, t.id_tipo_especie));
    }
    // ================================================================
    // PASO 4: Preparar batch de precios (normalizar a USD)
    // ================================================================
    const fecha = new Date().toISOString().split('T')[0];
    const preciosArray = [];
    for (const [clave, data] of preciosPorTicker.entries()) {
      const tipo_cambio_usado = data.moneda === 'ARS' ? tipo_cambio_default : null;
      const precio_usd = data.moneda === 'USD' || data.moneda === 'USDC'
        ? data.precio 
        : data.precio / tipo_cambio_default;
      // Si el ticker existe en ambas monedas, tomar el precio USD
      // (AAPL ARS e AAPL_E USD → preferir AAPL_E USD)
      const tickerId = tiposMap.get(data.ticker);
      // Verificar si ya hay un precio USD para este ticker
      const yaExisteUSD = preciosArray.find(
        p => p.tipo_especie_id === tickerId && p.moneda === 'USD'
      );
      // Si ya existe USD, skipear el ARS
      if (yaExisteUSD && data.moneda === 'ARS') {
        continue;
      }
      // Si este es USD y ya existe ARS, reemplazar
      if (data.moneda === 'USD') {
        const indexARS = preciosArray.findIndex(
          p => p.tipo_especie_id === tickerId && p.moneda === 'ARS'
        );
        if (indexARS >= 0) {
          preciosArray.splice(indexARS, 1);
        }
      }
      preciosArray.push({
        tipo_especie_id: tickerId,
        precio: data.precio,
        moneda: data.moneda,
        tipo_cambio_usado: tipo_cambio_usado,
        precio_usd: precio_usd,
        fecha: fecha
      });
    }
    // ================================================================
    // PASO 5: Batch upsert (1 SOLO QUERY para todos los precios!)
    // ================================================================
    const { error: errorPrecio } = await sb
      .from('precio_especie')
      .upsert(preciosArray, {
        onConflict: 'tipo_especie_id,fecha',
        ignoreDuplicates: false  // Actualizar si ya existe
      });
    if (errorPrecio) {
      throw new Error(`Error guardando precios: ${errorPrecio.message}`);
    }
    // ================================================================
    // PASO 6: Respuesta con estadísticas
    // ================================================================
    return NextResponse.json({ 
      success: true, 
      data: {
        total_lineas: lines.length - 1,  // Sin header
        tickers_unicos: preciosPorTicker.size,
        tickers_nuevos: tickersNuevos.length,
        precios_actualizados: preciosArray.length,
        cash_omitido: skippedCash,
        queries_ejecutadas: 3,  // buscar + crear (si hay) + upsert
        errores: errorLines.length > 0 ? errorLines : undefined,
        fecha_importacion: fecha,
        tipo_cambio_usado: tipo_cambio_default,
        // Debug info (solo primeros 5)
        sample: Array.from(preciosPorTicker.entries())
          .slice(0, 5)
          .map(([clave, data]) => ({
            ticker: data.ticker,
            precio_original: data.precio.toFixed(2),
            moneda: data.moneda,
            precio_usd: (data.moneda === 'USD' ? data.precio : data.precio / tipo_cambio_default).toFixed(2),
            cantidad_acumulada: data.cantidad,
            lineas_csv: data.lineas.join(',')
          }))
      }
    });
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: e.message 
    }, { status: 500 });
  }
}
/**
 * GET /api/precio/import
 * 
 * Obtener estadísticas de imports recientes
 */
export async function GET(req) {
  const auth = await assertAuthenticated(req);
  if (!auth.ok) return auth.res;
  try {
    const sb = await getSb();
    // Obtener fechas de imports (últimos 30 días)
    const { data, error } = await sb
      .from('precio_especie')
      .select('fecha, COUNT(*) as count')
      .gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('fecha', { ascending: false });
    if (error) throw error;
    // Agrupar por fecha
    const importsPorFecha = {};
    (data || []).forEach(row => {
      if (!importsPorFecha[row.fecha]) {
        importsPorFecha[row.fecha] = 0;
      }
      importsPorFecha[row.fecha] += row.count;
    });
    return NextResponse.json({
      success: true,
      data: {
        imports_recientes: Object.entries(importsPorFecha).map(([fecha, count]) => ({
          fecha,
          tickers: count
        }))
      }
    });
  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: e.message 
    }, { status: 500 });
  }
}