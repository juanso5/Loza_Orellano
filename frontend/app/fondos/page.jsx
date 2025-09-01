"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

import SidebarProvider from "../../components/SidebarProvider";
import ClientList from "../../components/ClientList";
import ClientDetail from "../../components/ClientDetail";
// import MovementModal from "../../components/MovementModal"; // Reemplazado por el modal idéntico al de Movimientos
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import AddPortfolioModal from "../../components/AddPortfolioModal";
import PortfolioDetailModal from "../../components/PortfolioDetailModal";
import SpeciesHistoryModal from "../../components/SpeciesHistoryModal";

// Helpers
function toISODateTimeLocal(val) {
  // "YYYY-MM-DDTHH:mm" -> ISO complete string
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function computeProgress(fechaAlta, tipoPlazo, plazo) {
  // Progreso del periodo = (hoy - fecha_alta) / (fecha_alta + plazo - fecha_alta)
  if (!fechaAlta || plazo == null) return 0;
  const start = new Date(fechaAlta);
  if (Number.isNaN(start.getTime())) return 0;

  const end = new Date(start);
  const p = Number(plazo) || 0;
  if (p <= 0) return 0;

  if ((tipoPlazo || "").toLowerCase() === "meses") {
    end.setMonth(end.getMonth() + p);
  } else if ((tipoPlazo || "").toLowerCase() === "dias") {
    end.setDate(end.getDate() + p);
  } else {
    return 0;
  }

  const now = new Date();
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 1;
  const elapsed = now.getTime() - start.getTime();
  return clamp01(elapsed / total);
}

function signedAmount(type, n) {
  // compra|venta -> +|-
  return (String(type || "").toLowerCase() === "venta" ? -1 : 1) * (Number(n) || 0);
}

function aggregateFundsByPortfolio(portfolios, movements) {
  // Construye fondos por cartera: [{ id, name, nominal }]
  const byPortfolio = new Map(); // pid -> Map(key -> { id, name, nominal })
  for (const m of movements) {
    const pid = Number(m.portfolioId) || null;
    if (!pid) continue;
    const name = (m.fund || "").trim();
    if (!name) continue;

    const delta = signedAmount(m.type, m.amount);
    let map = byPortfolio.get(pid);
    if (!map) {
      map = new Map();
      byPortfolio.set(pid, map);
    }
    // clave por nombre (si hubiera id de especie lo podríamos usar)
    const key = name.toLowerCase();
    const prev = map.get(key) || { id: `n:${key}`, name, nominal: 0 };
    prev.nominal = (Number(prev.nominal) || 0) + delta;
    map.set(key, prev);
  }

  return portfolios.map((p) => {
    const pm = byPortfolio.get(Number(p.id)) || new Map();
    const funds = Array.from(pm.values())
      .filter((f) => Number(f.nominal) > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { ...p, funds };
  });
}

const FondosPage = () => {
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

  // Estado del formulario del modal "igual al de Movimientos"
  const [mvClienteId, setMvClienteId] = useState(null);
  const [mvFondoId, setMvFondoId] = useState(null);
  const [mvFecha, setMvFecha] = useState(() => {
    const d = new Date();
    // datetime-local: YYYY-MM-DDTHH:mm
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [mvTipo, setMvTipo] = useState("Ingreso"); // Ingreso | Egreso (UI)
  const [mvEspecieSel, setMvEspecieSel] = useState("");
  const [mvEspecieNueva, setMvEspecieNueva] = useState("");
  const [mvNominal, setMvNominal] = useState("");
  const [mvPrecioUsd, setMvPrecioUsd] = useState("");

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
        console.error("Error cargando clientes:", e);
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
          console.warn("Movimientos no disponibles aún:", e);
        }

        const portfoliosWithFunds = aggregateFundsByPortfolio(portfolios, movements);

        setClients((prev) =>
          prev.map((c) =>
            c.id === selectedClientId
              ? { ...c, portfolios: portfoliosWithFunds, movements }
              : c
          )
        );
      } catch (e) {
        console.error("Error cargando datos del cliente:", e);
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
        const name =
          newPortfolio?.name ??
          newPortfolio?.tipo_cartera ??
          newPortfolio?.descripcion ??
          newPortfolio?.title ??
          "Nueva cartera";

        const periodMonths =
          newPortfolio?.periodMonths != null
            ? Number(newPortfolio.periodMonths)
            : newPortfolio?.plazo != null
            ? Number(newPortfolio.plazo)
            : null;

        const res = await fetch("/api/fondo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente_id: selectedClientId,
            name,
            periodMonths,
          }),
        });
        if (!res.ok) {
          const te = await res.text();
          console.error("Error creando cartera:", te);
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
            name: f?.tipo_cartera?.descripcion || `Cartera ${f?.id ?? ""}`,
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
        console.error("handleAddPortfolio error:", e);
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
        console.error("handleSavePortfolioEdits error:", e);
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
          console.error("Error eliminando cartera:", te);
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
        console.error("handleDeletePortfolio error:", e);
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
        console.error("refreshClientMovements error:", e);
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
      if (!res.ok) console.error("No se pudo borrar el movimiento");

      await refreshClientMovements(selectedClientId);
    } catch (e) {
      console.error("handleConfirmDelete error:", e);
    } finally {
      setIsConfirmDeleteOpen(false);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, selectedClientId, refreshClientMovements]);

  const formatNumber = (n) =>
    Number(n || 0).toLocaleString("es-AR", {
      maximumFractionDigits: 2,
    });

  // Especies del cliente actual (para el select)
  const speciesOptions = useMemo(() => {
    const set = new Set(
      (selectedClient?.movements || [])
        .map((m) => m?.fund)
        .filter(Boolean)
        .map((s) => String(s))
    );
    return Array.from(set);
  }, [selectedClient]);

  // Cuando se abre el modal, inicializo valores por defecto
  const openMovementModal = () => {
    const cli = selectedClient || null;
    const firstPortfolioId = cli?.portfolios?.[0]?.id ?? null;
    setMvClienteId(cli?.id ?? null);
    setMvFondoId(firstPortfolioId);
    setMvTipo("Ingreso");
    setMvNominal("");
    setMvPrecioUsd("");
    setMvEspecieSel(speciesOptions[0] || "");
    setMvEspecieNueva("");
    // fecha queda como ahora
    setIsMovementModalOpen(true);
  };

  // Hint de disponibles (visual) en el modal
  useEffect(() => {
    const hint = document.getElementById("availableHint");
    if (!hint) return;

    const isEgreso = mvTipo === "Egreso";
    const cli = clients.find((c) => c.id === mvClienteId);
    const port = cli?.portfolios?.find((p) => p.id === mvFondoId);
    const especie =
      (mvEspecieNueva && mvEspecieNueva.trim()) ||
      (mvEspecieSel && String(mvEspecieSel).trim()) ||
      "";

    if (!isEgreso || !cli || !port || !especie) {
      hint.classList.add("d-none");
      hint.textContent = "";
      return;
    }

    const found = (port.funds || []).find(
      (f) => String(f.name).toLowerCase() === especie.toLowerCase()
    );
    const avail = Number(found?.nominal || 0);
    hint.textContent = `Disponibles: ${avail.toLocaleString("es-AR", {
      maximumFractionDigits: 2,
    })} unidades.`;
    hint.classList.remove("d-none");
  }, [mvTipo, mvClienteId, mvFondoId, mvEspecieSel, mvEspecieNueva, clients]);

  // Cerrar modal con Escape y click fuera
  useEffect(() => {
    if (!isMovementModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsMovementModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMovementModalOpen]);

  const handleSaveMovementFromModal = async () => {
    if (!mvClienteId || !mvFondoId) return;

    const especie =
      (mvEspecieNueva && mvEspecieNueva.trim()) ||
      (mvEspecieSel && String(mvEspecieSel).trim()) ||
      "";

    if (!especie) return;

    const tipo_mov = mvTipo === "Egreso" ? "venta" : "compra";
    const nominal = parseInt(mvNominal, 10);
    if (!Number.isFinite(nominal) || nominal <= 0) return;

    // Validación disponible para egreso
    if (tipo_mov === "venta") {
      const cli = clients.find((c) => c.id === mvClienteId);
      const port = cli?.portfolios?.find((p) => p.id === mvFondoId);
      const found = port?.funds?.find(
        (f) => String(f.name).toLowerCase() === especie.toLowerCase()
      );
      const avail = Number(found?.nominal || 0);
      if (nominal > avail) {
        alert(
          `No podés vender más de ${avail.toLocaleString("es-AR", {
            maximumFractionDigits: 2,
          })} unidades.`
        );
        return;
      }
    }

    // datetime-local -> ISO (igual a Movimientos)
    const fecha_alta = toISODateTimeLocal(mvFecha);

    const payload = {
      cliente_id: mvClienteId,
      fondo_id: mvFondoId,
      fecha_alta,
      tipo_mov,
      especie,
      nominal,
      precio_usd:
        mvPrecioUsd === "" || mvPrecioUsd === null
          ? null
          : Number(mvPrecioUsd),
    };

    try {
      const res = await fetch("/api/movimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const te = await res.text();
        console.error("Error creando movimiento", te);
      }
      await refreshClientMovements(mvClienteId);
    } catch (e) {
      console.error("handleSaveMovementFromModal error:", e);
    } finally {
      setIsMovementModalOpen(false);
    }
  };

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
                  onClick={openMovementModal}
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
          uid={(p = "id") =>
            `${p}-${Date.now().toString(36)}-${Math.floor(
              Math.random() * 9000 + 1000
            )}`
          }
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
          onDelete={() =>
            handleDeletePortfolio(
              portfolioModalContext.clientId,
              portfolioModalContext.portfolioId
            )
          }
        />
      )}

      {isSpeciesHistoryOpen && (
        <SpeciesHistoryModal
          clients={clients}
          context={speciesHistoryContext}
          onClose={() => setIsSpeciesHistoryOpen(false)}
        />
      )}

      {/* Modal de movimiento idéntico al de Movimientos (CSVMovimientos) */}
      <div
        className="modal"
        id="movementModal"
        aria-hidden={isMovementModalOpen ? "false" : "true"}
        style={{ display: isMovementModalOpen ? "flex" : "none" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="movementModalTitle"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setIsMovementModalOpen(false);
        }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="movementModalTitle">Agregar movimiento</h3>
              <button
                className="modal-close btn-close"
                aria-label="Cerrar"
                onClick={() => setIsMovementModalOpen(false)}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <form
              id="movementForm"
              className="modal-body"
              autoComplete="off"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveMovementFromModal();
              }}
            >
              <input type="hidden" id="movementId" />

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="clienteSelect">
                    Cliente <span className="required">*</span>
                  </label>
                  <select
                    id="clienteSelect"
                    value={mvClienteId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setMvClienteId(val);
                      const cli = clients.find((c) => c.id === val);
                      setMvFondoId(cli?.portfolios?.[0]?.id ?? null);
                    }}
                  >
                    {(clients || []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="error-message" id="error-clienteSelect" />
                </div>

                <div className="form-group">
                  <label htmlFor="fondoSelect">
                    Cartera <span className="required">*</span>
                  </label>
                  <select
                    id="fondoSelect"
                    value={mvFondoId ?? ""}
                    onChange={(e) =>
                      setMvFondoId(e.target.value ? Number(e.target.value) : null)
                    }
                  >
                    {(clients.find((c) => c.id === mvClienteId)?.portfolios ||
                      []
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="error-message" id="error-fondoSelect" />
                </div>

                <div className="form-group">
                  <label htmlFor="fechaInput">
                    Fecha y hora <span className="required">*</span>
                  </label>
                  <input
                    id="fechaInput"
                    type="datetime-local"
                    value={mvFecha}
                    onChange={(e) => setMvFecha(e.target.value)}
                  />
                  <div className="error-message" id="error-fechaInput" />
                </div>

                <div className="form-group">
                  <label htmlFor="tipoSelect">
                    Tipo <span className="required">*</span>
                  </label>
                  <select
                    id="tipoSelect"
                    value={mvTipo}
                    onChange={(e) => setMvTipo(e.target.value)}
                  >
                    <option value="Ingreso">Ingreso</option>
                    <option value="Egreso">Egreso</option>
                  </select>
                  <div className="error-message" id="error-tipoSelect" />
                </div>

                <div className="form-group">
                  <label htmlFor="especieSelect">
                    Especie <span className="required">*</span>
                  </label>
                  <div className="input-with-side">
                    <select
                      id="especieSelect"
                      value={mvEspecieSel}
                      onChange={(e) => setMvEspecieSel(e.target.value)}
                    >
                      <option value="">-- Seleccionar especie --</option>
                      {speciesOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      id="newEspecieInput"
                      placeholder="Nombre nueva especie..."
                      value={mvEspecieNueva}
                      onChange={(e) => setMvEspecieNueva(e.target.value)}
                    />
                  </div>
                  <div className="error-message" id="error-especieSelect" />
                </div>

                <div className="form-group">
                  <label htmlFor="nominalInput">
                    Nominal <span className="required">*</span>
                  </label>
                  <input
                    id="nominalInput"
                    type="number"
                    min="1"
                    step="1"
                    value={mvNominal}
                    onChange={(e) => setMvNominal(e.target.value)}
                  />
                  <div className="error-message" id="error-nominalInput" />
                  {/* hint de disponibles (estético) */}
                  <small
                    id="availableHint"
                    className="available-hint small d-none"
                    aria-live="polite"
                  ></small>
                </div>

                <div className="form-group">
                  <label htmlFor="tcInput">Tipo de cambio (precio_usd)</label>
                  <input
                    id="tcInput"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="1.00"
                    value={mvPrecioUsd}
                    onChange={(e) => setMvPrecioUsd(e.target.value)}
                  />
                  <div className="error-message" id="error-tcInput" />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="submit"
                  className="btn-save"
                  id="movementSaveBtn"
                >
                  <i className="fas fa-check" /> Guardar
                </button>
                <button
                  type="button"
                  className="btn-close"
                  id="movementCancelBtn"
                  onClick={() => setIsMovementModalOpen(false)}
                >
                  <i className="fas fa-times" /> Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default FondosPage;