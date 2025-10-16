-- Vista mejorada para estado de fondo
CREATE OR REPLACE VIEW v_fondo_metricas AS
SELECT 
  f.id_fondo,
  f.cliente_id,
  f.tipo_cartera_id,
  tc.categoria,
  tc.descripcion as nombre_cartera,
  f.fecha_alta,
  f.rend_esperado,
  f.metadata,
  COALESCE(ef.liquidez_asignada, 0) as liquidez_asignada,
  COALESCE(ef.dinero_invertido, 0) as dinero_invertido,
  COALESCE(ef.saldo_disponible, 0) as saldo_disponible,
  COALESCE(rf.valor_total_fondo, 0) as valor_total_fondo,
  COALESCE(rf.rendimiento_porcentaje, 0) as rendimiento_real,
  -- Progreso específico por tipo de cartera
  CASE tc.categoria
    WHEN 'jubilacion' THEN
      -- Para jubilación: progreso basado en tiempo transcurrido
      CASE 
        WHEN (f.metadata->>'anos')::int > 0 THEN
          LEAST(100, 
            (EXTRACT(YEAR FROM age(current_date, f.fecha_alta)) * 100.0) / 
            (f.metadata->>'anos')::int
          )
        ELSE 0
      END
    WHEN 'viajes' THEN
      -- Para viajes: progreso basado en monto acumulado vs objetivo
      CASE 
        WHEN (f.metadata->>'monto_objetivo')::numeric > 0 THEN
          LEAST(100, 
            (COALESCE(ef.liquidez_asignada, 0) + COALESCE(ef.dinero_invertido, 0)) * 100.0 / 
            (f.metadata->>'monto_objetivo')::numeric
          )
        ELSE 0
      END
    WHEN 'objetivo' THEN
      -- Para objetivo: progreso basado en monto y tiempo
      CASE 
        WHEN (f.metadata->>'monto_objetivo')::numeric > 0 AND
             (f.metadata->>'fecha_objetivo')::date >= current_date THEN
          LEAST(100, 
            (COALESCE(ef.liquidez_asignada, 0) + COALESCE(ef.dinero_invertido, 0)) * 100.0 / 
            (f.metadata->>'monto_objetivo')::numeric
          )
        ELSE 0
      END
    ELSE 0
  END as progreso_porcentaje,
  -- Días restantes para objetivos con fecha
  CASE tc.categoria
    WHEN 'objetivo' THEN
      CASE 
        WHEN (f.metadata->>'fecha_objetivo')::date >= current_date THEN
          ((f.metadata->>'fecha_objetivo')::date - current_date)
        ELSE 0
      END
    ELSE NULL
  END as dias_restantes
FROM fondo f
JOIN tipo_cartera tc ON f.tipo_cartera_id = tc.id_tipo_cartera
LEFT JOIN v_estado_fondo ef ON f.id_fondo = ef.id_fondo
LEFT JOIN v_rendimiento_fondo rf ON f.id_fondo = rf.id_fondo;

-- Vista para movimientos con más detalles
CREATE OR REPLACE VIEW v_movimientos_detalle AS
SELECT 
  ml.id_mov_liq,
  ml.fondo_id,
  ml.fecha,
  ml.tipo_mov,
  ml.monto,
  ml.moneda,
  ml.monto_usd,
  ml.comentario,
  f.tipo_cartera_id,
  tc.categoria,
  tc.descripcion as tipo_cartera_nombre,
  f.metadata
FROM mov_liquidez ml
JOIN fondo f ON ml.fondo_id = f.id_fondo
JOIN tipo_cartera tc ON f.tipo_cartera_id = tc.id_tipo_cartera
ORDER BY ml.fecha DESC, ml.created_at DESC;

-- Vista para rendimientos anualizados
CREATE OR REPLACE VIEW v_rendimiento_anualizado AS
SELECT 
  f.id_fondo,
  f.cliente_id,
  tc.categoria,
  -- Rendimiento anualizado basado en el tiempo transcurrido
  CASE 
    WHEN EXTRACT(DAYS FROM age(current_timestamp, f.fecha_alta)) > 0 THEN
      (rf.rendimiento_porcentaje * 365.0) / 
      EXTRACT(DAYS FROM age(current_timestamp, f.fecha_alta))
    ELSE 0
  END as rendimiento_anualizado,
  rf.rendimiento_porcentaje as rendimiento_total
FROM fondo f
JOIN tipo_cartera tc ON f.tipo_cartera_id = tc.id_tipo_cartera
LEFT JOIN v_rendimiento_fondo rf ON f.id_fondo = rf.id_fondo;