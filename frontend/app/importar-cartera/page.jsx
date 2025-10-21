'use client';
import { useState } from 'react';
import Sidebar from 'components/Sidebar';
import ImportCarteraModal from 'components/ImportCarteraModal';
import { useLocalStorageState } from '@/lib/hooks';

export default function ImportCarteraPage() {
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSuccess = (result) => {
    console.log('Importación exitosa:', result);
    // Aquí podrías redirigir o mostrar notificación
  };

  return (
    <>
      <div id="sidebar-container">
        <Sidebar collapsed={collapsed} toggleSidebar={() => setCollapsed(c => !c)} />
      </div>

      <div className={`main-content ${collapsed ? 'expanded' : ''}`}>
        <div className="main-inner" style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          {/* Header */}
          <div style={{ 
            textAlign: 'center',
            marginBottom: '40px',
            paddingBottom: '30px',
            borderBottom: '2px solid #f1f3f5'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 20px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)'
            }}>
              <i className="fas fa-file-import" style={{ fontSize: '2.5rem', color: '#fff' }}></i>
            </div>
            <h1 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '2.5rem', 
              fontWeight: '800',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Importación de Carteras
            </h1>
            <p style={{ 
              margin: 0, 
              fontSize: '1.1rem', 
              color: '#6b7280',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Carga masiva de tenencias desde archivos CSV o Excel de Inviu
            </p>
          </div>

          {/* Características */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '24px',
            marginBottom: '40px'
          }}>
            {[
              {
                icon: 'fa-bolt',
                color: '#f59e0b',
                title: 'Importación Rápida',
                desc: 'Procesa cientos de especies en segundos'
              },
              {
                icon: 'fa-chart-line',
                color: '#10b981',
                title: 'Cálculo Automático',
                desc: 'Promedio ponderado y agrupación inteligente'
              },
              {
                icon: 'fa-shield-alt',
                color: '#3b82f6',
                title: 'Validación Completa',
                desc: 'Verifica formato, cliente, fondo y especies'
              },
              {
                icon: 'fa-database',
                color: '#8b5cf6',
                title: 'Actualización Directa',
                desc: 'Crea movimientos y actualiza tenencias'
              }
            ].map((feature, i) => (
              <div key={i} style={{
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                backgroundColor: '#fff',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
              }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: `${feature.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <i className={`fas ${feature.icon}`} style={{ fontSize: '1.5rem', color: feature.color }}></i>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '700', color: '#111827' }}>
                  {feature.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280', lineHeight: '1.5' }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Proceso */}
          <div style={{
            padding: '32px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
            border: '2px solid #667eea30',
            marginBottom: '40px'
          }}>
            <h2 style={{ 
              margin: '0 0 24px 0', 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center'
            }}>
              <i className="fas fa-list-ol"></i> ¿Cómo funciona?
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {[
                { num: 1, text: 'Selecciona cliente y fondo' },
                { num: 2, text: 'Sube archivo CSV/Excel' },
                { num: 3, text: 'Define fecha y tipo de cambio' },
                { num: 4, text: 'Importa y listo!' }
              ].map((step) => (
                <div key={step.num} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '1.2rem',
                    flexShrink: 0
                  }}>
                    {step.num}
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#374151' }}>
                    {step.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Botón principal */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setModalOpen(true)}
              style={{
                padding: '16px 40px',
                fontSize: '1.1rem',
                fontWeight: '700',
                border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 25px 50px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(102, 126, 234, 0.3)';
              }}
            >
              <i className="fas fa-upload" style={{ fontSize: '1.3rem' }}></i>
              Iniciar Importación
            </button>
          </div>

          {/* Requisitos */}
          <div style={{
            marginTop: '60px',
            padding: '24px',
            borderRadius: '12px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              fontWeight: '700',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <i className="fas fa-file-csv" style={{ color: '#10b981' }}></i>
              Formato del archivo
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#6b7280' }}>
              El archivo debe tener las siguientes columnas:
            </p>
            <div style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: '#111827',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              overflowX: 'auto'
            }}>
              <div style={{ color: '#10b981' }}>
                Instrumento;Monto total;Cantidad;Moneda
              </div>
              <div style={{ color: '#9ca3af', marginTop: '4px' }}>
                AAPL;858880;44;ARS
              </div>
              <div style={{ color: '#9ca3af' }}>
                AAPL_E;1513,86;6;USDC
              </div>
              <div style={{ color: '#9ca3af' }}>
                AL30;905021,4;1059;ARS
              </div>
            </div>
            <div style={{ marginTop: '16px', fontSize: '0.85rem', color: '#6b7280' }}>
              <p style={{ margin: '4px 0' }}>
                ✓ Delimitador: Coma (,) o punto y coma (;)
              </p>
              <p style={{ margin: '4px 0' }}>
                ✓ Decimales: Coma (,) o punto (.)
              </p>
              <p style={{ margin: '4px 0' }}>
                ✓ Especies extranjeras: Usar sufijo _E (ej: AAPL_E)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ImportCarteraModal 
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}