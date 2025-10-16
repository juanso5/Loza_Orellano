"use client";
import { useState, useEffect } from "react";
import SidebarProvider from "../../components/SidebarProvider";
import LiquidezSummaryCard from "../../components/liquidez/LiquidezSummaryCard";
import FondoCard from "../../components/liquidez/FondoCard";
import MovimientoModal from "../../components/liquidez/MovimientoModal";
import AsignacionModal from "../../components/liquidez/AsignacionModal";
import { LoadingSpinner } from "../../components/ui";
import { useAppData } from "../../components/AppDataProvider";
import "../../styles/liquidez.css";
export default function LiquidezPage() {
  const { clientes, selectedClientId, setSelectedClientId, liquidez: estadoLiquidez, loading, error, refreshAll } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [movimientosLiquidez, setMovimientosLiquidez] = useState([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(false);
  useEffect(() => {
    if (!selectedClientId) {
      setMovimientosLiquidez([]);
      return;
    }
    setLoadingMovimientos(true);
    fetch(`/api/liquidez?cliente_id=${selectedClientId}&limit=20`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (json.success) setMovimientosLiquidez(json.data || []); })
      .catch(err => {/* Error al cargar movimientos */})
      .finally(() => setLoadingMovimientos(false));
  }, [selectedClientId]);
  const [modalState, setModalState] = useState({ 
    movimiento: { isOpen: false, tipo: "deposito" }, 
    asignacion: { isOpen: false, fondo: null }
  });
  const openMovimientoModal = (tipo) => setModalState(prev => ({ ...prev, movimiento: { isOpen: true, tipo } }));
  const closeMovimientoModal = () => setModalState(prev => ({ ...prev, movimiento: { isOpen: false, tipo: "deposito" } }));
  const openAsignacionModal = (fondo) => setModalState(prev => ({ ...prev, asignacion: { isOpen: true, fondo } }));
  const closeAsignacionModal = () => setModalState(prev => ({ ...prev, asignacion: { isOpen: false, fondo: null } }));
  const handleMovimientoSave = async () => {
    await refreshAll();
    if (selectedClientId) {
      const res = await fetch(`/api/liquidez?cliente_id=${selectedClientId}&limit=20`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setMovimientosLiquidez(json.data || []);
    }
    closeMovimientoModal();
  };
  const handleAsignacionSave = async () => {
    await refreshAll();
    if (selectedClientId) {
      const res = await fetch(`/api/liquidez?cliente_id=${selectedClientId}&limit=20`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setMovimientosLiquidez(json.data || []);
    }
    closeAsignacionModal();
  };
  const clienteActual = clientes.find(c => c.id === selectedClientId);
  const filteredClientes = clientes.filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  return (
    <SidebarProvider>
      <div className="main-content">
        {/* Panel de clientes estilo Fondos */}
        <div style={{ 
          width: '300px', 
          backgroundColor: '#f9fafb', 
          borderRight: '1px solid #e5e7eb', 
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>Clientes</h2>
            <input 
              type="text" 
              placeholder="🔍 Buscar cliente..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={{ 
                width: '100%', 
                padding: '0.625rem 0.875rem', 
                border: '1px solid #d1d5db', 
                borderRadius: '8px', 
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
            {loading.clientes ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  border: '3px solid #e5e7eb', 
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 0.5rem'
                }}></div>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>Cargando...</p>
              </div>
            ) : filteredClientes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>No hay clientes</p>
              </div>
            ) : (
              filteredClientes.map((c) => {
                const isSelected = c.id === selectedClientId;
                const initials = c.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                return (
                  <div 
                    key={c.id} 
                    onClick={() => setSelectedClientId(c.id)}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.875rem',
                      cursor: 'pointer', 
                      borderRadius: '8px', 
                      marginBottom: '0.5rem',
                      backgroundColor: isSelected ? '#eff6ff' : '#fff',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 1px 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#3b82f6' : '#e5e7eb',
                      color: isSelected ? '#fff' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      flexShrink: 0
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: isSelected ? '600' : '500',
                        fontSize: '0.9375rem',
                        color: '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {c.name}
                      </div>
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        <i className="fas fa-wallet" style={{ marginRight: '0.25rem' }}></i> Liquidez
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{ color: '#3b82f6', fontSize: '1rem', fontWeight: 'bold' }}><i className="fas fa-check"></i></div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="content-panel">
          <div className="page-header">
            <div>
              <h1 className="page-title"><i className="fas fa-money-bill-wave"></i> Gestión de Liquidez</h1>
              {clienteActual && <p className="page-subtitle">{clienteActual.name}</p>}
            </div>
            <div className="action-buttons">
              <button className="btn primary" onClick={() => openMovimientoModal("deposito")} disabled={!selectedClientId || loading.liquidez}><i className="fas fa-plus-circle"></i> Nuevo Depósito</button>
              <button className="btn danger" onClick={() => openMovimientoModal("extraccion")} disabled={!selectedClientId || loading.liquidez}><i className="fas fa-minus-circle"></i> Nueva Extracción</button>
            </div>
          </div>
          {error && <div className="error-message"><i className="fas fa-exclamation-triangle"></i> {error}</div>}
          {loading.liquidez && <LoadingSpinner text="Cargando datos de liquidez..." />}
          {!loading.liquidez && selectedClientId && (
            <>
              <LiquidezSummaryCard estado={estadoLiquidez} loading={loading.liquidez} />
              {estadoLiquidez?.fondos && estadoLiquidez.fondos.length > 0 && (
                <div className="section">
                  <h2 className="section-title"><i className="fas fa-chart-bar"></i> Fondos del Cliente</h2>
                  <div className="fondos-grid">
                    {estadoLiquidez.fondos.map((fondo) => (
                      <FondoCard 
                        key={fondo.id_fondo} 
                        fondo={{ 
                          ...fondo, 
                          dineroEnAcciones: fondo.dineroInvertido,
                          liquidez_asignada: fondo.liquidezAsignada,
                          saldo_disponible: fondo.saldoDisponible,
                          progreso_porcentaje: fondo.porcentajeInvertido,
                          valor_total_fondo: fondo.liquidezAsignada,
                          rendimiento_porcentaje: fondo.rend_esperado || 0
                        }} 
                        onAsignar={openAsignacionModal}
                      />
                    ))}
                  </div>
                </div>
              )}
              {movimientosLiquidez.length > 0 && (
                <div className="section">
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                  }}>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: '1.5rem', 
                      fontWeight: '700', 
                      color: '#111827',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
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
                        <i className="fas fa-history"></i>
                      </div>
                      Últimos Movimientos
                    </h2>
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#f3f4f6',
                      border: '1px solid #e5e7eb',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#6b7280'
                    }}>
                      {movimientosLiquidez.length} movimiento{movimientosLiquidez.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse'
                      }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-calendar" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Fecha
                            </th>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-tag" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Tipo
                            </th>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'right',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-coins" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Monto
                            </th>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-dollar-sign" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Moneda
                            </th>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'right',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-money-bill-wave" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Monto USD
                            </th>
                            <th style={{
                              padding: '1rem 1.5rem',
                              textAlign: 'left',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              <i className="fas fa-comment" style={{ marginRight: '8px', color: '#9ca3af' }}></i>
                              Comentario
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientosLiquidez.map((mov, index) => {
                            const esDeposito = mov.tipo_mov === "deposito";
                            return (
                              <tr 
                                key={mov.id_mov_liq}
                                style={{
                                  borderBottom: index !== movimientosLiquidez.length - 1 ? '1px solid #f3f4f6' : 'none',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <td style={{
                                  padding: '1.25rem 1.5rem',
                                  fontSize: '0.9375rem',
                                  color: '#111827',
                                  fontWeight: '500'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '8px',
                                      background: esDeposito ? '#dcfce7' : '#fee2e2',
                                      border: esDeposito ? '1px solid #86efac' : '1px solid #fca5a5',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: esDeposito ? '#166534' : '#991b1b',
                                      fontSize: '0.875rem'
                                    }}>
                                      <i className={`fas fa-${esDeposito ? 'arrow-down' : 'arrow-up'}`}></i>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.9375rem', fontWeight: '600', color: '#111827' }}>
                                        {new Date(mov.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                        {new Date(mov.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem' }}>
                                  <span style={{
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.8125rem',
                                    fontWeight: '700',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: esDeposito ? 'linear-gradient(135deg, #dcfce7 0%, #a7f3d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                                    color: esDeposito ? '#065f46' : '#991b1b',
                                    border: esDeposito ? '1px solid #86efac' : '1px solid #fca5a5'
                                  }}>
                                    <i className={`fas fa-${esDeposito ? 'plus' : 'minus'}-circle`}></i>
                                    {esDeposito ? 'Depósito' : 'Extracción'}
                                  </span>
                                </td>
                                <td style={{
                                  padding: '1.25rem 1.5rem',
                                  textAlign: 'right',
                                  fontSize: '1rem',
                                  fontWeight: '700',
                                  color: '#111827'
                                }}>
                                  {mov.moneda === 'USD' ? '$' : 'AR$'}{mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{
                                  padding: '1.25rem 1.5rem',
                                  textAlign: 'center'
                                }}>
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    fontWeight: '700',
                                    background: mov.moneda === 'USD' ? '#dbeafe' : '#fef3c7',
                                    color: mov.moneda === 'USD' ? '#1e40af' : '#92400e',
                                    border: mov.moneda === 'USD' ? '1px solid #93c5fd' : '1px solid #fde68a'
                                  }}>
                                    {mov.moneda}
                                  </span>
                                </td>
                                <td style={{
                                  padding: '1.25rem 1.5rem',
                                  textAlign: 'right',
                                  fontSize: '0.9375rem',
                                  fontWeight: '700',
                                  color: '#3b82f6'
                                }}>
                                  ${mov.monto_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{
                                  padding: '1.25rem 1.5rem',
                                  fontSize: '0.875rem',
                                  color: '#6b7280',
                                  maxWidth: '250px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {mov.comentario ? (
                                    <span title={mov.comentario} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <i className="fas fa-sticky-note" style={{ color: '#9ca3af', fontSize: '0.75rem' }}></i>
                                      {mov.comentario}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Sin comentario</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              {!loadingMovimientos && movimientosLiquidez.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon"><i className="fas fa-chart-line" style={{ fontSize: '48px', color: '#9ca3af' }}></i></div>
                  <h3 className="empty-state-title">No hay movimientos registrados</h3>
                  <p className="empty-state-description">Crea un depósito para comenzar a gestionar la liquidez de {clienteActual?.name}</p>
                </div>
              )}
            </>
          )}
          {!loading.liquidez && !selectedClientId && (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="fas fa-user-circle" style={{ fontSize: '48px', color: '#9ca3af' }}></i></div>
              <h3 className="empty-state-title">Selecciona un cliente</h3>
              <p className="empty-state-description">Elige un cliente de la lista para ver su estado de liquidez</p>
            </div>
          )}
        </div>
      </div>
      <MovimientoModal isOpen={modalState.movimiento.isOpen} onClose={closeMovimientoModal} onSave={handleMovimientoSave} clienteId={selectedClientId} tipo={modalState.movimiento.tipo} />
      <AsignacionModal isOpen={modalState.asignacion.isOpen} onClose={closeAsignacionModal} onSave={handleAsignacionSave} clienteId={selectedClientId} fondo={modalState.asignacion.fondo || {}} />
    </SidebarProvider>
  );
}
