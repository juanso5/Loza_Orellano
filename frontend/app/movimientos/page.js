"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '../../components/Sidebar';

// Carga diferida del módulo pesado (CSVMovimientos) para acelerar TTI y evitar bloquear el hilo principal
const MovimientosModule = dynamic(() => import('../../components/CSVMovimientos'), {
  loading: () => <div style={{ padding: 20 }}>Cargando Movimientos…</div>,
  ssr: false,
});

export default function Movimientos() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) setCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        toggleSidebar={() => {
          setCollapsed((c) => {
            const next = !c;
            try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); } catch {}
            return next;
          });
        }}
      />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`} style={{ padding: 20 }}>
        <MovimientosModule />
      </div>
    </>
  );
}