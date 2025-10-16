'use client';
import { useMemo, useState, useEffect } from 'react';
// Componente común para mostrar especies (CON FILTRO Y SCROLL)
const EspeciesTable = ({ fondoId }) => {
  const [especies, setEspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  useEffect(() => {
    if (!fondoId) return;
    fetch(`/api/movimiento?fondo_id=${fondoId}`)
      .then(r => r.json())
      .then(data => {
        // API /api/movimiento devuelve { data: [...] } sin flag success
        if (Array.isArray(data.data)) {
          setEspecies(data.data);
        } else if (data.success && Array.isArray(data.data)) {
          setEspecies(data.data);
        }
      })
      .catch(err => {/* Error al cargar especies */});
  }, [fondoId]);
  // Filtrar especies por nombre
  const especiesFiltradas = useMemo(() => {
    if (!filtro.trim()) return especies;
    const filtroLower = filtro.toLowerCase();
    return especies.filter(esp => {
      const nombre = (esp.especie || esp.tipo_especie?.nombre || '').toLowerCase();
      return nombre.includes(filtroLower);
    });
  }, [especies, filtro]);
  if (loading) {
    return <p style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>Cargando especies...</p>;
  }
  if (especies.length === 0) {
    return <p style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>No hay especies registradas</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barra de filtro */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="🔍 Buscar especie..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s'
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#d1d5db';
            e.target.style.boxShadow = 'none';
          }}
        />
        {filtro && (
          <button
            onClick={() => setFiltro('')}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '4px'
            }}
          >
            ✕
          </button>
        )}
      </div>
      {/* Contador de resultados */}
      {filtro && (
        <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
          Mostrando {especiesFiltradas.length} de {especies.length} especies
        </p>
      )}
      {/* Tabla con scroll */}
      <div style={{ 
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: '400px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Fecha</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Especie</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Tipo</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Nominal</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Precio USD</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>Total USD</th>
            </tr>
          </thead>
          <tbody>
            {especiesFiltradas.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
                  No se encontraron especies con "{filtro}"
                </td>
              </tr>
            ) : (
              especiesFiltradas.map(esp => (
                <tr 
                  key={esp.id_movimiento}
                  style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <td style={{ padding: '12px', color: '#111827' }}>
                    {new Date(esp.fecha_alta).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', color: '#111827', fontWeight: '500' }}>
                    {esp.especie || esp.tipo_especie?.nombre || 'Sin especie'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: esp.tipo_mov === 'compra' ? '#d1fae5' : '#fee2e2',
                      color: esp.tipo_mov === 'compra' ? '#065f46' : '#991b1b'
                    }}>
                      {esp.tipo_mov === 'compra' ? '↗ Compra' : '↘ Venta'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#111827' }}>
                    {Number(esp.nominal || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: '#111827' }}>
                    ${Number(esp.precio_usd || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#111827' }}>
                    ${Number((esp.nominal || 0) * (esp.precio_usd || 0)).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
// Componente común para mostrar depósitos y extracciones (CON SEPARACIÓN)
const MovimientosLiquidezTable = ({ movimientos }) => {
  if (!movimientos || movimientos.length === 0) {
    return <p style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>No hay movimientos de liquidez</p>;
  }
  // Separar movimientos manuales de automáticos
  const manuales = movimientos.filter(m => m.origen === 'manual' || (!m.origen && !m.comentario?.includes('automática')));
  const automaticos = movimientos.filter(m => 
    m.origen === 'compra_automatica' || 
    m.origen === 'venta_automatica' || 
    m.comentario?.includes('automática') ||
    m.comentario?.includes('Recupero por venta')
  );
  // Calcular balances
  const balanceManuales = manuales.reduce((sum, m) => {
    const monto = Number(m.monto_usd || m.monto || 0);
    const isIngreso = m.tipo_mov === 'deposito' || m.tipo_operacion === 'asignacion';
    return sum + (isIngreso ? monto : -monto);
  }, 0);
  const balanceAutomaticos = automaticos.reduce((sum, m) => {
    const monto = Number(m.monto_usd || m.monto || 0);
    const isIngreso = m.tipo_mov === 'deposito' || m.tipo_operacion === 'asignacion';
    return sum + (isIngreso ? monto : -monto);
  }, 0);
  const balanceTotal = balanceManuales + balanceAutomaticos;
  const renderMovimiento = (mov, showOrigen = false) => {
    const monto = Number(mov.monto_usd || mov.monto || 0);
    const isDeposito = mov.tipo_mov === 'deposito' || mov.tipo_operacion === 'asignacion';
    return (
      <div 
        key={mov.id || mov.id_mov_liq || Math.random()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: isDeposito ? '#d1fae5' : '#fee2e2'
          }}>
            <span style={{ fontSize: '1.2rem', color: isDeposito ? '#059669' : '#dc2626' }}>
              {isDeposito ? '↗' : '↘'}
            </span>
          </div>
          <div>
            <p style={{ fontWeight: '500', color: '#111827', margin: 0 }}>
              {isDeposito ? 'Depósito/Asignación' : 'Extracción/Desasignación'}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '2px 0 0 0' }}>
              {new Date(mov.fecha).toLocaleDateString()}
            </p>
            {mov.comentario && (
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', margin: '4px 0 0 0' }}>
                {mov.comentario}
              </p>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: '600', fontSize: '1.125rem', color: isDeposito ? '#059669' : '#dc2626', margin: 0 }}>
            {isDeposito ? '+' : '-'}${monto.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '2px 0 0 0' }}>
            USD
          </p>
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Asignaciones Manuales */}
      {manuales.length > 0 && (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '2px solid #3b82f6'
          }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              💰 Asignaciones Manuales
              <span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#6b7280' }}>
                ({manuales.length})
              </span>
            </h4>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: balanceManuales >= 0 ? '#059669' : '#dc2626',
              padding: '4px 12px',
              backgroundColor: balanceManuales >= 0 ? '#d1fae5' : '#fee2e2',
              borderRadius: '9999px'
            }}>
              {balanceManuales >= 0 ? '+' : ''}${balanceManuales.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {manuales.map(m => renderMovimiento(m))}
          </div>
        </div>
      )}
      {/* Movimientos por Trading Automático */}
      {automaticos.length > 0 && (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '2px solid #8b5cf6'
          }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔄 Movimientos por Trading
              <span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#6b7280' }}>
                ({automaticos.length})
              </span>
            </h4>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              color: balanceAutomaticos >= 0 ? '#059669' : '#dc2626',
              padding: '4px 12px',
              backgroundColor: balanceAutomaticos >= 0 ? '#d1fae5' : '#fee2e2',
              borderRadius: '9999px'
            }}>
              {balanceAutomaticos >= 0 ? '+' : ''}${balanceAutomaticos.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {automaticos.map(m => renderMovimiento(m))}
          </div>
        </div>
      )}
      {/* Balance Total */}
      <div style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
            Balance de Liquidez del Fondo
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
            Disponible para nuevas operaciones
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: balanceTotal >= 0 ? '#059669' : '#dc2626' 
          }}>
            ${balanceTotal.toFixed(2)}
          </p>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
            USD
          </p>
        </div>
      </div>
    </div>
  );
};
// Componentes específicos por estrategia
const JubilacionDetalle = ({ fondo, movimientos }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          📊 Registro de Especies
        </h3>
        <EspeciesTable fondoId={fondo.id_fondo} />
      </div>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          💵 Depósitos y Extracciones
        </h3>
        <MovimientosLiquidezTable movimientos={movimientos} />
      </div>
    </div>
  );
};
const ViajesDetalle = ({ fondo, movimientos }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          💵 Depósitos y Extracciones
        </h3>
        <MovimientosLiquidezTable movimientos={movimientos} />
      </div>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          📊 Detalle de Especies
        </h3>
        <EspeciesTable fondoId={fondo.id_fondo} />
      </div>
    </div>
  );
};
const LargoPlazoDetalle = ({ fondo, movimientos }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          📊 Registro de Especies
        </h3>
        <EspeciesTable fondoId={fondo.id_fondo} />
      </div>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          💵 Depósitos y Extracciones
        </h3>
        <MovimientosLiquidezTable movimientos={movimientos} />
      </div>
    </div>
  );
};
const ObjetivoDetalle = ({ fondo, movimientos }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          📊 Registro de Especies
        </h3>
        <EspeciesTable fondoId={fondo.id_fondo} />
      </div>
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#111827' }}>
          💵 Depósitos y Extracciones
        </h3>
        <MovimientosLiquidezTable movimientos={movimientos} />
      </div>
    </div>
  );
};
export default function EstrategiaDetalle({ fondo, movimientos }) {
  const estrategia = useMemo(() => {
    return (fondo.metadata?.estrategia || fondo.tipo_cartera?.categoria || '').toLowerCase();
  }, [fondo.metadata?.estrategia, fondo.tipo_cartera?.categoria]);
  const DetalleComponent = useMemo(() => {
    switch (estrategia) {
      case 'jubilacion': return JubilacionDetalle;
      case 'viajes': return ViajesDetalle;
      case 'largo_plazo': return LargoPlazoDetalle;
      case 'objetivo': return ObjetivoDetalle;
      default: return null;
    }
  }, [estrategia]);
  if (!DetalleComponent) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        <p>No hay detalle disponible para esta estrategia</p>
      </div>
    );
  }
  return <DetalleComponent fondo={fondo} movimientos={movimientos} />;
}