"use client";
export default function FondoCard({ fondo, onAsignar }) {
  const { 
    id_fondo, 
    tipo_cartera, 
    liquidez_asignada, 
    saldo_disponible, 
    progreso_porcentaje, 
    valor_total_fondo,
    rendimiento_porcentaje,
    nombre
  } = fondo;
  const color = tipo_cartera?.color || '#8b5cf6';
  const nombreFondo = nombre || tipo_cartera?.descripcion || 'Sin nombre';
  const icono = tipo_cartera?.icono || 'fas fa-chart-line';
  const progreso = progreso_porcentaje || 0;
  const rendimiento = rendimiento_porcentaje || 0;
  // Color dinámico para progreso
  const getProgressColor = () => {
    if (progreso >= 90) return '#10b981'; // Verde
    if (progreso >= 70) return '#84cc16'; // Verde claro
    if (progreso >= 50) return '#f59e0b'; // Amarillo
    if (progreso >= 30) return '#f97316'; // Naranja
    return '#3b82f6'; // Azul
  };
  const progressColor = getProgressColor();
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '16px',
      border: `1px solid ${color}40`,
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
      padding: '1.75rem',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.borderColor = `${color}70`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = `${color}40`;
    }}
    >
      {/* Background decorativo */}
      <div style={{
        position: 'absolute',
        top: '-50px',
        right: '-50px',
        width: '150px',
        height: '150px',
        background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
        borderRadius: '50%'
      }}></div>
      {/* Header con ícono y nombre */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '14px', 
        marginBottom: '1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '14px',
          background: `linear-gradient(135deg, ${color}20 0%, ${color}40 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          color: color,
          border: `2px solid ${color}50`,
          flexShrink: 0,
          boxShadow: `0 4px 12px ${color}25`
        }}>
          <i className={icono}></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '1.125rem', 
            fontWeight: '700', 
            color: '#111827',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em'
          }}>
            {nombreFondo}
          </h3>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#6b7280', 
            marginTop: '4px',
            fontWeight: '500'
          }}>
            <i className="fas fa-folder" style={{ marginRight: '6px', fontSize: '0.7rem' }}></i>
            Fondo #{id_fondo}
          </div>
        </div>
      </div>
      {/* Métrica Hero - Valor Total */}
      <div style={{
        background: `linear-gradient(135deg, ${color}12 0%, ${color}25 100%)`,
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
        border: `1px solid ${color}40`,
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Valor Total del Fondo
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2rem', fontWeight: '800', color: color, lineHeight: '1', letterSpacing: '-0.02em' }}>
              ${(valor_total_fondo || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#9ca3af' }}>USD</span>
          </div>
          <div style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: rendimiento >= 0 ? '#dcfce7' : '#fee2e2',
            border: rendimiento >= 0 ? '1px solid #86efac' : '1px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <i className={`fas fa-arrow-${rendimiento >= 0 ? 'up' : 'down'}`} style={{ 
              fontSize: '0.75rem', 
              color: rendimiento >= 0 ? '#166534' : '#991b1b'
            }}></i>
            <span style={{ 
              fontSize: '0.875rem', 
              fontWeight: '700', 
              color: rendimiento >= 0 ? '#166534' : '#991b1b'
            }}>
              {rendimiento >= 0 ? '+' : ''}{rendimiento.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      {/* Grid de estadísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '12px', 
        marginBottom: '1.25rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          background: '#f9fafb',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Liquidez Asignada
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#3b82f6' }}>
            ${(liquidez_asignada || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{
          background: '#f0fdf4',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid #86efac'
        }}>
          <div style={{ fontSize: '0.6875rem', color: '#15803d', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Disponible
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: '700', color: '#166534' }}>
            ${(saldo_disponible || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      {/* Barra de progreso */}
      <div style={{ marginBottom: '1.25rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Progreso de Asignación
          </span>
          <span style={{ fontSize: '0.875rem', fontWeight: '700', color: progressColor }}>
            {progreso.toFixed(0)}%
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '10px',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: `${Math.min(100, progreso)}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${progressColor} 0%, ${progressColor}cc 100%)`,
            borderRadius: '6px',
            transition: 'width 0.4s ease',
            boxShadow: progreso > 0 ? `0 0 8px ${progressColor}40` : 'none'
          }}></div>
        </div>
        {progreso >= 100 && (
          <div style={{ 
            marginTop: '10px',
            padding: '8px 12px',
            background: '#dcfce7',
            borderRadius: '8px',
            border: '1px solid #86efac',
            fontSize: '0.75rem',
            color: '#166534',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <i className="fas fa-check-circle"></i>
            Completamente asignado
          </div>
        )}
      </div>
      {/* Botón de acción - Asignar Liquidez */}
      <div style={{
        position: 'relative',
        zIndex: 1
      }}>
        <button 
          onClick={() => onAsignar?.(fondo)}
          style={{
            width: '100%',
            padding: '14px 20px',
            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: `0 4px 14px ${color}30`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 6px 20px ${color}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 14px ${color}30`;
          }}
        >
          <i className="fas fa-hand-holding-usd"></i>
          Asignar Liquidez
        </button>
      </div>
    </div>
  );
}
