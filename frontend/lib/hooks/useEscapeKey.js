/**
 * Hook personalizado para manejar la tecla Escape
 * Útil para cerrar modales y otros componentes con ESC
 */
import { useEffect } from 'react';
/**
 * Hook que ejecuta un callback cuando se presiona Escape
 * @param {Function} onEscape - Función a ejecutar al presionar ESC
 * @param {boolean} enabled - Si el listener está activo (default: true)
 * 
 * @example
 * useEscapeKey(() => setModalOpen(false), modalOpen);
 */
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    // Si no está habilitado, no hacer nada
    if (!enabled) return;
    // Handler del evento
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };
    // Agregar listener
    window.addEventListener('keydown', handleKeyDown);
    // Cleanup al desmontar
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, enabled]);
}
export default useEscapeKey;
