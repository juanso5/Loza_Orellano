import styles from "../styles/clientes.module.css";

export default function ClienteCard({ cliente, onView, onEdit, onDelete }) {
  return (
    <div className={styles.clientItem} onClick={onView} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onView(); }}>
      <div className={styles.clientMain}>
        <h3 className={styles.clientName}>{cliente.name}</h3>
        <div className={styles.clientMeta}>
          {cliente.serviceType && (
            <span><i className="fa-solid fa-briefcase"></i> {cliente.serviceType}</span>
          )}
          {cliente.cuit && (
            <span><i className="fa-regular fa-id-card"></i> {cliente.cuit}</span>
          )}
          {cliente.email && (
            <span><i className="fa-regular fa-envelope"></i> {cliente.email}</span>
          )}
          {cliente.phone && (
            <span><i className="fa-solid fa-phone"></i> {cliente.phone}</span>
          )}
          {cliente.riskProfile && (
            <span><i className="fa-solid fa-gauge-high"></i> {cliente.riskProfile}</span>
          )}
        </div>
      </div>

      <div className={styles.clientActions} onClick={(e) => e.stopPropagation()}>
        <button className={`${styles.actionBtn} ${styles.editBtn}`} title="Editar" aria-label="Editar" onClick={onEdit}>
          <i className="fas fa-pen" />
        </button>
        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Eliminar" aria-label="Eliminar" onClick={onDelete}>
          <i className="fas fa-trash" />
        </button>
      </div>
    </div>
  );
}
