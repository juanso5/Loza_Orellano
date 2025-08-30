import styles from "../styles/clientes.module.css";

export default function ClienteViewModal({ open, onClose, cliente, fmtARS, formatEsDate }) {
  if (!open || !cliente) return null;

  const feeText = typeof cliente.fee === "number" ? `${cliente.fee}%` : (cliente.fee || "");
  const banks = Array.isArray(cliente.banks) ? cliente.banks : [];
  const fechaAlta = formatEsDate ? formatEsDate(cliente.joinedAt) : "";

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="view-cliente-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modalContent} onMouseDown={(e) => e.stopPropagation()}>
        <h3 id="view-cliente-title" className={styles.viewTitle}>
          <i className="fa-regular fa-id-badge" style={{ marginRight: 8 }} />
          {cliente.name}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow icon="fa-solid fa-phone" label="Teléfono" value={cliente.phone} />
          <InfoRow icon="fa-regular fa-calendar" label="Fecha de alta" value={fechaAlta} />

          <InfoRow icon="fa-solid fa-gauge-high" label="Perfil de riesgo" value={cliente.riskProfile} />
          <InfoRow icon="fa-regular fa-calendar" label="Período" value={cliente.period} />

          <InfoRow icon="fa-solid fa-percent" label="Arancel" value={feeText} />
          <InfoRow icon="fa-solid fa-briefcase" label="Tipo de servicio" value={cliente.serviceType} />

          <div className={styles.span2}>
            <label style={{ fontWeight: 600, color: "#1f2937" }}><i className="fa-solid fa-building-columns" style={{ marginRight: 8 }} />Bancos</label>
            {banks.length === 0 ? (
              <div className={styles.hint}>Sin bancos cargados</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                {banks.map((b, idx) => (
                  <div key={`${b.name}-${idx}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, background: "#fbfdff" }}>
                    <div style={{ fontWeight: 600 }}>{b?.name || "-"}</div>
                    <div className={styles.hint} style={{ marginTop: 2 }}>{b?.alias ? `Alias: ${b.alias}` : "Sin alias"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cliente.comments && (
            <div className={styles.span2}>
              <label style={{ fontWeight: 600, color: "#1f2937" }}><i className="fa-regular fa-comments" style={{ marginRight: 8 }} />Comentarios</label>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{cliente.comments}</div>
            </div>
          )}
        </div>

        <div className={styles.modalFooter} style={{ marginTop: 14 }}>
          <button className="btn-close" onClick={onClose}><i className="fa-solid fa-xmark" /> Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className={styles.formGroup}>
      <label style={{ marginBottom: 4 }}><i className={icon} style={{ marginRight: 8 }} />{label}</label>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fbfdff", padding: "10px 12px" }}>
        {value || <span className={styles.hint}>-</span>}
      </div>
    </div>
  );
}