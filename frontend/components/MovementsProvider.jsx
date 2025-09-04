'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';

// Tamaño de página conservador para equipos modestos
const PAGE_SIZE = 100;

const MovementsCtx = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...state, items: [], page: 0, hasMore: true, error: '', loading: false };
    case 'LOAD_START':
      return { ...state, loading: true, error: '' };
    case 'LOAD_SUCCESS': {
      const newItems = action.append ? [...state.items, ...action.items] : action.items;
      return {
        ...state,
        items: newItems,
        loading: false,
        error: '',
        page: action.append ? state.page + 1 : 1,
        hasMore: action.items.length === PAGE_SIZE,
      };
    }
    case 'LOAD_ERROR':
      return { ...state, loading: false, error: action.error || 'Error de carga' };
    case 'DELETE_OK':
      return { ...state, items: state.items.filter((r) => String(r.id_movimiento) !== String(action.id)) };
    default:
      return state;
  }
}

export function MovementsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    page: 0,
    hasMore: true,
    loading: false,
    error: '',
  });
  const [query, setQuery] = useState('');
  const [clientIdFilter, setClientIdFilter] = useState(null); // NUEVO: filtro por cliente
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const abortRef = useRef(null);

  // NUEVO: precios latest desde DB y un "tick" para notificar cambios (CSV subido, altas/bajas)
  const [pricesMap, setPricesMap] = useState({}); // { normalizedName: price }
  const [tick, setTick] = useState(0);

  // util de normalización (similar a la versión previa)
  const normalizeSimple = useCallback((s) => {
    return (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^\w]/g, '');
  }, []);

  const loadLatestPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/movimiento?action=latestPrecios', { cache: 'no-store' });
      if (!res.ok) throw new Error('Error precios');
      const j = await res.json();
      const arr = Array.isArray(j?.data) ? j.data : [];
      const map = {};
      for (const r of arr) {
        const name = (r?.nombre || '').trim();
        const price = Number(r?.precio);
        if (!name || !Number.isFinite(price) || price <= 0) continue;
        const k = normalizeSimple(name);
        map[k] = price;
        // alias AL30 -> AL30D (si aplica)
        if (k && !k.endsWith('d')) map[`${k}d`] = price;
      }
      setPricesMap(map);
    } catch {
      setPricesMap({});
    }
  }, [normalizeSimple]);

  useEffect(() => { loadLatestPrices(); }, [loadLatestPrices]);

  const refreshPrices = useCallback(async () => {
    await loadLatestPrices();
    setTick((t) => t + 1);
  }, [loadLatestPrices]);

  // Data fetching con cancelación
  const fetchPage = useCallback(async (pageIdx, append) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({ type: 'LOAD_START' });
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(pageIdx * PAGE_SIZE),
      orderBy: 'fecha_alta',
      orderDir: 'desc',
    });
    try {
      const res = await fetch(`/api/movimiento?${params.toString()}`, { signal: ac.signal, cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Error al obtener movimientos');
      }
      const out = await res.json();
      const rows = Array.isArray(out.data) ? out.data : [];
      dispatch({ type: 'LOAD_SUCCESS', items: rows, append });
    } catch (e) {
      if (e?.name === 'AbortError') return;
      dispatch({ type: 'LOAD_ERROR', error: e?.message || String(e) });
    }
  }, []);

  const fetchFirstPage = useCallback(() => fetchPage(0, false), [fetchPage]);

  const fetchNextPage = useCallback(() => {
    if (state.loading || !state.hasMore) return;
    fetchPage(state.page, true);
  }, [fetchPage, state.loading, state.hasMore, state.page]);

  // Cargar la primera página al montar
  useEffect(() => { fetchFirstPage(); }, [fetchFirstPage]);

  const refreshFirstPage = useCallback(() => {
    dispatch({ type: 'RESET' });
    fetchFirstPage();
    setTick((t) => t + 1); // notificar a tarjetas de holdings que datos cambiaron
  }, [fetchFirstPage]);

  const deleteMovement = useCallback(async (id) => {
    try {
      const res = await fetch('/api/movimiento', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'No se pudo eliminar');
      }
      dispatch({ type: 'DELETE_OK', id });
      setTick((t) => t + 1);
    } catch (e) {
      alert(e?.message || 'Error eliminando movimiento');
    }
  }, []);

  // Filtro de búsqueda memoizado (client-side sobre lo ya cargado)
  const filteredItems = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    let base = state.items;
    if (clientIdFilter != null) {
      base = base.filter((r) => Number(r.cliente_id) === Number(clientIdFilter));
    }
    if (!q) return base;
    return base.filter((r) => {
      return (
        (r.cliente_nombre || '').toLowerCase().includes(q) ||
        (r.cartera_nombre || '').toLowerCase().includes(q) ||
        (r.especie || '').toLowerCase().includes(q) ||
        (r.tipo_mov || '').toLowerCase().includes(q)
      );
    });
  }, [state.items, query, clientIdFilter]);

  const value = useMemo(() => ({
    items: state.items,
    filteredItems,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    page: state.page,
    query, setQuery,
    clientIdFilter, setClientIdFilter,
    uploadState, setUploadState,
    fetchNextPage,
    fetchFirstPage,
    refreshFirstPage,
    deleteMovement,
    // NUEVO
    pricesMap,
    refreshPrices,
    tick,
    normalizeSimple,
  }), [state, filteredItems, query, clientIdFilter, uploadState, fetchNextPage, fetchFirstPage, refreshFirstPage, deleteMovement, pricesMap, refreshPrices, tick, normalizeSimple]);

  return <MovementsCtx.Provider value={value}>{children}</MovementsCtx.Provider>;
}

export const useMovements = () => {
  const ctx = useContext(MovementsCtx);
  if (!ctx) throw new Error('useMovements debe usarse dentro de MovementsProvider');
  return ctx;
};