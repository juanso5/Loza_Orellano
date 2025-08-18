import styles from "../styles/clientes.module.css";

export default function ClienteViewModal({ open, onClose, cliente, fmtARS, formatEsDateTime }) {
  if (!open || !cliente) return null;
  const get = (v, fallback = "No disponible") => (v ? v : fallback);

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modalContent} onMouseDown={(e) => e.stopPropagation()}>
        <h2 className={styles.viewTitle}>{cliente.name}</h2>
        <p><strong>CUIT:</strong> {get(cliente.cuit)}</p>
        <p><strong>Tipo de servicio:</strong> {get(cliente.serviceType)}</p>
        <p><strong>Fecha de alta:</strong> {get(formatEsDateTime?.(cliente.joinedAt))}</p>
        <p><strong>Sueldo:</strong> {cliente.salary !== undefined && cliente.salary !== "" ? fmtARS.format(Number(cliente.salary)) : "No disponible"}</p>
        <p><strong>Email:</strong> {get(cliente.email)}</p>
        <p><strong>Teléfono:</strong> {get(cliente.phone)}</p>
        <p><strong>Dirección:</strong> {get(cliente.address)}</p>
        <p><strong>Datos Financieros:</strong> {get(cliente.financialData)}</p>
        <p><strong>Perfil de Riesgo:</strong> {get(cliente.riskProfile)}</p>
        <p><strong>Comentarios:</strong> {get(cliente.comments)}</p>
        <div className={styles.modalFooter}>
          <button className={styles.btnClose} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}