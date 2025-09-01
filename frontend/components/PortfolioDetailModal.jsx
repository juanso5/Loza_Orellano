import React, { useMemo, useState } from "react";

const PortfolioDetailModal = ({
  clients,
  context,         // { clientId, portfolioId }
  onClose,
  onSave,
  onOpenSpeciesHistory,
  onDelete,         // NUEVO: eliminar cartera
}) => {
  const client = useMemo(
    () => (clients || []).find((c) => c.id === context?.clientId),
    [clients, context]
  );
  const portfolio = useMemo(
    () => client?.portfolios?.find((p) => p.id === context?.portfolioId),
    [client, context]
  );

  const [fundFilter, setFundFilter] = useState("");
  const [editedFunds, setEditedFunds] = useState(() =>
    (portfolio?.funds || []).map((f) => ({ ...f }))
  );

  const filteredFunds = useMemo(() => {
    const q = (fundFilter || "").trim().toLowerCase();
    const list = editedFunds;
    if (!q) return list;
    return list.filter((f) => String(f.name || "").toLowerCase().includes(q));
  }, [editedFunds, fundFilter]);

  const total = useMemo(
    () => (editedFunds || []).reduce((s, f) => s + (Number(f.nominal) || 0), 0),
    [editedFunds]
  );

  const hasInvalid =
    !client ||
    !portfolio ||
    editedFunds.some(
      (f) => !Number.isFinite(Number(f.nominal)) || Number(f.nominal) < 0
    );

  const handleSave = async () => {
    if (hasInvalid) return;
    // Actualmente no persistimos nominal editado desde acá (se ajusta por movimientos).
    // Mantenemos botón Guardar para coherencia visual, delegando en onSave (edita plazo).
    await onSave?.({
      id: portfolio?.id,
      periodMonths: portfolio?.periodMonths ?? null,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasInvalid) handleSave();
  };

  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="modal"
      style={{ display: "flex" }}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-detail-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-dialog">
        <form onSubmit={handleSubmit}>
          <header className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 id="portfolio-detail-title">
              Detalle de cartera <span style={{ fontWeight: 600 }}>{`${client?.name} — ${portfolio?.name}`}</span>
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className="btn"
                title="Eliminar cartera"
                onClick={onDelete}
                style={{ color: "#a33" }}
              >
                <i className="fas fa-trash"></i>
              </button>
              <button
                type="button"
                className="modal-close"
                onClick={onClose}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
          </header>

          <div className="modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
              <div>
                <label htmlFor="portfolio-fund-filter">Filtrar especie</label>
                <input
                  id="portfolio-fund-filter"
                  placeholder="Filtrar dentro de la cartera..."
                  value={fundFilter}
                  onChange={(e) => setFundFilter(e.target.value)}
                />
              </div>
              <div className="muted" style={{ whiteSpace: 'nowrap' }}>
                Total nominal: {total.toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <table className="movements-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Especie</th>
                    <th>Nominal (unidades)</th>
                    <th>Rend. mensual</th>
                    <th>Rend. total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunds.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="muted">No hay especies en esta cartera.</td>
                    </tr>
                  ) : (
                    filteredFunds.map((f) => (
                      <tr key={f.id}>
                        <td
                          className="fund-name-link"
                          style={{ cursor: 'pointer', color: '#0f1720', fontWeight: 600 }}
                          onClick={() => onOpenSpeciesHistory?.(f.name)}
                        >
                          {f.name}
                        </td>
                        <td>
                          <input
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e6edf3' }}
                            value={(Number(f.nominal) || 0).toFixed(2)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedFunds((prev) =>
                                prev.map((x) => (x.id === f.id ? { ...x, nominal: Number(val) } : x))
                              );
                            }}
                          />
                        </td>
                        <td className="muted">—</td>
                        <td className="muted">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <footer className="modal-footer">
            <button type="submit" className="btn-save" disabled={hasInvalid} aria-disabled={hasInvalid}>
              <i className="fas fa-check"></i> Guardar
            </button>
            <button type="button" className="btn-close" onClick={onClose}>
              <i className="fas fa-times"></i> Cerrar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default PortfolioDetailModal;