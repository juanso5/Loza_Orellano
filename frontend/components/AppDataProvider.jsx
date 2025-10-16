'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const AppDataContext = createContext(null);
/**
 * AppDataProvider - Proveedor central de datos de la aplicaci├│n
 * 
 * Centraliza el fetching y estado de:
 * - Clientes
 * - Fondos (del cliente seleccionado)
 * - Liquidez (del cliente seleccionado)
 * - Movimientos (del cliente seleccionado)
 * 
 * Proporciona funciones para refrescar datos y mantener sincronizaci├│n
 * entre todas las p├íginas (fondos, liquidez, movimientos)
 */
export function AppDataProvider({ children }) {
  // ============ ESTADO PRINCIPAL ============
  const [clientes, setClientes] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [fondos, setFondos] = useState([]);
  const [liquidez, setLiquidez] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  // ============ ESTADO DE CARGA ============
  const [loading, setLoading] = useState({
    clientes: false,
    fondos: false,
    liquidez: false,
    movimientos: false,
  });
  const [error, setError] = useState(null);
  // ============ CARGAR CLIENTES (solo una vez al inicio) ============
  const refreshClientes = useCallback(async () => {
    setLoading(prev => ({ ...prev, clientes: true }));
    setError(null);
    try {
      const res = await fetch('/api/cliente', { cache: 'no-store' });
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setClientes(list);
      // Si no hay cliente seleccionado y hay clientes, seleccionar el primero
      if (!selectedClientId && list.length > 0) {
        setSelectedClientId(list[0].id);
      }
      } catch (err) {
      setError('Error al cargar clientes');
      setClientes([]);
    } finally {
      setLoading(prev => ({ ...prev, clientes: false }));
    }
  }, [selectedClientId]);
  // ============ CARGAR FONDOS del cliente seleccionado ============
  const refreshFondos = useCallback(async () => {
    if (!selectedClientId) {
      setFondos([]);
      return;
    }
    setLoading(prev => ({ ...prev, fondos: true }));
    try {
      const res = await fetch(`/api/fondo?cliente_id=${selectedClientId}`, { cache: 'no-store' });
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setFondos(list);
      } catch (err) {
      setFondos([]);
    } finally {
      setLoading(prev => ({ ...prev, fondos: false }));
    }
  }, [selectedClientId]);
  // ============ CARGAR LIQUIDEZ del cliente seleccionado ============
  const refreshLiquidez = useCallback(async () => {
    if (!selectedClientId) {
      setLiquidez(null);
      return;
    }
    setLoading(prev => ({ ...prev, liquidez: true }));
    try {
      const res = await fetch(`/api/liquidez/estado?cliente_id=${selectedClientId}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setLiquidez(json.data);
        } else {
        setLiquidez(null);
      }
    } catch (err) {
      setLiquidez(null);
    } finally {
      setLoading(prev => ({ ...prev, liquidez: false }));
    }
  }, [selectedClientId]);
  // ============ CARGAR MOVIMIENTOS del cliente seleccionado ============
  const refreshMovimientos = useCallback(async (limit = 10000) => {
    if (!selectedClientId) {
      setMovimientos([]);
      return;
    }
    setLoading(prev => ({ ...prev, movimientos: true }));
    try {
      const res = await fetch(`/api/movimiento?cliente_id=${selectedClientId}&limit=${limit}`, { cache: 'no-store' });
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setMovimientos(list);
      } catch (err) {
      setMovimientos([]);
    } finally {
      setLoading(prev => ({ ...prev, movimientos: false }));
    }
  }, [selectedClientId]);
  // ============ REFRESH ALL - Recargar fondos, liquidez y movimientos ============
  const refreshAll = useCallback(async () => {
    if (!selectedClientId) return;
    await Promise.all([
      refreshFondos(),
      refreshLiquidez(),
      refreshMovimientos(),
    ]);
  }, [selectedClientId, refreshFondos, refreshLiquidez, refreshMovimientos]);
  // ============ CARGAR CLIENTES al montar ============
  useEffect(() => {
    refreshClientes();
  }, [refreshClientes]);
  // ============ CARGAR DATOS cuando cambia el cliente seleccionado ============
  useEffect(() => {
    if (selectedClientId) {
      refreshAll();
    }
  }, [selectedClientId, refreshAll]);
  // ============ HELPERS ============
  const getClienteById = useCallback((id) => {
    return clientes.find(c => Number(c.id) === Number(id));
  }, [clientes]);
  const getFondoById = useCallback((id) => {
    return fondos.find(f => Number(f.id_fondo) === Number(id));
  }, [fondos]);
  // ============ VALOR DEL CONTEXT ============
  const value = useMemo(() => ({
    // Datos
    clientes,
    selectedClientId,
    fondos,
    liquidez,
    movimientos,
    // Estado de carga
    loading,
    error,
    // Acciones
    setSelectedClientId,
    refreshClientes,
    refreshFondos,
    refreshLiquidez,
    refreshMovimientos,
    refreshAll,
    // Helpers
    getClienteById,
    getFondoById,
    // Estado computado
    isLoading: Object.values(loading).some(Boolean),
  }), [
    clientes,
    selectedClientId,
    fondos,
    liquidez,
    movimientos,
    loading,
    error,
    refreshClientes,
    refreshFondos,
    refreshLiquidez,
    refreshMovimientos,
    refreshAll,
    getClienteById,
    getFondoById,
  ]);
  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}
/**
 * Hook para usar el AppDataProvider
 * Debe ser usado dentro de un componente envuelto en AppDataProvider
 */
export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData debe ser usado dentro de AppDataProvider');
  }
  return context;
}
