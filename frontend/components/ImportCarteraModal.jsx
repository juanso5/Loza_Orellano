'use client';
import { useState, useEffect } from 'react';

/**
 * ImportCarteraModal - Sistema completo de importación de carteras
 * 
 * CARACTERÍSTICAS:
 * - Carga múltiples CSVs que se acumulan
 * - Asignación parcial de cantidades por especie
 * - Tracking de cantidades disponibles vs asignadas
 * - Validación robusta en cada paso
 * - Persistencia en localStorage
 */
export default function ImportCarteraModal({ open, onClose, onSuccess }) {
  // Estados generales
  const [step, setStep] = useState(1); // 1: Cargar CSV, 2: Asignar a fondos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Paso 1: Cargar CSV(s)
  const [especies, setEspecies] = useState([]); // Array de especies con cantidades totales
  
  // Paso 2: Asignación
  const [clientes, setClientes] = useState([]);
  const [fondos, setFondos] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [asignaciones, setAsignaciones] = useState([]); // Array de { especie_id, fondo_id, cantidad, fecha, tipoCambio }
  const [fechaDefault, setFechaDefault] = useState(new Date().toISOString().split('T')[0]);
  const [tipoCambioDefault, setTipoCambioDefault] = useState('');
  const [result, setResult] = useState(null);
  
  // Estado de edición
  const [editingEspecie, setEditingEspecie] = useState(null);
  const [cantidadInput, setCantidadInput] = useState('');

  // Cargar especies desde localStorage al abrir
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('especies_importadas');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setEspecies(parsed.especies || []);
          setAsignaciones(parsed.asignaciones || []);
          if ((parsed.especies || []).length > 0) {
            setStep(2);
          }
        } catch (e) {
          console.error('Error cargando del localStorage:', e);
        }
      }
      fetchTipoCambioActual();
    }
  }, [open]);

  // Cargar clientes cuando se avanza al paso 2
  useEffect(() => {
    if (step === 2 && clientes.length === 0) {
      fetchClientes();
    }
  }, [step]);

  // Cargar fondos cuando se selecciona cliente
  useEffect(() => {
    if (selectedCliente) {
      fetchFondos(selectedCliente);
    } else {
      setFondos([]);
    }
  }, [selectedCliente]);

  // Guardar en localStorage cuando cambian especies o asignaciones
  useEffect(() => {
    if (especies.length > 0) {
      localStorage.setItem('especies_importadas', JSON.stringify({
        especies,
        asignaciones,
        timestamp: new Date().toISOString()
      }));
    }
  }, [especies, asignaciones]);

  const fetchClientes = async () => {
    try {
      const res = await fetch('/api/cliente');
      const data = await res.json();
      if (data.data) {
        const clientesData = data.data.map(c => ({
          id_cliente: c.id,
          nombre: c.name
        }));
        setClientes(clientesData);
      }
    } catch (err) {
      console.error('Error cargando clientes:', err);
    }
  };

  const fetchFondos = async (clienteId) => {
    try {
      const res = await fetch(`/api/fondo?cliente_id=${clienteId}`);
      const data = await res.json();
      if (data.data) {
        const fondosData = data.data.map(f => ({
          id_fondo: f.id,
          nombre: f.nombre,
          tipo_cartera: f.tipo_cartera
        }));
        setFondos(fondosData);
      }
    } catch (err) {
      console.error('Error cargando fondos:', err);
    }
  };

  const fetchTipoCambioActual = async () => {
    try {
      const res = await fetch('/api/tipo-cambio-actual');
      const data = await res.json();
      if (data.success && data.data?.valor) {
        setTipoCambioDefault(data.data.valor.toString());
      }
    } catch (err) {
      console.error('Error cargando tipo de cambio:', err);
    }
  };

  const parseNumber = (str) => {
    if (str == null) return 0;
    const normalized = String(str).replace(',', '.');
    return parseFloat(normalized) || 0;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('El archivo debe ser CSV o Excel');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      if (lines.length < 2) {
        setError('El archivo está vacío');
        setLoading(false);
        return;
      }

      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
      
      console.log('🔍 Delimitador detectado:', delimiter);
      console.log('📋 Headers encontrados:', headers);
      
      const especiesMap = new Map();
      
      // Cargar especies existentes en el Map
      especies.forEach(esp => {
        especiesMap.set(esp.ticker, {
          ticker: esp.ticker,
          cantidad: esp.cantidad,
          monto_total: esp.monto_total,
          moneda: esp.moneda
        });
      });

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(delimiter).map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });

        // Buscar columnas con flexibilidad (case insensitive y variaciones)
        const ticker = (
          row['instrumento'] || 
          row['ticker'] || 
          row['symbol'] ||
          row['especie']
        )?.toUpperCase();
        
        if (!ticker) continue;

        // Detectar qué columna es cantidad y cuál es monto
        let cantidad, montoTotal;
        
        const col1 = parseNumber(row['cantidad'] || row['quantity'] || row['qty']);
        const col2 = parseNumber(row['monto total'] || row['monto'] || row['amount'] || row['total']);
        
        // Si ambas columnas tienen valores por nombre de header
        if (col1 !== 0 && col2 !== 0) {
          cantidad = col1;
          montoTotal = col2;
        } else {
          // Buscar valores numéricos en las columnas intermedias (entre ticker y moneda)
          const nums = [];
          for (let idx = 1; idx < values.length - 1; idx++) {
            const num = parseNumber(values[idx]);
            if (num > 0) nums.push(num);
          }
          
          if (nums.length >= 2) {
            // Heurística inteligente:
            // - Si el primer número es mucho mayor que el segundo, están invertidos
            // - Precio promedio = monto / cantidad
            // - Si precio promedio < 0.01 o > 1000000, probablemente invertido
            
            const [val1, val2] = nums;
            const precioOpcion1 = val2 / val1; // Asumiendo val1=monto, val2=cantidad
            const precioOpcion2 = val1 / val2; // Asumiendo val1=cantidad, val2=monto
            
            // Si opción 1 da precio muy bajo o muy alto, invertir
            if (precioOpcion1 < 0.01 || precioOpcion1 > 1000000) {
              cantidad = val1;
              montoTotal = val2;
            } else {
              // Orden normal: monto primero, cantidad después
              montoTotal = val1;
              cantidad = val2;
            }
            
            console.log(`📊 ${ticker}: Monto=${montoTotal}, Cantidad=${cantidad}, Precio=${(montoTotal/cantidad).toFixed(2)}`);
          } else {
            console.warn(`⚠️ Línea ${i} ignorada: no se encontraron 2 valores numéricos`);
            continue;
          }
        }
        
        const moneda = (
          row['moneda'] || 
          row['currency'] || 
          row['coin'] ||
          values[values.length - 1]
        )?.toUpperCase() || 'ARS';

        if (especiesMap.has(ticker)) {
          const existing = especiesMap.get(ticker);
          existing.cantidad += cantidad;
          existing.monto_total += montoTotal;
        } else {
          especiesMap.set(ticker, {
            ticker,
            cantidad,
            monto_total: montoTotal,
            moneda
          });
        }
      }

      const especiesArray = Array.from(especiesMap.values()).map((esp, idx) => ({
        id: `esp_${esp.ticker}_${Date.now()}`,
        ticker: esp.ticker,
        cantidad: esp.cantidad,
        monto_total: esp.monto_total,
        precio_promedio: esp.cantidad > 0 ? esp.monto_total / esp.cantidad : 0,
        moneda: esp.moneda
      }));

      setEspecies(especiesArray);
      setStep(2);

    } catch (err) {
      console.error('Error procesando CSV:', err);
      setError(`Error procesando archivo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Obtener cantidad disponible de una especie
  const getCantidadDisponible = (especieId) => {
    const especie = especies.find(e => e.id === especieId);
    if (!especie) return 0;
    
    const asignado = asignaciones
      .filter(a => a.especie_id === especieId)
      .reduce((sum, a) => sum + a.cantidad, 0);
    
    return especie.cantidad - asignado;
  };

  // Obtener cantidad asignada a un fondo específico
  const getCantidadAsignada = (especieId, fondoId) => {
    const asig = asignaciones.find(a => a.especie_id === especieId && a.fondo_id === fondoId);
    return asig ? asig.cantidad : 0;
  };

  // Agregar o actualizar asignación
  const handleAsignar = (especieId, fondoId, cantidad) => {
    if (!fondoId || cantidad <= 0) return;

    const disponible = getCantidadDisponible(especieId);
    const yaAsignado = getCantidadAsignada(especieId, fondoId);
    
    if (cantidad > disponible + yaAsignado) {
      setError(`No hay suficiente cantidad disponible. Disponible: ${disponible + yaAsignado}`);
      return;
    }

    setAsignaciones(prev => {
      const filtered = prev.filter(a => !(a.especie_id === especieId && a.fondo_id === fondoId));
      return [
        ...filtered,
        {
          especie_id: especieId,
          fondo_id: fondoId,
          cantidad: cantidad,
          fecha: fechaDefault,
          tipoCambio: parseFloat(tipoCambioDefault)
        }
      ];
    });

    setEditingEspecie(null);
    setCantidadInput('');
    setError('');
  };

  // Eliminar asignación
  const handleEliminarAsignacion = (especieId, fondoId) => {
    setAsignaciones(prev => prev.filter(a => !(a.especie_id === especieId && a.fondo_id === fondoId)));
  };

  // Asignar toda la cantidad disponible
  const handleAsignarTodo = (especieId, fondoId) => {
    const disponible = getCantidadDisponible(especieId);
    if (disponible > 0) {
      handleAsignar(especieId, fondoId, disponible);
    }
  };

  const handleImport = async () => {
    if (asignaciones.length === 0) {
      setError('Debes asignar al menos una especie a un fondo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Agrupar asignaciones por fondo
      const porFondo = {};
      
      asignaciones.forEach(asig => {
        if (!porFondo[asig.fondo_id]) {
          porFondo[asig.fondo_id] = {
            especies: [],
            fecha: asig.fecha,
            tipo_cambio: asig.tipoCambio
          };
        }

        const especie = especies.find(e => e.id === asig.especie_id);
        if (especie) {
          // Calcular precio promedio ponderado para esta cantidad
          const precioPromedio = especie.monto_total / especie.cantidad;
          const montoTotal = precioPromedio * asig.cantidad;

          porFondo[asig.fondo_id].especies.push({
            ticker: especie.ticker,
            cantidad: asig.cantidad,
            monto_total: montoTotal,
            moneda: especie.moneda
          });
        }
      });

      const resultados = [];

      for (const fondoId in porFondo) {
        const grupo = porFondo[fondoId];
        
        // Construir CSV para este fondo
        const csvLines = ['Instrumento;Monto total;Cantidad;Moneda'];
        grupo.especies.forEach(esp => {
          csvLines.push(`${esp.ticker};${esp.monto_total};${esp.cantidad};${esp.moneda}`);
        });
        const csvText = csvLines.join('\n');

        const res = await fetch('/api/cartera/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente_id: parseInt(selectedCliente),
            fondo_id: parseInt(fondoId),
            csvText,
            tipo_cambio: grupo.tipo_cambio,
            fecha_compra: grupo.fecha
          })
        });

        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Error en la importación');
        }

        resultados.push({
          fondo: fondos.find(f => f.id_fondo == fondoId)?.nombre || fondoId,
          especies_count: grupo.especies.length,
          ...data.data.estadisticas
        });
      }

      setResult({
        success: true,
        fondos_actualizados: resultados.length,
        total_especies: asignaciones.length,
        total_movimientos: resultados.reduce((sum, r) => sum + (r.movimientos_creados || 0), 0),
        detalles: resultados
      });

      localStorage.removeItem('especies_importadas');
      if (onSuccess) onSuccess(resultados);

    } catch (err) {
      console.error('Error en importación:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setEspecies([]);
    setAsignaciones([]);
    setSelectedCliente('');
    setFondos([]);
    setResult(null);
    setError('');
    setEditingEspecie(null);
    setCantidadInput('');
    localStorage.removeItem('especies_importadas');
  };

  const handleCargarOtroCSV = () => {
    // Volver al paso 1 pero mantener las especies actuales
    setStep(1);
    setError('');
  };

  if (!open) return null;

  // Calcular estadísticas
  const totalAsignado = asignaciones.reduce((sum, a) => sum + a.cantidad, 0);
  const totalDisponible = especies.reduce((sum, e) => sum + e.cantidad, 0);
  const fondosUnicos = new Set(asignaciones.map(a => a.fondo_id)).size;

  return (
    <div 
      className="modal" 
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="modal-dialog" 
        style={{ maxWidth: '1100px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          padding: '20px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
            <i className="fas fa-file-import"></i> Importar Cartera
            {step === 2 && ` - Asignar a Fondos`}
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
            {step === 1 ? 'Carga archivos CSV (puedes cargar varios)' : 
             `${especies.length} especies | ${totalDisponible.toLocaleString()} títulos totales`}
          </p>
        </header>

        <div className="modal-body" style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '20px',
              borderRadius: '8px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              color: '#c33',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span><i className="fas fa-exclamation-circle"></i> {error}</span>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#c33', cursor: 'pointer', fontSize: '1.2rem' }}>
                ×
              </button>
            </div>
          )}

          {/* PASO 1: Cargar CSV */}
          {step === 1 && !result && (
            <div>
              {especies.length > 0 && (
                <div style={{
                  padding: '16px',
                  marginBottom: '20px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#166534' }}>
                        <i className="fas fa-check-circle"></i> Especies cargadas
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                        {especies.length} especies únicas • {totalDisponible.toLocaleString()} títulos
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar todas las especies cargadas? Esta acción no se puede deshacer.')) {
                            setEspecies([]);
                            setAsignaciones([]);
                            localStorage.removeItem('especies_importadas');
                          }
                        }}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#fff',
                          border: '2px solid #dc2626',
                          color: '#dc2626',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                        title="Eliminar todo y empezar de nuevo"
                      >
                        <i className="fas fa-trash"></i> Limpiar Todo
                      </button>
                      <button
                        onClick={() => setStep(2)}
                        style={{
                          padding: '10px 20px',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        Continuar → Asignar
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#dcfce7' }}>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Ticker</th>
                          <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #bbf7d0' }}>Cantidad</th>
                          <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #bbf7d0' }}>Precio Prom.</th>
                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #bbf7d0' }}>Moneda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {especies.map(esp => (
                          <tr key={esp.id} style={{ borderBottom: '1px solid #f0fdf4' }}>
                            <td style={{ padding: '8px', fontWeight: '600' }}>{esp.ticker}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{esp.cantidad.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{esp.precio_promedio.toFixed(2)}</td>
                            <td style={{ padding: '8px' }}>{esp.moneda}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                backgroundColor: '#f9fafb',
                cursor: 'pointer',
                position: 'relative'
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#667eea';
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
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <div>
                  <i className="fas fa-cloud-upload-alt" style={{ fontSize: '3rem', color: '#9ca3af', marginBottom: '12px' }}></i>
                  <p style={{ margin: '12px 0', fontWeight: '600', fontSize: '1.1rem', color: '#111827' }}>
                    {especies.length > 0 ? 'Cargar otro CSV (se sumará a los existentes)' : 'Arrastra CSV o haz clic para seleccionar'}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                    Formato: Instrumento, Monto total, Cantidad, Moneda
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0369a1', fontSize: '0.95rem' }}>
                  <i className="fas fa-info-circle"></i> Formato esperado
                </h4>
                <pre style={{ 
                  margin: '8px 0 0 0', 
                  padding: '12px',
                  backgroundColor: '#fff',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  overflow: 'auto'
                }}>
{`Instrumento;Monto total;Cantidad;Moneda
AAPL;858880;44;ARS
AAPL_E;1513,86;6;USDC
AL30;905021,4;1059;ARS`}
                </pre>
              </div>
            </div>
          )}

          {/* PASO 2: Asignar a Fondos */}
          {step === 2 && !result && (
            <div>
              {/* Selector de Cliente */}
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  <i className="fas fa-user"></i> Cliente *
                </label>
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id_cliente} value={c.id_cliente}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Botones de acción */}
              <div style={{ 
                marginBottom: '20px', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  <strong>{especies.length}</strong> especies cargadas • 
                  <strong> {asignaciones.length}</strong> asignaciones realizadas
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      if (confirm('¿Eliminar todas las especies y asignaciones? Esta acción no se puede deshacer.')) {
                        setEspecies([]);
                        setAsignaciones([]);
                        localStorage.removeItem('especies_importadas');
                        setStep(1);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#fff',
                      border: '1px solid #dc2626',
                      color: '#dc2626',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                    title="Eliminar todo y empezar de nuevo"
                  >
                    <i className="fas fa-trash"></i> Limpiar Todo
                  </button>
                  <button
                    onClick={handleCargarOtroCSV}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#fff',
                      border: '2px solid #667eea',
                      color: '#667eea',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}
                  >
                    <i className="fas fa-plus"></i> Cargar otro CSV
                  </button>
                </div>
              </div>

              {/* Tabla de especies con asignaciones */}
              <div style={{ 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '700' }}>Especie</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: '700' }}>Total</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: '700' }}>Disponible</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', fontWeight: '700' }}>Precio Prom.</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontWeight: '700' }}>Asignaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {especies.map(esp => {
                      const disponible = getCantidadDisponible(esp.id);
                      const asignacionesEspecie = asignaciones.filter(a => a.especie_id === esp.id);
                      const isEditing = editingEspecie === esp.id;

                      return (
                        <tr key={esp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px', fontWeight: '600', color: '#111827' }}>
                            <div>{esp.ticker}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{esp.moneda}</div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {esp.cantidad.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ 
                            padding: '12px', 
                            textAlign: 'right',
                            color: disponible === 0 ? '#16a34a' : disponible < esp.cantidad * 0.2 ? '#ea580c' : '#111827',
                            fontWeight: '600'
                          }}>
                            {disponible.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {esp.precio_promedio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {/* Asignaciones existentes */}
                              {asignacionesEspecie.map((asig, idx) => {
                                const fondo = fondos.find(f => f.id_fondo == asig.fondo_id);
                                return (
                                  <div key={idx} style={{
                                    padding: '6px 10px',
                                    backgroundColor: '#dcfce7',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '0.85rem'
                                  }}>
                                    <span>
                                      <strong>{fondo?.nombre || 'Fondo desconocido'}</strong>: {asig.cantidad.toLocaleString()}
                                    </span>
                                    <button
                                      onClick={() => handleEliminarAsignacion(esp.id, asig.fondo_id)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        fontSize: '0.9rem'
                                      }}
                                      title="Eliminar asignación"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </div>
                                );
                              })}

                              {/* Form para nueva asignación */}
                              {selectedCliente && fondos.length > 0 && disponible > 0 && !isEditing && (
                                <button
                                  onClick={() => {
                                    setEditingEspecie(esp.id);
                                    setCantidadInput(disponible.toString());
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#eff6ff',
                                    border: '1px dashed #3b82f6',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    color: '#1d4ed8',
                                    fontWeight: '600'
                                  }}
                                >
                                  <i className="fas fa-plus"></i> Asignar
                                </button>
                              )}

                              {isEditing && (
                                <div style={{
                                  padding: '12px',
                                  backgroundColor: '#eff6ff',
                                  borderRadius: '8px',
                                  border: '2px solid #3b82f6'
                                }}>
                                  <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                                      Cantidad a asignar:
                                    </label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input
                                        type="number"
                                        value={cantidadInput}
                                        onChange={(e) => setCantidadInput(e.target.value)}
                                        min="0"
                                        max={disponible}
                                        step="0.01"
                                        style={{
                                          flex: 1,
                                          padding: '6px',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '4px',
                                          fontSize: '0.9rem'
                                        }}
                                      />
                                      <button
                                        onClick={() => setCantidadInput(disponible.toString())}
                                        style={{
                                          padding: '6px 12px',
                                          backgroundColor: '#fff',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem'
                                        }}
                                        title="Usar todo"
                                      >
                                        Todo
                                      </button>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                                      Disponible: {disponible.toLocaleString()}
                                    </div>
                                  </div>

                                  <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                                      Fondo:
                                    </label>
                                    <select
                                      id={`fondo-${esp.id}`}
                                      style={{
                                        width: '100%',
                                        padding: '6px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        fontSize: '0.9rem'
                                      }}
                                    >
                                      <option value="">Seleccionar...</option>
                                      {fondos.map(f => (
                                        <option key={f.id_fondo} value={f.id_fondo}>{f.nombre}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <button
                                      onClick={() => {
                                        const select = document.getElementById(`fondo-${esp.id}`);
                                        const fondoId = select.value;
                                        const cantidad = parseFloat(cantidadInput);
                                        if (fondoId && cantidad > 0) {
                                          handleAsignar(esp.id, fondoId, cantidad);
                                        }
                                      }}
                                      style={{
                                        flex: 1,
                                        padding: '6px 12px',
                                        backgroundColor: '#3b82f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: '600'
                                      }}
                                    >
                                      <i className="fas fa-check"></i> Confirmar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingEspecie(null);
                                        setCantidadInput('');
                                      }}
                                      style={{
                                        padding: '6px 12px',
                                        backgroundColor: '#fff',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen */}
              <div style={{ 
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                borderRadius: '8px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#166534' }}>
                      {especies.length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Especies Totales</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1d4ed8' }}>
                      {asignaciones.length}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Asignaciones</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#7c3aed' }}>
                      {fondosUnicos}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Fondos Únicos</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ea580c' }}>
                      {totalAsignado.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Títulos Asignados</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resultado */}
          {result && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '4rem', color: '#10b981', marginBottom: '16px' }}></i>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>
                  ¡Importación Exitosa!
                </h3>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Las especies han sido asignadas a los fondos
                </p>
              </div>

              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1d4ed8' }}>
                    {result.fondos_actualizados}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Fondos Actualizados</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#166534' }}>
                    {result.total_especies}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Especies Importadas</div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', fontWeight: '700', color: '#92400e' }}>
                    {result.total_movimientos}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Movimientos Creados</div>
                </div>
              </div>

              {result.detalles && result.detalles.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600' }}>
                    Detalle por Fondo
                  </h4>
                  {result.detalles.map((det, idx) => (
                    <div key={idx} style={{
                      padding: '12px 16px',
                      marginBottom: '8px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        <i className="fas fa-folder"></i> {det.fondo}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                        {det.especies_count || 0} especies • {det.movimientos_creados || 0} movimientos
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="modal-footer" style={{ 
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {!result ? (
            <>
              <button
                onClick={step === 1 ? onClose : () => setStep(1)}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {step === 1 ? 'Cancelar' : '← Volver'}
              </button>
              
              {step === 2 && (
                <button
                  onClick={handleImport}
                  disabled={loading || asignaciones.length === 0}
                  style={{
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    background: asignaciones.length > 0 ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#d1d5db',
                    color: '#fff',
                    cursor: asignaciones.length > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: '700',
                    fontSize: '1rem'
                  }}
                >
                  {loading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Importando...</>
                  ) : (
                    <><i className="fas fa-upload"></i> Importar ({asignaciones.length} asignaciones)</>
                  )}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cerrar
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '700'
                }}
              >
                <i className="fas fa-plus"></i> Nueva Importación
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}