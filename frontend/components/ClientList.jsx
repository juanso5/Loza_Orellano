// components/ClientList.jsx
import React from 'react';

const ClientList = ({ clients, searchQuery, selectedClientId, onSelectClient }) => {
  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    if (c.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    return c.portfolios.some((p) => p.funds.some((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())));
  });

  const initials = (name = '') => name.split(' ').map((p) => p[0] || '').slice(0, 2).join('').toUpperCase();

  return (
    <div id="clients-list" className="clients-list card-body" aria-live="polite">
      {filteredClients.map((c) => (
        <div
          key={c.id}
          className={`client-row ${c.id === selectedClientId ? 'active' : ''}`}
          onClick={() => onSelectClient(c.id)}
        >
          <div className="client-avatar">{initials(c.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="client-name">{c.name}</div>
            <div className="client-meta">Carteras: {c.portfolios.length} · Movs: {c.movements.length}</div>
          </div>
          <div className="client-chevron"><i className="fas fa-chevron-right"></i></div>
        </div>
      ))}
    </div>
  );
};

export default ClientList;