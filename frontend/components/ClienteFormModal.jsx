import { useEffect, useMemo, useState } from "react";
import styles from "../styles/clientes.module.css";
export default function ClienteFormModal({ open, onClose, onSave, initial, helpers }) {
  const { isValidCuit, formatCuit } = helpers || {};
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  // Opciones dinámicas para "Perfil de riesgo"
  const DEFAULT_RISK_OPTIONS = useMemo(() => ["Bajo", "Moderado", "Alto"], []);
  const [riskOptions, setRiskOptions] = useState(DEFAULT_RISK_OPTIONS);
  const [customRisk, setCustomRisk] = useState("");
  // Período (con opción de agregar)
  const DEFAULT_PERIOD_OPTIONS = useMemo(
    () => ["Mensual", "Bimensual", "Trimestral", "6 meses", "Anual"],
    []
  );
  const [periodOptions, setPeriodOptions] = useState(DEFAULT_PERIOD_OPTIONS);
  const [customPeriod, setCustomPeriod] = useState("");
  // Inputs para agregar múltiples bancos (nombre + alias en la misma fila)
  const [newBankName, setNewBankName] = useState("");
  const [newBankAlias, setNewBankAlias] = useState("");
  // Edición inline de bancos
  const [editingIdx, setEditingIdx] = useState(null);
  const [editBankName, setEditBankName] = useState("");
  const [editBankAlias, setEditBankAlias] = useState("");
  // Inicializar valores y mapear banco único -> lista de bancos
  useEffect(() => {
    const base = { ...(initial || {}) };
    const banks = Array.isArray(base.banks)
      ? base.banks
          .map((b) => ({ name: (b?.name || "").trim(), alias: (b?.alias || "").trim() }))
          .filter((b) => b.name !== "")
      : base.bank
      ? [{ name: String(base.bank).trim(), alias: (base.bankAlias || "").trim() }]
      : [];
    base.banks = banks;
    // Compat: reflejar primer banco en bank/bankAlias
    base.bank = banks[0]?.name || "";
    base.bankAlias = banks[0]?.alias || "";
    // Mapear joinedAt -> joinedLocal para el input date
    if (base.joinedAt) {
      // Si es ISO completo, tomar solo la parte de fecha
      base.joinedLocal = base.joinedAt.split('T')[0];
    } else {
      // Si no hay fecha, usar la fecha actual
      base.joinedLocal = new Date().toISOString().split('T')[0];
    }
    setValues(base);
    setErrors({});
    // reset edición
    setEditingIdx(null);
    setEditBankName("");
    setEditBankAlias("");
    setNewBankName("");
    setNewBankAlias("");
  }, [initial, open]);
  // Incluir perfil inicial si es personalizado
  useEffect(() => {
    const rp = initial?.riskProfile;
    if (rp && !DEFAULT_RISK_OPTIONS.includes(rp)) {
      setRiskOptions((prev) => (prev.includes(rp) ? prev : [...prev, rp]));
    }
  }, [initial, DEFAULT_RISK_OPTIONS]);
  // Incluir período inicial si es personalizado
  useEffect(() => {
    const p = initial?.period;
    if (p && !DEFAULT_PERIOD_OPTIONS.includes(p)) {
      setPeriodOptions((prev) => (prev.includes(p) ? prev : [...prev, p]));
    }
  }, [initial, DEFAULT_PERIOD_OPTIONS]);
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape" && open) onClose?.(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);
  if (!open) return null;
  const isIntegral = values.serviceType === "Integral";
  function handleSubmit(e) {
    e.preventDefault();
    const nextErrors = {};
    if (!values.name?.trim()) nextErrors.name = "El nombre es obligatorio.";
    // No dejar “modo agregar” sin confirmar
    if (values.riskProfile === "__custom__") {
      nextErrors.riskProfile = "Confirmá la nueva opción de riesgo o seleccioná una existente.";
    }
    if (values.period === "__period_custom__") {
      nextErrors.period = "Confirmá el nuevo período o seleccioná uno existente.";
    }
    // Arancel (%)
    if (values.fee !== "" && values.fee !== undefined) {
      const f = Number(String(values.fee).replace(",", "."));
      if (Number.isNaN(f) || f < 0 || f > 100) nextErrors.fee = "Arancel inválido (0 a 100%).";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave?.(values);
  }
  // Perfil de riesgo
  const onRiskChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setCustomRisk("");
      setValues((v) => ({ ...v, riskProfile: "__custom__" }));
    } else {
      setValues((v) => ({ ...v, riskProfile: val }));
    }
  };
  const addCustomRisk = () => {
    const label = (customRisk || "").trim();
    if (!label) return;
    setRiskOptions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setValues((v) => ({ ...v, riskProfile: label }));
    setCustomRisk("");
    setErrors((prev) => {
      const { riskProfile, ...rest } = prev || {};
      return rest;
    });
  };
  // Período
  const onPeriodChange = (e) => {
    const val = e.target.value;
    if (val === "__period_custom__") {
      setCustomPeriod("");
      setValues((v) => ({ ...v, period: "__period_custom__" }));
    } else {
      setValues((v) => ({ ...v, period: val }));
    }
  };
  const addCustomPeriod = () => {
    const label = (customPeriod || "").trim();
    if (!label) return;
    setPeriodOptions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setValues((v) => ({ ...v, period: label }));
    setCustomPeriod("");
    setErrors((prev) => {
      const { period, ...rest } = prev || {};
      return rest;
    });
  };
  // Bancos (múltiples)
  const addBank = () => {
    const name = newBankName.trim();
    const alias = newBankAlias.trim();
    if (!name) return;
    setValues((v) => {
      const current = Array.isArray(v.banks) ? v.banks : [];
      const exists = current.some(
        (b) =>
          (b.name || "").trim().toLowerCase() === name.toLowerCase() &&
          (b.alias || "").trim().toLowerCase() === alias.toLowerCase()
      );
      const banks = exists ? current : [...current, { name, alias }];
      const first = banks[0];
      return { ...v, banks, bank: first?.name || "", bankAlias: first?.alias || "" };
    });
    setNewBankName("");
    setNewBankAlias("");
  };
  const removeBank = (idx) => {
    setValues((v) => {
      const banks = (v.banks || []).filter((_, i) => i !== idx);
      const first = banks[0];
      return { ...v, banks, bank: first?.name || "", bankAlias: first?.alias || "" };
    });
    if (editingIdx === idx) {
      setEditingIdx(null);
      setEditBankName("");
      setEditBankAlias("");
    }
  };
  const updateBank = (idx, patch) => {
    setValues((v) => {
      const banks = (v.banks || []).map((b, i) => (i === idx ? { ...b, ...patch } : b));
      const first = banks[0];
      return { ...v, banks, bank: first?.name || "", bankAlias: first?.alias || "" };
    });
  };
  const addBankOnEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBank();
    }
  };
  const startEditBank = (idx) => {
    const b = values.banks?.[idx];
    if (!b) return;
    setEditingIdx(idx);
    setEditBankName(b.name || "");
    setEditBankAlias(b.alias || "");
  };
  const saveEditBank = () => {
    const name = (editBankName || "").trim();
    if (!name) return;
    updateBank(editingIdx, { name, alias: (editBankAlias || "").trim() });
    setEditingIdx(null);
    setEditBankName("");
    setEditBankAlias("");
  };
  const cancelEditBank = () => {
    setEditingIdx(null);
    setEditBankName("");
    setEditBankAlias("");
  };
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="cliente-modal-title" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={styles.modalDialog} onMouseDown={(e) => e.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2 id="cliente-modal-title">{initial?.id ? "Editar Cliente" : "Agregar Cliente"}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Cerrar">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>
        <div className={styles.modalBody}>
          <form onSubmit={handleSubmit} className={styles.formGrid} autoComplete="off" noValidate>
            {/* Nombre */}
            <div className={styles.formGroup}>
              <label>Nombre <span className={styles.required}>*</span></label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-user ${styles.inputIcon}`}></i>
                <input
                  type="text"
                  value={values.name}
                  onChange={(e) => setValues({ ...values, name: e.target.value })}
                  placeholder=""
                  required
                />
              </div>
              {errors.name && <span className={styles.error}>{errors.name}</span>}
            </div>
            {/* Teléfono */}
            <div className={styles.formGroup}>
              <label>Teléfono</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-phone ${styles.inputIcon}`}></i>
                <input
                  type="text"
                  value={values.phone}
                  onChange={(e) => setValues({ ...values, phone: e.target.value })}
                  placeholder=""
                />
              </div>
            </div>
            {/* Fecha de alta */}
            <div className={styles.formGroup}>
              <label>Fecha de alta</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-calendar ${styles.inputIcon}`}></i>
                <input
                  type="date"
                  value={values.joinedLocal}
                  onChange={(e) => setValues({ ...values, joinedLocal: e.target.value })}
                />
              </div>
            </div>
            {/* Perfil de riesgo */}
            <div className={styles.formGroup}>
              <label>Perfil de riesgo</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-gauge-high ${styles.inputIcon}`}></i>
                <select
                  value={values.riskProfile === "__custom__" ? "__custom__" : (values.riskProfile ?? "Moderado")}
                  onChange={onRiskChange}
                >
                  {riskOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__custom__">+ Agregar opción…</option>
                </select>
              </div>
              {values.riskProfile === "__custom__" && (
                <div className={styles.inputWithIcon} style={{ marginTop: 8 }}>
                  <i className={`fa-solid fa-plus ${styles.inputIcon}`}></i>
                  <input
                    type="text"
                    placeholder="Nueva opción de riesgo"
                    value={customRisk}
                    onChange={(e) => setCustomRisk(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomRisk(); } }}
                  />
                  <button type="button" className="btn-save" onClick={addCustomRisk} style={{ marginLeft: 8 }}>
                    Agregar
                  </button>
                </div>
              )}
              {errors.riskProfile && <span className={styles.error}>{errors.riskProfile}</span>}
            </div>
            {/* Período */}
            <div className={styles.formGroup}>
              <label>Período</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-calendar ${styles.inputIcon}`}></i>
                <select
                  value={values.period === "__period_custom__" ? "__period_custom__" : (values.period ?? "Mensual")}
                  onChange={onPeriodChange}
                >
                  {periodOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__period_custom__">+ Agregar opción…</option>
                </select>
              </div>
              {values.period === "__period_custom__" && (
                <div className={styles.inputWithIcon} style={{ marginTop: 8 }}>
                  <i className={`fa-solid fa-plus ${styles.inputIcon}`}></i>
                  <input
                    type="text"
                    placeholder="Nuevo período"
                    value={customPeriod}
                    onChange={(e) => setCustomPeriod(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPeriod(); } }}
                  />
                  <button type="button" className="btn-save" onClick={addCustomPeriod} style={{ marginLeft: 8 }}>
                    Agregar
                  </button>
                </div>
              )}
              {errors.period && <span className={styles.error}>{errors.period}</span>}
            </div>
            {/* Arancel (%) */}
            <div className={styles.formGroup}>
              <label>Arancel (%)</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-percent ${styles.inputIcon}`}></i>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={values.fee ?? ""}
                  onChange={(e) => setValues({ ...values, fee: e.target.value })}
                  placeholder=""
                />
              </div>
              <small className={styles.hint}>Porcentaje a cobrar al cliente (0–100%)</small>
              {errors.fee && <span className={styles.error}>{errors.fee}</span>}
            </div>
            {/* Tipo de servicio (arriba de Bancos) */}
            <div className={styles.formGroup}>
              <label>Tipo de servicio</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-briefcase ${styles.inputIcon}`}></i>
                <select
                  value={values.serviceType}
                  onChange={(e) => setValues({ ...values, serviceType: e.target.value })}
                >
                  <option value="Integral">Integral</option>
                  <option value="Cartera Administrada">Cartera Administrada</option>
                </select>
              </div>
            </div>
            {/* Bancos (múltiples) + Alias por banco (fila de alta + lista editable) */}
            <div className={styles.formGroup}>
              <label>Bancos</label>
              {/* Alta: Nombre + Alias + botón "+" en una sola fila */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <div className={styles.inputWithIcon}>
                  <i className={`fa-solid fa-building-columns ${styles.inputIcon}`}></i>
                  <input
                    type="text"
                    placeholder="Nombre del banco"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    onKeyDown={addBankOnEnter}
                  />
                </div>
                <div className={styles.inputWithIcon}>
                  <i className={`fa-solid fa-id-badge ${styles.inputIcon}`}></i>
                  <input
                    type="text"
                    placeholder="Alias (opcional)"
                    value={newBankAlias}
                    onChange={(e) => setNewBankAlias(e.target.value)}
                    onKeyDown={addBankOnEnter}
                  />
                </div>
                <button
                  type="button"
                  className="btn-save"
                  onClick={addBank}
                  aria-label="Agregar banco"
                  title="Agregar banco"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 40 }}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>
              </div>
              {/* Lista en tarjetas compactas */}
              {(values.banks && values.banks.length > 0) && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {values.banks.map((b, idx) => {
                    const isEditing = editingIdx === idx;
                    return (
                      <div
                        key={`${b.name}-${idx}`}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: 10,
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 8,
                          alignItems: "center",
                          background: "#fff"
                        }}
                      >
                        <div>
                          {!isEditing ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{b.name || "-"}</div>
                              {b.alias ? (
                                <div className={styles.hint} style={{ marginTop: 2 }}>Alias: {b.alias}</div>
                              ) : (
                                <div className={styles.hint} style={{ marginTop: 2, opacity: 0.8 }}>Sin alias</div>
                              )}
                            </>
                          ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div className={styles.inputWithIcon}>
                                <i className={`fa-solid fa-building-columns ${styles.inputIcon}`}></i>
                                <input
                                  type="text"
                                  value={editBankName}
                                  onChange={(e) => setEditBankName(e.target.value)}
                                  placeholder="Nombre del banco"
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEditBank(); } }}
                                />
                              </div>
                              <div className={styles.inputWithIcon}>
                                <i className={`fa-solid fa-id-badge ${styles.inputIcon}`}></i>
                                <input
                                  type="text"
                                  value={editBankAlias}
                                  onChange={(e) => setEditBankAlias(e.target.value)}
                                  placeholder="Alias (opcional)"
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEditBank(); } }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                className="btn-save"
                                onClick={() => startEditBank(idx)}
                                aria-label="Editar banco"
                                title="Editar banco"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button
                                type="button"
                                className="btn-close"
                                onClick={() => removeBank(idx)}
                                aria-label="Eliminar banco"
                                title="Eliminar banco"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn-save"
                                onClick={saveEditBank}
                                aria-label="Guardar cambios"
                                title="Guardar cambios"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                              <button
                                type="button"
                                className="btn-close"
                                onClick={cancelEditBank}
                                aria-label="Cancelar"
                                title="Cancelar"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Comentarios */}
            <div className={`${styles.formGroup} ${styles.span2}`}>
              <label>Comentarios</label>
              <textarea
                value={values.comments}
                onChange={(e) => setValues({ ...values, comments: e.target.value })}
                placeholder=""
              />
            </div>
            <div className={`${styles.modalFooter} ${styles.span2}`}>
              <button type="submit" className="btn-save"><i className="fas fa-check"></i> Guardar</button>
              <button type="button" className="btn-close" onClick={onClose}><i className="fas fa-times"></i> Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
