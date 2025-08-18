'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) setCollapsed(JSON.parse(saved));
  }, []);

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div style={{display: 'flex'}}>
      <Sidebar collapsed={collapsed} toggleSidebar={toggleSidebar} />
      <main style={{flex: 1}}>
        {children}
      </main>
    </div>
  );
}
