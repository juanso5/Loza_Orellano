'use client';
import { useState, useEffect } from 'react';
import { LoadingSpinner } from './ui';
/**
 * CSVPrecioImport - Componente para importar precios desde CSV de Inviu
 * 
 * Características:
 * - Batch processing optimizado (1 query en vez de 1000+)
 * - Deduplicación automática
 * - Selector de tipo de cambio
 * - Progress feedback
 * - Estadísticas del import
 */
export default function CSVPrecioImport({ onSuccess }) {
  const [csvFile, setCsvFile] = useState(null);
  const [tipoCambio, setTipoCambio] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // Cargar TC actual al abrir
  useEffect(() => {
    fetch('/api/tipo-cambio-actual')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data?.valor) {
          setTipoCambio(data.data.valor.toString());
        }
      })
      .catch(err => {/* Error al cargar tipo cambio */});
  }, []);
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Validar que sea CSV
    if (!file.name.endsWith('.csv')) {
      setError('El archivo debe ser un CSV (.csv)');
      return;
    }
    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máx 5MB)');
      return;
    }
    setCsvFile(file);
    setError('');
    setResult(null);
  };
  const handleImport = async () => {
    if (!csvFile || !tipoCambio) {
      setError('Debe seleccionar un archivo CSV y especificar el tipo de cambio');
      return;
    }
    const tc = parseFloat(tipoCambio);
    if (isNaN(tc) || tc <= 0) {
      setError('El tipo de cambio debe ser un número positivo');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      // Leer archivo como texto
      const text = await csvFile.text();
      // Enviar a API
      const response = await fetch('/api/precio/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: text,
          tipo_cambio_default: tc
        })
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.data);
        // Actualizar TC actual en base de datos
        await fetch('/api/tipo-cambio-actual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: tc })
        });
        // Callback de éxito (para refrescar datos en página padre)
        if (onSuccess) {
          onSuccess(data.data);
        }
      } else {
        setError(data.error || 'Error al importar CSV');
        if (data.details) {
          }
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleReset = () => {
    setCsvFile(null);
    setResult(null);
    setError('');
  };
  return (
    <div className="csv-import-container" style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #3b82f615 0%, #3b82f630 100%)',
          border: '2px solid #3b82f650',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6',
          fontSize: '1.125rem'
        }}>
          <i className="fas fa-file-csv"></i>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
            Importar Precios desde CSV
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Carga el CSV exportado desde Inviu
          </p>
        </div>
      </div>
      {/* Área de carga de archivo */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#374151'
        }}>
          Archivo CSV de Inviu
        </label>
        <div style={{
          position: 'relative',
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          backgroundColor: '#f9fafb',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = '#3b82f6';
          e.currentTarget.style.backgroundColor = '#eff6ff';
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = '#d1d5db';
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = '#d1d5db';
          e.currentTarget.style.backgroundColor = '#f9fafb';
          const file = e.dataTransfer.files[0];
          if (file) {
            handleFileChange({ target: { files: [file] } });
          }
        }}
        >
          <input 
            type="file" 
            accept=".csv"
            onChange={handleFileChange}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer'
            }}
            disabled={loading}
          />
          {csvFile ? (
            <div>
              <i className="fas fa-file-csv" style={{ fontSize: '2rem', color: '#10b981', marginBottom: '0.5rem' }}></i>
              <p style={{ margin: '0.5rem 0', fontWeight: '600', color: '#111827' }}>
                {csvFile.name}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                {(csvFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <i className="fas fa-cloud-upload-alt" style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '0.5rem' }}></i>
              <p style={{ margin: '0.5rem 0', fontWeight: '600', color: '#111827' }}>
                Arrastra el archivo o haz click para seleccionar
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                Solo archivos .csv (máx 5MB)
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Tipo de cambio */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#374151'
        }}>
          Tipo de Cambio USD/ARS
        </label>
        <input 
          type="number"
          step="0.01"
          value={tipoCambio}
          onChange={(e) => setTipoCambio(e.target.value)}
          placeholder="Ej: 1350.50"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            outline: 'none',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
        />
        <p style={{
          margin: '0.5rem 0 0 0',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          Usado para convertir precios ARS a USD. Se guardará como TC actual.
        </p>
      </div>
      {/* Error */}
      {error && (
        <div style={{
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-exclamation-circle" style={{ color: '#dc2626' }}></i>
            <span style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '600' }}>
              {error}
            </span>
          </div>
        </div>
      )}
      {/* Botones */}
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button 
          onClick={handleImport}
          disabled={loading || !csvFile || !tipoCambio}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: (loading || !csvFile || !tipoCambio) ? '#d1d5db' : '#3b82f6',
            color: '#fff',
            fontWeight: '600',
            fontSize: '0.9375rem',
            cursor: (loading || !csvFile || !tipoCambio) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (!loading && csvFile && tipoCambio) {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && csvFile && tipoCambio) {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #fff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }}></div>
              Importando...
            </>
          ) : (
            <>
              <i className="fas fa-upload"></i>
              Importar Precios
            </>
          )}
        </button>
        {(csvFile || result) && !loading && (
          <button 
            onClick={handleReset}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#374151',
              fontWeight: '600',
              fontSize: '0.9375rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
            }}
          >
            <i className="fas fa-redo"></i> Limpiar
          </button>
        )}
      </div>
      {/* Resultado del import */}
      {result && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          borderRadius: '8px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #86efac'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <i className="fas fa-check-circle" style={{ color: '#16a34a', fontSize: '1.25rem' }}></i>
            <span style={{ fontSize: '1rem', color: '#16a34a', fontWeight: '700' }}>
              Importación exitosa
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Líneas procesadas</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>{result.total_lineas}</div>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Tickers únicos</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>{result.tickers_unicos}</div>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Precios actualizados</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>{result.precios_actualizados}</div>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '4px' }}>Queries ejecutadas</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>{result.queries_ejecutadas}</div>
            </div>
          </div>
          {result.tickers_nuevos > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#059669', marginBottom: '0.5rem' }}>
              ✨ {result.tickers_nuevos} ticker{result.tickers_nuevos !== 1 ? 's' : ''} nuevo{result.tickers_nuevos !== 1 ? 's' : ''} creado{result.tickers_nuevos !== 1 ? 's' : ''}
            </div>
          )}
          {result.cash_omitido > 0 && (
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              ⏭️ {result.cash_omitido} línea{result.cash_omitido !== 1 ? 's' : ''} de liquidez omitida{result.cash_omitido !== 1 ? 's' : ''} (ARS, USD, USDC)
            </div>
          )}
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            Fecha: {result.fecha_importacion} | TC usado: {result.tipo_cambio_usado}
          </div>
          {/* Muestra de precios importados */}
          {result.sample && result.sample.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
                Ver muestra de precios importados ({result.sample.length})
              </summary>
              <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Ticker</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Precio</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Moneda</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sample.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem' }}>{item.ticker}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>${item.precio_original}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            backgroundColor: item.moneda === 'USD' ? '#dbeafe' : '#fef3c7',
                            color: item.moneda === 'USD' ? '#1e40af' : '#92400e'
                          }}>
                            {item.moneda}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#3b82f6' }}>
                          ${item.precio_usd}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {result.errores && result.errores.length > 0 && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600', color: '#dc2626' }}>
                ⚠️ Errores ({result.errores.length})
              </summary>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                {result.errores.map((err, i) => (
                  <li key={i}>Línea {err.line}: {err.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
