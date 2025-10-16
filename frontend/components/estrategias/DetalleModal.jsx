'use client';
import { useState, useEffect } from 'react';
import EstrategiaDetalle from './EstrategiaDetalle';
export default function DetalleModal({ fondo, isOpen, onClose, onDelete }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  useEffect(() => {
    if (!isOpen || !fondo?.id_fondo) {
      setMovimientos([]);
      setLoading(true);
      return;
    }
    // Cargar movimientos de liquidez
    fetch(`/api/liquidez/movimientos?fondo_id=${fondo.id_fondo}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setMovimientos(data.data);
        }
      })
      .catch(err => {/* Error al cargar movimientos */});
  }, [isOpen, fondo?.id_fondo]);
  if (!isOpen || !fondo) return null;
  const nombre_cartera = fondo.tipo_cartera?.descripcion || `Cartera ${fondo.id_fondo}`;
  const color = fondo.tipo_cartera?.color || '#3b82f6';
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{ 
            padding: '24px',
            borderBottom: `3px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fff'
          }}
        >
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#1f2937',
              margin: 0
            }}>
              {nombre_cartera}
            </h2>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              margin: '4px 0 0 0'
            }}>
              ID: {fondo.id_fondo}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#6b7280" 
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        {/* Body */}
        <div style={{ 
          flex: 1,
          overflowY: 'auto',
          padding: '24px'
        }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <p style={{ color: '#6b7280' }}>Cargando información...</p>
            </div>
          ) : (
            <EstrategiaDetalle fondo={fondo} movimientos={movimientos} />
          )}
        </div>
        {/* Footer */}
        <div style={{ 
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {onDelete && (
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            >
              <i className="fas fa-trash"></i>
              Eliminar Fondo
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1d5db'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
          >
            Cerrar
          </button>
        </div>
      </div>
      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirmOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmOpen(false);
          }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                color: '#dc2626'
              }}>
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
                  Confirmar Eliminación
                </h3>
              </div>
            </div>
            <p style={{ margin: '16px 0', fontSize: '0.9375rem', color: '#4b5563', lineHeight: '1.6' }}>
              ¿Estás seguro que querés eliminar el fondo <strong>"{nombre_cartera}"</strong>?
            </p>
            <div style={{
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fde68a',
              marginBottom: '20px'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#92400e' }}>
                <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
                Esta acción eliminará el fondo y <strong>todos sus movimientos asociados</strong>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#fff',
                  color: '#374151',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              >
                <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
                Cancelar
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  onClose();
                  onDelete(fondo.id_fondo);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                <i className="fas fa-trash" style={{ marginRight: '6px' }}></i>
                Eliminar Fondo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
