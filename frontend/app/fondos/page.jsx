"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import SidebarProvider from "../../components/SidebarProvider";
import { MovementsProvider, useMovements } from "../../components/MovementsProvider";
import ClientList from "../../components/ClientList";
import ClientDetail from "../../components/ClientDetail";
import MovementModal from "../../components/MovementModal";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import AddPortfolioModal from "../../components/AddPortfolioModal";
import TenenciasFondoModal from "../../components/TenenciasFondoModal";
import DetalleEspecieModal from "../../components/DetalleEspecieModal";
import SpeciesHistoryModal from "../../components/SpeciesHistoryModal";
// Utilities
import { toISODateTimeLocal } from "@/lib/utils/dateUtils";
import { clamp01 } from "@/lib/utils/formatters";
import { computeProgress, signedAmount, aggregateFundsByPortfolio } from "@/lib/fondoHelpers";
const FondosPageContent = () => {
  const { pricesMap, normalizeSimple } = useMovements();
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isAddPortfolioOpen, setIsAddPortfolioOpen] = useState(false);
  const [isPortfolioDetailOpen, setIsPortfolioDetailOpen] = useState(false);
  const [portfolioModalContext, setPortfolioModalContext] = useState({
    clientId: null,
    portfolioId: null,
  });
  const [isSpeciesHistoryOpen, setIsSpeciesHistoryOpen] = useState(false);
  const [speciesHistoryContext, setSpeciesHistoryContext] = useState({
    clientId: null,
    portfolioId: null,
    fundName: null,
  });
  const [isDetalleEspecieOpen, setIsDetalleEspecieOpen] = useState(false);
  const [detalleEspecieContext, setDetalleEspecieContext] = useState({
    fondo: null,
    especie: null,
  });
  // 1) Cargar clientes
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/cliente", { cache: "no-store" });
        const j = await r.json();
        const list = Array.isArray(j?.data) ? j.data : [];
        const enriched = list.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.riskProfile || "",
          portfolios: [],
          movements: [],
        }));
        setClients(enriched);
        if (enriched.length > 0) setSelectedClientId(enriched[0].id);
      } catch (e) {
        }
    })();
  }, []);
  // 2) Cargar carteras y movimientos del cliente seleccionado
  useEffect(() => {
    if (!selectedClientId) return;
    (async () => {
      try {
        // Carteras
        const rf = await fetch(`/api/fondo?cliente_id=${selectedClientId}`, {
          cache: "no-store",
        });
        const jf = await rf.json();
        const rows = Array.isArray(jf?.data) ? jf.data : [];
        const portfolios = rows.map((f) => {
          const tipoPlazo = f?.tipoPlazo ?? f?.tipo_plazo ?? null;
          const plazo = f?.plazo ?? null;
          const fechaAlta = f?.fechaAlta ?? f?.fecha_alta ?? null;
          const prog = computeProgress(fechaAlta, tipoPlazo, plazo);
          return {
            id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? f?.id),
            name:
              f?.nombre ??
              f?.name ??
              f?.descripcion ??
              f?.tipo_cartera?.descripcion ??
              `Cartera ${f?.id ?? ""}`,
            periodMonths:
              tipoPlazo === "meses"
                ? plazo
                : tipoPlazo === "dias"
                ? Math.round((plazo || 0) / 30) || null
                : plazo,
            progress: prog,
            funds: [],
            meta: {
              tipoCarteraId:
                f?.tipo_cartera?.id_tipo_cartera ?? f?.tipoCarteraId ?? null,
              tipoPlazo: tipoPlazo,
              plazo: plazo,
              fechaAlta: fechaAlta,
              rendEsperado: f?.rendEsperado ?? null,
              depositoInicial: f?.depositoInicial ?? null,
              metadata: f?.metadata ?? null,
              tipo_cartera: f?.tipo_cartera ?? null,
            },
          };
        });
        // Movimientos
        let movements = [];
        try {
          const rm = await fetch(
            `/api/movimiento?cliente_id=${selectedClientId}`,
            { cache: "no-store" }
          );
          const jm = await rm.json();
          const data = Array.isArray(jm?.data) ? jm.data : [];
          const nameById = new Map(portfolios.map((p) => [Number(p.id), p.name]));
          movements = data.map((m) => {
            const pid = Number(m.fondo_id) || null;
            return {
              id: Number(m.id_movimiento),
              date:
                typeof m.fecha_alta === "string"
                  ? m.fecha_alta.substring(0, 10)
                  : new Date(m.fecha_alta).toISOString().substring(0, 10),
              type: (m.tipo_mov || "").toLowerCase(), // compra|venta
              fund: m.especie || "",
              portfolioId: pid,
              portfolio: nameById.get(pid) || (pid ? `Cartera ${pid}` : ""),
              amount: Number(m.nominal) || 0,
              priceUsd: m.precio_usd == null ? null : Number(m.precio_usd),
              speciesId: m.tipo_especie_id == null ? null : Number(m.tipo_especie_id),
            };
          });
        } catch (e) {
          }
        const portfoliosWithFunds = aggregateFundsByPortfolio(portfolios, movements);
        // Cargar liquidez por fondo
        let portfoliosConLiquidez = portfoliosWithFunds;
        try {
          const rliq = await fetch(`/api/liquidez/estado?cliente_id=${selectedClientId}`, { cache: 'no-store' });
          const jliq = await rliq.json();
          if (jliq.success && Array.isArray(jliq.data?.fondos)) {
            const liquidezMap = new Map(jliq.data.fondos.map(f => [Number(f.id_fondo), f]));
            portfoliosConLiquidez = portfoliosWithFunds.map(p => ({
              ...p,
              liquidez: liquidezMap.get(Number(p.id)) || null
            }));
          }
        } catch (e) {
          }
        // Enriquecer fondos con precios y rendimiento
        const portfoliosEnriquecidos = portfoliosConLiquidez.map(p => {
          const fundsEnriquecidos = p.funds.map(f => {
          const fundKey = f.tipo_especie_nombre ? normalizeSimple(f.tipo_especie_nombre) : null;
          // pricesMap ahora contiene precios en USD normalizados
          const precioActualUSD = pricesMap[fundKey] || 0;
          const precioActualARS = precioActualUSD; // Mantenemos el alias por compatibilidad
          // Calc precio promedio de compra
          let precioPromedioUSD = 0;
          if (movements && f.tipo_especie_id) {
            const movs = movements.filter((m) =>
              Number(m?.tipo_especie_id) === Number(f.tipo_especie_id) && m.operacion === 'COMPRA'
            );
            if (movs.length > 0) {
              const sumPorPrecio = movs.reduce((s, m) => {
                const n = Number(m.nominal || 0);
                const p = Number(m.precio_compra_usd || 0);
                return s + n * p;
              }, 0);
              const sumNominal = movs.reduce((s, m) => s + Number(m.nominal || 0), 0);
              precioPromedioUSD = sumNominal > 0 ? sumPorPrecio / sumNominal : 0;
            }
          }
          // Retorno (ahora en USD)
          const currentValuation = (f.nominal || 0) * precioActualUSD;
          const costBasis = (f.nominal || 0) * precioPromedioUSD;
          const totalReturn = costBasis > 0 ? ((currentValuation - costBasis) / costBasis) * 100 : 0;
          return {
            ...f,
            precioActualUSD, // Precio actual en USD
            precioActualARS, // Alias para compatibilidad
            precioPromedioUSD,
            totalReturn,
          };
          });
          return {
            ...p,
            funds: fundsEnriquecidos
          };
        });
        setClients((prev) =>
          prev.map((c) =>
            c.id === selectedClientId
              ? { ...c, portfolios: portfoliosEnriquecidos, movements }
              : c
          )
        );
      } catch (e) {
        }
    })();
  }, [selectedClientId]);
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );
  const handleSelectClient = (id) => setSelectedClientId(id);
  // 3) Crear cartera
  const handleAddPortfolio = useCallback(
    async (newPortfolio) => {
      if (!selectedClientId) return;
      try {
        // Usar el payload completo que viene del modal (FASE 2)
        const payload = {
          ...newPortfolio,
          cliente_id: selectedClientId, // Asegurar que tenga el cliente correcto
        };
        const res = await fetch("/api/fondo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || 'Error desconocido');
        }
        // Refrescar carteras y movimientos; y recomputar fondos + progreso
        const rf = await fetch(`/api/fondo?cliente_id=${selectedClientId}`, {
          cache: "no-store",
        });
        const jf = await rf.json();
        const rows = Array.isArray(jf?.data) ? jf.data : [];
        const base = rows.map((f) => {
          const tipoPlazo = f?.tipoPlazo ?? f?.tipo_plazo ?? null;
          const plazo = f?.plazo ?? null;
          const fechaAlta = f?.fechaAlta ?? f?.fecha_alta ?? null;
          return {
            id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? f?.id),
            name: f?.nombre || f?.tipo_cartera?.descripcion || `Cartera ${f?.id ?? ""}`,
            periodMonths:
              tipoPlazo === "meses"
                ? plazo ?? null
                : tipoPlazo === "dias"
                ? Math.round((f?.plazo ?? 0) / 30) || null
                : f?.plazo ?? null,
            progress: computeProgress(fechaAlta, tipoPlazo, plazo),
            funds: [],
            meta: {
              tipoCarteraId:
                f?.tipo_cartera?.id_tipo_cartera ?? f?.tipoCarteraId ?? null,
              tipoPlazo: f?.tipoPlazo ?? tipoPlazo ?? null,
              plazo: f?.plazo ?? plazo ?? null,
              fechaAlta: fechaAlta,
              rendEsperado: f?.rendEsperado ?? null,
              depositoInicial: f?.depositoInicial ?? null,
              metadata: f?.metadata ?? null,
              tipo_cartera: f?.tipo_cartera ?? null,
            },
          };
        });
        // Cargar movimientos y recomputar fondos
        let movements = [];
        try {
          const rm = await fetch(
            `/api/movimiento?cliente_id=${selectedClientId}`,
            { cache: "no-store" }
          );
          const jm = await rm.json();
          const data = Array.isArray(jm?.data) ? jm.data : [];
          movements = data.map((m) => ({
            id: Number(m.id_movimiento),
            date:
              typeof m.fecha_alta === "string"
                ? m.fecha_alta.substring(0, 10)
                : new Date(m.fecha_alta).toISOString().substring(0, 10),
            type: (m.tipo_mov || "").toLowerCase(),
            fund: m.especie || "",
            portfolioId: Number(m.fondo_id) || null,
            amount: Number(m.nominal) || 0,
            priceUsd: m.precio_usd == null ? null : Number(m.precio_usd),
          }));
        } catch {}
        const withFunds = aggregateFundsByPortfolio(base, movements);
        setClients((prev) =>
          prev.map((c) =>
            c.id === selectedClientId ? { ...c, portfolios: withFunds, movements } : c
          )
        );
      } catch (e) {
        } finally {
        setIsAddPortfolioOpen(false);
      }
    },
    [selectedClientId]
  );
  // 4) Editar cartera
  const handleSavePortfolioEdits = useCallback(
    async (updatedPortfolio) => {
      try {
        await fetch("/api/fondo", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: portfolioModalContext.portfolioId,
            plazo:
              updatedPortfolio?.periodMonths != null
                ? Number(updatedPortfolio.periodMonths)
                : null,
            tipo_plazo:
              updatedPortfolio?.periodMonths != null ? "meses" : null,
          }),
        });
        // Refrescar carteras
        const rf = await fetch(
          `/api/fondo?cliente_id=${portfolioModalContext.clientId}`,
          { cache: "no-store" }
        );
        const jf = await rf.json();
        const rows = Array.isArray(jf?.data) ? jf.data : [];
        const portfolios = rows.map((f) => {
          const tipoPlazo = f?.tipoPlazo ?? f?.tipo_plazo ?? null;
          const plazo = f?.plazo ?? null;
          const fechaAlta = f?.fechaAlta ?? f?.fecha_alta ?? null;
          return {
            id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? f?.id),
            name:
              f?.nombre ??
              f?.name ??
              f?.descripcion ??
              f?.tipo_cartera?.descripcion ??
              `Cartera ${f?.id ?? ""}`,
            periodMonths:
              tipoPlazo === "meses"
                ? plazo
                : tipoPlazo === "dias"
                ? Math.round((plazo || 0) / 30) || null
                : plazo,
            progress: computeProgress(fechaAlta, tipoPlazo, plazo),
            funds: [],
            meta: {
              tipoCarteraId:
                f?.tipo_cartera?.id_tipo_cartera ?? f?.tipoCarteraId ?? null,
              tipoPlazo: tipoPlazo,
              plazo: plazo,
              fechaAlta: fechaAlta,
              rendEsperado: f?.rendEsperado ?? null,
              depositoInicial: f?.depositoInicial ?? null,
              metadata: f?.metadata ?? null,
              tipo_cartera: f?.tipo_cartera ?? null,
            },
          };
        });
        // Re-attach funds con movimientos actuales del cliente
        const current = clients.find((c) => c.id === selectedClientId);
        const withFunds = aggregateFundsByPortfolio(portfolios, current?.movements || []);
        setClients((prev) =>
          prev.map((c) =>
            c.id === selectedClientId ? { ...c, portfolios: withFunds } : c
          )
        );
      } catch (e) {
        } finally {
        setIsPortfolioDetailOpen(false);
      }
    },
    [portfolioModalContext, clients, selectedClientId]
  );
  // 4b) Eliminar cartera
  const handleDeletePortfolio = useCallback(
    async (clientId, portfolioId) => {
      if (!clientId || !portfolioId) return;
      try {
        const res = await fetch("/api/fondo", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: portfolioId }),
        });
        if (!res.ok) {
          const te = await res.text();
          }
        // Refrescar carteras y movimientos del cliente
        const rf = await fetch(`/api/fondo?cliente_id=${clientId}`, {
          cache: "no-store",
        });
        const jf = await rf.json();
        const rows = Array.isArray(jf?.data) ? jf.data : [];
        const portfolios = rows.map((f) => {
          const tipoPlazo = f?.tipoPlazo ?? f?.tipo_plazo ?? null;
          const plazo = f?.plazo ?? null;
          const fechaAlta = f?.fechaAlta ?? f?.fecha_alta ?? null;
          return {
            id: Number(f.id ?? f.id_fondo ?? f.fondo_id ?? f?.id),
            name:
              f?.nombre ??
              f?.name ??
              f?.descripcion ??
              f?.tipo_cartera?.descripcion ??
              `Cartera ${f?.id ?? ""}`,
            periodMonths:
              tipoPlazo === "meses"
                ? plazo
                : tipoPlazo === "dias"
                ? Math.round((plazo || 0) / 30) || null
                : plazo,
            progress: computeProgress(fechaAlta, tipoPlazo, plazo),
            funds: [],
            meta: {
              tipoCarteraId:
                f?.tipo_cartera?.id_tipo_cartera ?? f?.tipoCarteraId ?? null,
              tipoPlazo: tipoPlazo,
              plazo: plazo,
              fechaAlta: fechaAlta,
              rendEsperado: f?.rendEsperado ?? null,
              depositoInicial: f?.depositoInicial ?? null,
              metadata: f?.metadata ?? null,
              tipo_cartera: f?.tipo_cartera ?? null,
            },
          };
        });
        // refrescar movimientos
        let movements = [];
        try {
          const rm = await fetch(`/api/movimiento?cliente_id=${clientId}`, {
            cache: "no-store",
          });
          const jm = await rm.json();
          const data = Array.isArray(jm?.data) ? jm.data : [];
          movements = data.map((m) => ({
            id: Number(m.id_movimiento),
            date:
              typeof m.fecha_alta === "string"
                ? m.fecha_alta.substring(0, 10)
                : new Date(m.fecha_alta).toISOString().substring(0, 10),
            type: (m.tipo_mov || "").toLowerCase(),
            fund: m.especie || "",
            portfolioId: Number(m.fondo_id) || null,
            amount: Number(m.nominal) || 0,
            priceUsd: m.precio_usd == null ? null : Number(m.precio_usd),
          }));
        } catch {}
        const withFunds = aggregateFundsByPortfolio(portfolios, movements);
        setClients((prev) =>
          prev.map((c) =>
            c.id === clientId ? { ...c, portfolios: withFunds, movements } : c
          )
        );
        // Cerrar modal de detalle si estaba abierto sobre esta cartera
        if (
          isPortfolioDetailOpen &&
          portfolioModalContext.portfolioId === portfolioId
        ) {
          setIsPortfolioDetailOpen(false);
        }
      } catch (e) {
        }
    },
    [isPortfolioDetailOpen, portfolioModalContext]
  );
  // Helpers para refrescar movimientos tras guardar/borrar
  const refreshClientMovements = useCallback(
    async (clientId) => {
      try {
        const rm = await fetch(`/api/movimiento?cliente_id=${clientId}`, {
          cache: "no-store",
        });
        const jm = await rm.json();
        const data = Array.isArray(jm?.data) ? jm.data : [];
        const mapped = data.map((m) => ({
          id: Number(m.id_movimiento),
          date:
            typeof m.fecha_alta === "string"
              ? m.fecha_alta.substring(0, 10)
              : new Date(m.fecha_alta).toISOString().substring(0, 10),
          type: (m.tipo_mov || "").toLowerCase(),
          fund: m.especie || "",
          portfolioId: Number(m.fondo_id) || null,
          amount: Number(m.nominal) || 0,
          priceUsd: m.precio_usd == null ? null : Number(m.precio_usd),
        }));
        // Recomputar fondos de las carteras del cliente
        setClients((prev) =>
          prev.map((c) => {
            if (c.id !== clientId) return c;
            const recomputed = aggregateFundsByPortfolio(c.portfolios || [], mapped);
            return { ...c, movements: mapped, portfolios: recomputed };
          })
        );
      } catch (e) {
        }
    },
    [setClients]
  );
  // 6) Eliminar movimiento
  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId || !selectedClientId) return;
    try {
      const res = await fetch("/api/movimiento", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDeleteId }),
      });
      if (!res.ok) await refreshClientMovements(selectedClientId);
    } catch (e) {
      } finally {
      setIsConfirmDeleteOpen(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, selectedClientId, refreshClientMovements]);
  const formatNumber = (n) =>
    Number(n || 0).toLocaleString("es-AR", {
      maximumFractionDigits: 2,
    });
  // Handler para refrescar movimientos después de guardar
  const handleMovementSaved = useCallback(() => {
    if (selectedClientId) {
      refreshClientMovements(selectedClientId);
    }
  }, [selectedClientId, refreshClientMovements]);
  return (
    <SidebarProvider>
        <div className="main-content" id="main-content">
        <div className="main-inner">
          <header className="top-header">
            <div className="top-row">
              <div className="header-title">
                <h1>Fondos por Cliente</h1>
                <p className="muted">
                  Visualización de carteras, rendimientos y movimientos por
                  cliente
                </p>
              </div>
              <div className="top-controls">
                <button
                  id="openAddBtn"
                  className="btn primary"
                  onClick={() => setIsMovementModalOpen(true)}
                >
                  <i className="fas fa-plus"></i> Agregar Movimiento
                </button>
              </div>
            </div>
          </header>
          <div className="fondos-layout">
            <aside className="clients-column card">
              <div className="card-header">
                <div className="search-wrapper" style={{ marginBottom: "8px" }}>
                  <i
                    className="fas fa-search search-icon"
                    aria-hidden="true"
                  ></i>
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
                onSelectClient={setSelectedClientId}
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
                  onDeletePortfolio={(portfolioId) => {
                    handleDeletePortfolio(selectedClientId, portfolioId);
                  }}
                  onOpenPortfolioDetail={(portfolioId) => {
                    setPortfolioModalContext({
                      clientId: selectedClientId,
                      portfolioId,
                    });
                    setIsPortfolioDetailOpen(true);
                  }}
                  onOpenSpeciesHistory={(portfolioId, fundName) => {
                    setSpeciesHistoryContext({
                      clientId: selectedClientId,
                      portfolioId,
                      fundName,
                    });
                    setIsSpeciesHistoryOpen(true);
                  }}
                />
              ) : (
                <div className="client-placeholder">
                  <div className="placeholder-content">
                    <i
                      className="fas fa-user-circle"
                      style={{ fontSize: "48px", color: "#c7d2da" }}
                    ></i>
                    <p>
                      Seleccioná un cliente para ver sus carteras y movimientos
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      {isConfirmDeleteOpen &&
        (() => {
          const movement = selectedClient?.movements.find(
            (m) => m.id === pendingDeleteId
          );
          const text = movement
            ? `Eliminar movimiento ${movement.type} por ${formatNumber(
                movement.amount
              )} en ${movement.fund}?`
            : "¿Eliminar movimiento seleccionado?";
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
          clienteId={selectedClientId}
        />
      )}
      {isPortfolioDetailOpen && (() => {
        const client = clients.find(c => c.id === portfolioModalContext.clientId);
        const portfolio = client?.portfolios?.find(p => p.id === portfolioModalContext.portfolioId);
        const fondo = {
          id_fondo: portfolio?.id,
          nombre: portfolio?.name,
          liquidez_disponible: portfolio?.liquidez?.saldoDisponible || 0,
          tipo_cartera: {
            descripcion: portfolio?.name,
            color: '#3b82f6',
            icono: 'fas fa-chart-line'
          }
        };
        return (
          <TenenciasFondoModal
            fondo={fondo}
            onClose={() => setIsPortfolioDetailOpen(false)}
            onSelectEspecie={(especie) => {
              setDetalleEspecieContext({ fondo, especie });
              setIsDetalleEspecieOpen(true);
            }}
            onDeleteFondo={(fondoId) => {
              handleDeletePortfolio(portfolioModalContext.clientId, fondoId);
            }}
          />
        );
      })()}
      {isDetalleEspecieOpen && (
        <DetalleEspecieModal
          fondo={detalleEspecieContext.fondo}
          especie={detalleEspecieContext.especie}
          onClose={() => setIsDetalleEspecieOpen(false)}
        />
      )}
      {isSpeciesHistoryOpen && (
        <SpeciesHistoryModal
          clients={clients}
          context={speciesHistoryContext}
          onClose={() => setIsSpeciesHistoryOpen(false)}
        />
      )}
      <MovementModal
        open={isMovementModalOpen}
        onClose={() => {
          setIsMovementModalOpen(false);
          handleMovementSaved();
        }}
        defaultClientId={selectedClientId}
      />
    </SidebarProvider>
  );
};
const FondosPage = () => {
  return (
    <MovementsProvider>
      <FondosPageContent />
    </MovementsProvider>
  );
};
export default FondosPage;