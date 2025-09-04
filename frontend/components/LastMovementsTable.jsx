'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';

// Fila memoizada para minimizar renders
const Row = memo(function Row({ index, style, data }) {
  const row = data.rows[index];
  const onDelete = data.onDelete;

  const tipo = (row?.tipo_mov || '').toString().toLowerCase();
  const tipoLabel = tipo === 'venta' ? 'Venta' : tipo === 'compra' ? 'Compra' : '';

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '140px 1fr 1fr 1fr 100px 120px 60px',
        padding: '0 8px',
        alignItems: 'center',
        borderBottom: '1px dashed #eef2f6'
      }}
    >
      <div>{formatDate(row.fecha_alta)}</div>
      <div>{row.cliente_nombre}</div>
      <div>{row.cartera_nombre}</div>
      <div>{row.especie}</div>
      <div>{tipoLabel}</div>
      <div style={{ textAlign: 'right' }}>{formatNumber(row.nominal)}</div>
      <div style={{ textAlign: 'right' }}>
        <button className="btn-delete-mov" onClick={() => onDelete(row.id_movimiento)} title="Eliminar">
          <i className="fas fa-trash"></i>
        </button>
      </div>
    </div>
  );
});

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function formatNumber(n) {
  return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export default function LastMovementsTable({ rows, onReachEnd, onDelete, loading, error }) {
  const containerRef = useRef(null);
  const [height, setHeight] = useState(420);

  // Calcular alto disponible de forma simple (sin dependencias extra)
  const recomputeHeight = useCallback(() => {
    const vh = window.innerHeight || 800;
    // Reservar espacio para header/controles
    const h = Math.max(280, Math.min(680, vh - 260));
    setHeight(h);
  }, []);
  useEffect(() => {
    recomputeHeight();
    window.addEventListener('resize', recomputeHeight);
    return () => window.removeEventListener('resize', recomputeHeight);
  }, [recomputeHeight]);

  // Observa fin de lista para “cargar más”
  const endSentinelRef = useRef(null);
  useEffect(() => {
    if (!onReachEnd) return;
    const sentinel = endSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) onReachEnd();
      });
    }, { root: containerRef.current, threshold: 0.1 });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [onReachEnd]);

  const itemData = useMemo(() => ({ rows, onDelete }), [rows, onDelete]);

  return (
    <div className="table" style={{ width: '100%' }}>
      <div
        className="table-header"
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 1fr 1fr 100px 120px 60px',
          padding: '10px 8px',
          borderBottom: '1px solid #eef2f6',
          fontWeight: 600,
          color: '#6b7280'
        }}
      >
        <div>Fecha</div>
        <div>Cliente</div>
        <div>Cartera</div>
        <div>Especie</div>
        <div>Tipo</div>
        <div style={{ textAlign: 'right' }}>Nominal</div>
        <div style={{ textAlign: 'right' }}>Acciones</div>
      </div>

      <div ref={containerRef} style={{ height, overflow: 'auto' }}>
        <List
          height={height}
          itemCount={rows.length}
          itemSize={44}
          width="100%"
          itemData={itemData}
          overscanCount={8}
        >
          {Row}
        </List>

        {/* Sentinela para infinite scroll */}
        <div ref={endSentinelRef} style={{ height: 1 }} />

        {loading && (
          <div style={{ padding: 10, textAlign: 'center', color: '#64748b' }}>
            Cargando…
          </div>
        )}
        {error && (
          <div style={{ padding: 10, textAlign: 'center', color: '#b00' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}