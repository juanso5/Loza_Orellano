"use client";
export default function LiquidezSummaryCard({ estado, loading }) {
  if (loading) {
    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ 
            backgroundColor: '#fff', 
            borderRadius: '12px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)', 
            padding: '1.25rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              height: '1rem', 
              backgroundColor: '#e5e7eb', 
              borderRadius: '4px', 
              width: '60%', 
              marginBottom: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
            <div style={{ 
              height: '2rem', 
              backgroundColor: '#e5e7eb', 
              borderRadius: '4px',
              marginBottom: '0.5rem',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
            <div style={{ 
              height: '0.75rem', 
              backgroundColor: '#e5e7eb', 
              borderRadius: '4px',
              width: '40%',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
          </div>
        ))}
      </div>
    );
  }
  if (!estado) return null;
  const cards = [
    {
      title: 'Liquidez Total',
      value: estado.liquidezTotal || estado.total_usd,
      iconClass: 'fas fa-wallet',
      color: '#3b82f6',
      bgColor: '#eff6ff',
      description: 'Pool completo'
    },
    {
      title: 'Liquidez Asignada',
      value: estado.liquidezAsignada || estado.asignada_usd,
      iconClass: 'fas fa-chart-pie',
      color: '#10b981',
      bgColor: '#f0fdf4',
      percentage: estado.porcentajeAsignado || Math.round(((estado.asignada_usd || 0) / (estado.total_usd || 1)) * 100) || 0,
      description: 'En fondos'
    },
    {
      title: 'Liquidez Disponible',
      value: estado.liquidezDisponible || estado.disponible_usd,
      iconClass: 'fas fa-hand-holding-usd',
      color: '#8b5cf6',
      bgColor: '#faf5ff',
      description: 'Por asignar'
    },
    {
      title: 'Total Depósitos',
      value: estado.totalDepositos || estado.depositos_usd,
      iconClass: 'fas fa-piggy-bank',
      color: '#f59e0b',
      bgColor: '#fffbeb',
      description: 'Histórico'
    }
  ];
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
      gap: '1rem', 
      marginBottom: '2rem' 
    }}>
      {cards.map((card, index) => (
        <div 
          key={index} 
          style={{ 
            backgroundColor: '#fff', 
            borderRadius: '12px', 
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)', 
            padding: '1.25rem',
            transition: 'all 0.2s ease',
            cursor: 'default',
            border: '1px solid #e5e7eb',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = `${card.color}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
        >
          {/* Header con ícono y porcentaje */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ 
              width: '40px',
              height: '40px',
              borderRadius: '10px', 
              backgroundColor: card.bgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              color: card.color,
              flexShrink: 0
            }}>
              <i className={card.iconClass}></i>
            </div>
            {card.percentage !== undefined && (
              <div style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: card.bgColor,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <i className="fas fa-chart-line" style={{ fontSize: '0.625rem', color: card.color }}></i>
                <span style={{ fontSize: '0.75rem', color: card.color, fontWeight: '700' }}>
                  {card.percentage}%
                </span>
              </div>
            )}
          </div>
          {/* Título */}
          <h3 style={{ 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: '#6b7280', 
            margin: '0 0 0.5rem 0',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {card.title}
          </h3>
          {/* Valor principal */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.375rem',
            marginBottom: '0.5rem'
          }}>
            <p style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: card.color,
              margin: 0,
              lineHeight: '1',
              letterSpacing: '-0.01em'
            }}>
              ${(card.value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#9ca3af'
            }}>USD</span>
          </div>
          {/* Descripción */}
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <div style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              backgroundColor: card.color,
              opacity: 0.5
            }}></div>
            <p style={{ 
              fontSize: '0.6875rem', 
              color: '#9ca3af', 
              margin: 0,
              fontWeight: '500'
            }}>
              {card.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
