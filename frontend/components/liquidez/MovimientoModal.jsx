"use client";
import { useState, useEffect } from 'react';
export default function MovimientoModal({ 
  isOpen, 
  onClose, 
  onSave, 
  clienteId,
  tipo = 'deposito' // 'deposito' o 'extraccion'
}) {
  const [formData, setFormData] = useState({
    monto: '',
    moneda: 'USD',
    tipo_cambio_usado: '', // Sin valor por defecto
    fecha: new Date().toISOString().split('T')[0],
    comentario: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Cargar tipo de cambio actual desde la base de datos cuando se abre el modal
  useEffect(() => {
    if (isOpen && !formData.tipo_cambio_usado) {
      fetch('/api/tipo-cambio-actual')
        .then(r => r.json())
        .then((tcData) => {
          if (tcData.success && tcData.data?.valor) {
            setFormData(prev => ({
              ...prev,
              tipo_cambio_usado: tcData.data.valor.toString()
            }));
          }
        })
        .catch((err) => {
          });
    }
  }, [isOpen]);
  const calcularEquivalencia = () => {
    const monto = parseFloat(formData.monto) || 0;
    const tc = parseFloat(formData.tipo_cambio_usado) || 1;
    if (formData.moneda === 'USD') {
      return {
        principal: `USD ${monto.toFixed(2)}`,
        equivalente: `Ôëê ARS ${(monto * tc).toFixed(2)}`
      };
    } else {
      return {
        principal: `ARS ${monto.toFixed(2)}`,
        equivalente: `Ôëê USD ${(monto / tc).toFixed(2)}`
      };
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Preparar datos para enviar
      const payload = {
        cliente_id: clienteId,
        tipo_mov: tipo,
        monto: parseFloat(formData.monto),
        moneda: formData.moneda,
        fecha: formData.fecha,
        comentario: formData.comentario || undefined
      };
      // Siempre incluir tipo_cambio_usado
      if (formData.tipo_cambio_usado) {
        payload.tipo_cambio_usado = parseFloat(formData.tipo_cambio_usado);
      }
      const response = await fetch('/api/liquidez', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result.success) {
        // Manejar errores de validación Zod
        if (typeof result.error === 'object' && result.error.fieldErrors) {
          const errors = Object.entries(result.error.fieldErrors)
            .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`)
            .join('\n');
          throw new Error(errors);
        }
        throw new Error(result.error || 'Error al registrar movimiento');
      }
      // Actualizar el tipo de cambio actual en la base de datos
      if (payload.tipo_cambio_usado) {
        fetch('/api/tipo-cambio-actual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valor: payload.tipo_cambio_usado,
            comentario: `Actualizado desde ${tipo === 'deposito' ? 'depósito' : 'extracción'}`
          })
        }).catch(err => {/* Error al actualizar tipo cambio */});
      }
      onSave(result.data);
      onClose();
      // Reset form - mantiene el tipo de cambio usado
      setFormData(prev => ({
        monto: '',
        moneda: 'USD',
        tipo_cambio_usado: prev.tipo_cambio_usado, // Mantiene el último usado
        fecha: new Date().toISOString().split('T')[0],
        comentario: ''
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;
  const equivalencia = calcularEquivalencia();
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        maxWidth: '28rem',
        width: '100%',
        margin: '0 1rem'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: tipo === 'deposito' ? '#f0fdf4' : '#fef2f2'
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: tipo === 'deposito' ? '#15803d' : '#b91c1c'
          }}>
            {tipo === 'deposito' ? 'Registrar Depósito' : 'Registrar Extracción'}
          </h2>
          <button
            onClick={onClose}
            style={{
              color: '#6b7280',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            <i className="fas fa-times" style={{ fontSize: '20px' }} />
          </button>
        </div>
        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}
          {/* Monto */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              <i className="fas fa-dollar-sign" style={{ marginRight: '0.5rem', fontSize: '14px' }} />
              Monto *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.monto}
              onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
              placeholder="0.00"
            />
          </div>
          {/* Moneda */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Moneda
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, moneda: 'USD' })}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: formData.moneda === 'USD' ? '2px solid #3b82f6' : '2px solid #d1d5db',
                  backgroundColor: formData.moneda === 'USD' ? '#eff6ff' : 'white',
                  color: formData.moneda === 'USD' ? '#1d4ed8' : '#374151',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                USD
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, moneda: 'ARS' })}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: formData.moneda === 'ARS' ? '2px solid #3b82f6' : '2px solid #d1d5db',
                  backgroundColor: formData.moneda === 'ARS' ? '#eff6ff' : 'white',
                  color: formData.moneda === 'ARS' ? '#1d4ed8' : '#374151',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                ARS
              </button>
            </div>
          </div>
          {/* Tipo de Cambio - SIEMPRE visible */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Tipo de Cambio (USD/ARS) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.tipo_cambio_usado}
              onChange={(e) => setFormData({ ...formData, tipo_cambio_usado: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
              placeholder="1500.00"
            />
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Ingresa el tipo de cambio del día
            </p>
          </div>
          {/* Equivalencia */}
          {formData.monto && (
            <div style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Equivalencia:
              </p>
              <p style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827' }}>
                {equivalencia.principal}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                {equivalencia.equivalente}
              </p>
            </div>
          )}
          {/* Fecha */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              <i className="fas fa-calendar" style={{ marginRight: '0.5rem', fontSize: '14px' }} />
              Fecha
            </label>
            <input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
          </div>
          {/* Comentario */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              <i className="fas fa-comment" style={{ marginRight: '0.5rem', fontSize: '14px' }} />
              Comentario (opcional)
            </label>
            <textarea
              value={formData.comentario}
              onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
              style={{
                width: '100%',
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                fontFamily: 'inherit'
              }}
              rows="3"
              placeholder="Ej: Transferencia inicial, Retiro parcial, etc."
            />
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                color: 'white',
                backgroundColor: tipo === 'deposito' ? '#16a34a' : '#dc2626',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                fontSize: '1rem',
                fontWeight: '600'
              }}
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
