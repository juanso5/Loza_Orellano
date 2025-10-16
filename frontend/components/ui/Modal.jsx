// components/ui/Modal.jsx
'use client';
import { useEffect } from 'react';
import { useEscapeKey } from '@/lib/hooks';
/**
 * Componente Modal base reutilizable
 * Proporciona estructura consistente para todos los modales
 * 
 * @param {boolean} open - Controla si el modal está abierto
 * @param {function} onClose - Callback al cerrar el modal
 * @param {string} title - Título del modal
 * @param {ReactNode} children - Contenido del modal
 * @param {string} size - Tamaño del modal: "small" | "medium" | "large" | "xlarge"
 * @param {boolean} closeOnOverlayClick - Si se cierra al hacer click fuera (default: true)
 * @param {ReactNode} footer - Contenido personalizado para el footer
 * @param {string} className - Clases CSS adicionales
 */
export default function Modal({ 
  open, 
  onClose, 
  title, 
  children, 
  size = "medium",
  closeOnOverlayClick = true,
  footer,
  className = ""
}) {
  // Cerrar con tecla Escape
  useEscapeKey(open ? onClose : null);
  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);
  if (!open) return null;
  const sizeClasses = {
    small: "modal-dialog-small",
    medium: "modal-dialog",
    large: "modal-dialog-large", 
    xlarge: "modal-dialog-xlarge"
  };
  const dialogClass = sizeClasses[size] || sizeClasses.medium;
  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose?.();
    }
  };
  return (
    <div
      className={`modal ${className}`}
      style={{ display: "flex" }}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={handleOverlayClick}
    >
      <div className={dialogClass} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-content">
          {title && (
            <header className="modal-header">
              <h2 id="modal-title">{title}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Cerrar"
              >
                <i className="fas fa-times" />
              </button>
            </header>
          )}
          <div className="modal-body">
            {children}
          </div>
          {footer && (
            <div className="modal-footer">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
/**
 * Componente ModalFooter para botones estandarizados
 */
export function ModalFooter({ onCancel, onConfirm, confirmText = "Guardar", cancelText = "Cancelar", confirmDisabled = false }) {
  return (
    <>
      <button
        type="button"
        className="btn-save"
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        <i className="fas fa-check" /> {confirmText}
      </button>
      <button
        type="button"
        className="btn-close"
        onClick={onCancel}
      >
        <i className="fas fa-times" /> {cancelText}
      </button>
    </>
  );
}
