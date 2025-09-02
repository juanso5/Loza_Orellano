"use client";
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import CSVMovimientos from '../../components/CSVMovimientos';

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
      <Sidebar collapsed={collapsed} toggleSidebar={() => {
        setCollapsed(c => {
          const next = !c; try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); } catch {}
          return next;
        });
      }} />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`} style={{ padding: 20 }}>
        <CSVMovimientos />
      </div>
    </>
  );
}