/**
 * Hook personalizado para sincronizar estado con localStorage
 * Maneja automáticamente la persistencia y recuperación de datos
 */
import { useState, useEffect } from 'react';
/**
 * Hook que sincroniza estado con localStorage
 * @param {string} key - Clave en localStorage
 * @param {any} defaultValue - Valor por defecto si no existe en localStorage
 * @returns {[any, Function]} - [valor, setter] igual que useState
 * 
 * @example
 * const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
 */
export function useLocalStorageState(key, defaultValue) {
  // Inicializar estado desde localStorage o usar defaultValue
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch (error) {
      }
    return defaultValue;
  });
  // Sincronizar cambios de estado con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      }
  }, [key, state]);
  return [state, setState];
}
export default useLocalStorageState;
