"use client";
import dynamic from 'next/dynamic';
import Sidebar from '../../components/Sidebar';
import { useLocalStorageState } from '@/lib/hooks';
// Carga diferida del módulo pesado (CSVMovimientos) para acelerar TTI y evitar bloquear el hilo principal
const MovimientosModule = dynamic(() => import('../../components/CSVMovimientos'), {
  loading: () => <div style={{ padding: 20 }}>Cargando Movimientos…</div>,
  ssr: false,
});
export default function Movimientos() {
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  return (
    <>
      <Sidebar
        collapsed={collapsed}
        toggleSidebar={() => setCollapsed(c => !c)}
      />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`} style={{ padding: 20 }}>
        <MovimientosModule />
      </div>
    </>
  );
}