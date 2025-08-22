// components/Sidebar.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { useRouter } from 'next/navigation';
// Using global sidebar.css styles (legacy like)

export default function Sidebar({ collapsed: collapsedProp, toggleSidebar: toggleProp }) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsedControlled = typeof collapsedProp !== 'undefined';
  const collapsed = collapsedControlled ? collapsedProp : internalCollapsed;


  useEffect(() => {
    // initialize collapsed from localStorage if not controlled by props
    if (!collapsedControlled) {
      try {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved !== null) setInternalCollapsed(JSON.parse(saved));
      } catch (e) {
        // ignore (SSR safety)
      }
    }
  }, [collapsedControlled]);

  useEffect(() => {
    // if props change, leave to parent (handled by collapsedControlled)
    // nothing to do here
  }, [collapsedProp]);

  const toggle = () => {
    if (toggleProp) return toggleProp();
    setInternalCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const isActive = (path) => {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(path + '/');
  };

  // (Submenús eliminados; ya no se requiere estado de submenús)

  return (
    <div id="sidebar" className={`sidebar ${collapsed ? 'collapsed' : ''}`}>      
      <button id="sidebar-toggle" className="sidebar-toggle" onClick={toggle} aria-expanded={!collapsed} aria-label="Alternar sidebar">
        <i className="fas fa-bars" />
      </button>
      <ul>
        <li className={isActive('/home') ? 'active' : ''}>
          <Link href="/home"><i className="fas fa-home" /> <span className="menu-text">Inicio</span></Link>
        </li>
        <li className={isActive('/cliente') ? 'active' : ''}>
          <Link href="/cliente"><i className="fas fa-users" /> <span className="menu-text">Clientes</span></Link>
        </li>
        <li className={isActive('/movimientos') ? 'active' : ''}>
          <Link href="/movimientos"><i className="fas fa-exchange-alt" /> <span className="menu-text">Movimientos</span></Link>
        </li>
        <li className={isActive('/fondos') ? 'active' : ''}>
          <Link href="/fondos"><i className="fas fa-wallet" /> <span className="menu-text">Fondos</span></Link>
        </li>
        <li>
          <button
            onClick={async () => { const sb = getSupabaseBrowserClient(); if (sb) { await sb.auth.signOut(); } router.replace('/login'); }}
            style={{ background:'transparent', border:'none', color:'inherit', width:'100%', textAlign:'left', padding:'10px 16px', cursor:'pointer' }}
          >
            <i className="fas fa-sign-out-alt" /> <span className="menu-text">Salir</span>
          </button>
        </li>
  {/* Ruta de rendimientos aún no implementada */}
      </ul>
    </div>
  );
}
