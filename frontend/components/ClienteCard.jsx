import styles from "../styles/clientes.module.css";
export default function ClienteCard({ cliente, onView, onEdit, onDelete }) {
  const feeText = typeof cliente.fee === "number" ? `${cliente.fee}%` : (cliente.fee || "");
  const banksCount = Array.isArray(cliente.banks) ? cliente.banks.length : 0;
  return (
    <div className={styles.clientItem} onClick={onView} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onView(); }}>
      <div className={styles.clientMain}>
        <h3 className={styles.clientName}>{cliente.name}</h3>
        <div className={styles.clientMeta}>
          {cliente.riskProfile && <span><i className="fa-solid fa-gauge-high" style={{ marginRight: 6 }} />{cliente.riskProfile}</span>}
          {cliente.serviceType && <span><i className="fa-solid fa-briefcase" style={{ marginRight: 6 }} />{cliente.serviceType}</span>}
          {cliente.period && <span><i className="fa-regular fa-calendar" style={{ marginRight: 6 }} />{cliente.period}</span>}
          {feeText !== "" && <span><i className="fa-solid fa-percent" style={{ marginRight: 6 }} />{feeText}</span>}
        </div>
      </div>
      <div className={styles.clientActions} onClick={(e) => e.stopPropagation()}>
        <button className={styles.actionBtn} title="Ver" onClick={onView}><i className="fa-solid fa-eye" /></button>
        <button className={styles.actionBtn} title="Editar" onClick={onEdit}><i className="fas fa-pen" /></button>
        <button className={styles.actionBtn} title="Eliminar" onClick={onDelete}><i className="fas fa-trash" /></button>
      </div>
    </div>
  );
}