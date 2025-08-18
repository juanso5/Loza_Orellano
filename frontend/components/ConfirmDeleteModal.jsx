import styles from "../styles/clientes.module.css";

export default function ConfirmDeleteModal({ open, onCancel, onConfirm, text }) {
  if (!open) return null;
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.(); }}>
      <div className={styles.modalDialog} onMouseDown={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2>Confirmar eliminación</h2>
          <button className={styles.modalClose} onClick={onCancel} aria-label="Cerrar">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>
        <div className={styles.modalBody}>
          <p>{text}</p>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnDanger} onClick={onConfirm}><i className="fas fa-trash"/> Eliminar</button>
          <button className={styles.btnClose} onClick={onCancel}><i className="fas fa-times"/> Cancelar</button>
        </div>
      </div>
    </div>
  );
}