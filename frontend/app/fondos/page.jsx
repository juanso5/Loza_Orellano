"use client";
import React, { useState, useEffect } from 'react';
import SidebarProvider from '../../components/SidebarProvider'; // Asumiendo que tienes un componente para el sidebar
import ClientList from '../../components/ClientList'; // Nuevo componente para la lista de clientes
import ClientDetail from '../../components/ClientDetail'; // Nuevo componente para el detalle del cliente
import MovementModal from '../../components/MovementModal'; // Modal para nuevo movimiento
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'; // Modal para confirmar eliminación
import AddPortfolioModal from '../../components/AddPortfolioModal'; // Modal para agregar cartera
import PortfolioDetailModal from '../../components/PortfolioDetailModal'; // Modal para detalle de cartera
import SpeciesHistoryModal from '../../components/SpeciesHistoryModal'; // Modal para historial de especie

const LS_KEY = 'fondos_app_v2';

const FondosPage = () => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isAddPortfolioOpen, setIsAddPortfolioOpen] = useState(false);
  const [isPortfolioDetailOpen, setIsPortfolioDetailOpen] = useState(false);
  const [portfolioModalContext, setPortfolioModalContext] = useState({ clientId: null, portfolioId: null });
  const [isSpeciesHistoryOpen, setIsSpeciesHistoryOpen] = useState(false);
  const [speciesHistoryContext, setSpeciesHistoryContext] = useState({ clientId: null, portfolioId: null, fundName: null });

  useEffect(() => {
    const loaded = loadFromLS();
    setClients(loaded || demoData());
    if (loaded && loaded.length > 0) {
      setSelectedClientId(loaded[0].id);
    }
  }, []);

  useEffect(() => {
    if (clients.length > 0) {
      saveToLS(clients);
    }
  }, [clients]);

  const saveToLS = (data) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn(e);
    }
  };

  const loadFromLS = () => {
    try {
      const r = localStorage.getItem(LS_KEY);
      return r ? JSON.parse(r) : null;
    } catch (e) {
      return null;
    }
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleSelectClient = (id) => {
    setSelectedClientId(id);
  };

  const handleSaveMovement = (newMovement) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === newMovement.clientId
          ? {
              ...c,
              movements: [...c.movements, newMovement.movement],
              portfolios: newMovement.updatedPortfolios,
            }
          : c
      )
    );
    setIsMovementModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!pendingDeleteId || !selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;
    const updatedMovements = client.movements.filter((m) => m.id !== pendingDeleteId);
    const updatedClient = { ...client, movements: updatedMovements };
    rebuildFundsFromMovements(updatedClient);
    setClients((prev) => prev.map((c) => (c.id === selectedClientId ? updatedClient : c)));
    setIsConfirmDeleteOpen(false);
    setPendingDeleteId(null);
  };

  const rebuildFundsFromMovements = (client) => {
    client.portfolios.forEach((p) => p.funds.forEach((f) => (f.nominal = 0)));
    client.movements.forEach((mov) => {
      const p = client.portfolios.find((x) => x.name === mov.portfolio);
      if (!p) return;
      let f = p.funds.find((x) => x.name.toLowerCase() === mov.fund.toLowerCase());
      if (!f) {
        f = { id: uid('f'), name: mov.fund, nominal: 0, monthlyReturn: 0, totalReturn: 0 };
        p.funds.push(f);
      }
      f.nominal += mov.type === 'compra' ? mov.amount : -mov.amount;
    });
    client.portfolios.forEach((p) => (p.funds = p.funds.filter((f) => f.nominal > 0)));
  };

  const handleAddPortfolio = (newPortfolio) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === selectedClientId ? { ...c, portfolios: [...c.portfolios, newPortfolio] } : c
      )
    );
    setIsAddPortfolioOpen(false);
  };

  const handleSavePortfolioEdits = (updatedPortfolio) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === portfolioModalContext.clientId
          ? {
              ...c,
              portfolios: c.portfolios.map((p) =>
                p.id === portfolioModalContext.portfolioId ? updatedPortfolio : p
              ),
            }
          : c
      )
    );
    setIsPortfolioDetailOpen(false);
  };

  const uid = (pref = 'id') => `${pref}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const demoData = () => [
    // ... (copia el demoData del JS original aquí)
    {
      id: 'c-1',
      name: 'María González',
      description: 'Perfil conservador - Objetivo: Preservación de capital',
      portfolios: [
        {
          id: 'p-1',
          name: 'Fondo Retiro',
          periodMonths: 120,
          progress: 0.35,
          funds: [
            { id: 'f-1', name: 'YPF', nominal: 50000, monthlyReturn: 0.012, totalReturn: 0.1625 },
            { id: 'f-2', name: 'Bonos CER', nominal: 30000, monthlyReturn: 0.006, totalReturn: 0.10 },
            { id: 'f-3', name: 'Dólar MEP', nominal: 20000, monthlyReturn: 0.008, totalReturn: 0.15 }
          ]
        },
        {
          id: 'p-2',
          name: 'Fondo Auto',
          periodMonths: 36,
          progress: 0.6,
          funds: [
            { id: 'f-4', name: 'Acciones Tech', nominal: 10000, monthlyReturn: 0.025, totalReturn: 0.45 },
            { id: 'f-5', name: 'FCI Renta Fija', nominal: 15000, monthlyReturn: 0.007, totalReturn: 0.12 }
          ]
        }
      ],
      movements: [
        { id: 'm1', date: '2023-07-15', type: 'compra', fund: 'YPF', portfolio: 'Fondo Retiro', amount: 10000 },
        { id: 'm2', date: '2023-06-01', type: 'compra', fund: 'Bonos CER', portfolio: 'Fondo Retiro', amount: 30000 },
        { id: 'm3', date: '2023-05-20', type: 'compra', fund: 'Dólar MEP', portfolio: 'Fondo Retiro', amount: 20000 }
      ]
    },
    {
      id: 'c-2',
      name: 'Juan Pérez',
      description: 'Perfil agresivo - Objetivo: Crecimiento acelerado',
      portfolios: [
        {
          id: 'p-3',
          name: 'Fondo Crecimiento',
          periodMonths: 48,
          progress: 0.2,
          funds: [
            { id: 'f-6', name: 'Acciones USA', nominal: 80000, monthlyReturn: 0.018, totalReturn: 0.30 },
            { id: 'f-7', name: 'ETF Global', nominal: 20000, monthlyReturn: 0.01, totalReturn: 0.12 }
          ]
        }
      ],
      movements: [
        { id: 'm4', date: '2023-07-20', type: 'compra', fund: 'Acciones USA', portfolio: 'Fondo Crecimiento', amount: 50000 }
      ]
    }
  ];

  const formatNumber = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

  return (
    <SidebarProvider>
      <div className="main-content" id="main-content">
        <div className="main-inner">
          <header className="top-header">
            <div className="top-row">
              <div className="header-title">
                <h1>Fondos por Cliente</h1>
                <p className="muted">Visualización de carteras, rendimientos y movimientos por cliente</p>
              </div>
              <div className="top-controls">
                <button className="btn-add" onClick={() => setIsMovementModalOpen(true)}>
                  <i className="fas fa-plus-circle"></i> Nuevo Movimiento
                </button>
              </div>
            </div>
          </header>

          <div className="fondos-layout">
            <aside className="clients-column card">
              <div className="card-header">
                <div className="search-wrapper" style={{ marginBottom: '8px' }}>
                  <i className="fas fa-search search-icon" aria-hidden="true"></i>
                  <input
                    className="search-input"
                    placeholder="Buscar cliente o especie..."
                    aria-label="Buscar cliente o especie"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <ClientList
                clients={clients}
                searchQuery={searchQuery}
                selectedClientId={selectedClientId}
                onSelectClient={handleSelectClient}
              />
            </aside>

            <section className="client-detail card">
              {selectedClient ? (
                <ClientDetail
                  client={selectedClient}
                  onAddPortfolio={() => setIsAddPortfolioOpen(true)}
                  onDeleteMovement={(id) => {
                    setPendingDeleteId(id);
                    setIsConfirmDeleteOpen(true);
                  }}
                  onOpenPortfolioDetail={(portfolioId) => {
                    setPortfolioModalContext({ clientId: selectedClientId, portfolioId });
                    setIsPortfolioDetailOpen(true);
                  }}
                  onOpenSpeciesHistory={(portfolioId, fundName) => {
                    setSpeciesHistoryContext({ clientId: selectedClientId, portfolioId, fundName });
                    setIsSpeciesHistoryOpen(true);
                  }}
                />
              ) : (
                <div className="client-placeholder">
                  <div className="placeholder-content">
                    <i className="fas fa-user-circle" style={{ fontSize: '48px', color: '#c7d2da' }}></i>
                    <p>Seleccioná un cliente para ver sus carteras y movimientos</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {isMovementModalOpen && (
        <MovementModal
          clients={clients}
          selectedClientId={selectedClientId}
          onClose={() => setIsMovementModalOpen(false)}
          onSave={handleSaveMovement}
          uid={uid}
        />
      )}

      {isConfirmDeleteOpen && (() => {
        const movement = selectedClient?.movements.find((m) => m.id === pendingDeleteId);
        const text = movement
          ? `Eliminar movimiento ${movement.type} por ${formatNumber(movement.amount)} en ${movement.fund}?`
          : '¿Eliminar movimiento seleccionado?';
        return (
          <ConfirmDeleteModal
            open={isConfirmDeleteOpen}
            onCancel={() => setIsConfirmDeleteOpen(false)}
            onConfirm={handleConfirmDelete}
            text={text}
          />
        );
      })()}

      {isAddPortfolioOpen && (
        <AddPortfolioModal
          onClose={() => setIsAddPortfolioOpen(false)}
          onSave={handleAddPortfolio}
          uid={uid}
        />
      )}

      {isPortfolioDetailOpen && (
        <PortfolioDetailModal
          clients={clients}
          context={portfolioModalContext}
          onClose={() => setIsPortfolioDetailOpen(false)}
          onSave={handleSavePortfolioEdits}
          onOpenSpeciesHistory={(fundName) => {
            setSpeciesHistoryContext({ ...portfolioModalContext, fundName });
            setIsSpeciesHistoryOpen(true);
          }}
        />
      )}

      {isSpeciesHistoryOpen && (
        <SpeciesHistoryModal
          clients={clients}
          context={speciesHistoryContext}
          onClose={() => setIsSpeciesHistoryOpen(false)}
        />
      )}
    </SidebarProvider>
  );
};

export default FondosPage;