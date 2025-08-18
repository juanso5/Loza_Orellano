import { useEffect, useMemo, useState } from "react";
import styles from "../styles/clientes.module.css";

export default function ClienteFormModal({ open, onClose, onSave, initial, helpers }) {
  const { isValidCuit, formatCuit } = helpers || {};
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});

  useEffect(() => { setValues(initial); setErrors({}); }, [initial, open]);

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

    if (values.email?.trim()) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(values.email)) nextErrors.email = "Ingrese un email válido.";
    }

    if (values.cuit?.trim()) {
      if (!isValidCuit?.(values.cuit)) nextErrors.cuit = "CUIT inválido. Debe tener 11 dígitos (ej. 20-12345678-3).";
    }

    if (isIntegral && values.salary !== "") {
      const n = Number(String(values.salary).replace(",", "."));
      if (Number.isNaN(n) || n < 0) nextErrors.salary = "Ingrese un sueldo válido (número mayor o igual a 0).";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    onSave?.(values);
  }

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

            {/* Fecha/hora alta */}
            <div className={styles.formGroup}>
              <label>Fecha y hora de alta</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-calendar-plus ${styles.inputIcon}`}></i>
                <input
                  type="datetime-local"
                  value={values.joinedLocal}
                  onChange={(e) => setValues({ ...values, joinedLocal: e.target.value })}
                />
              </div>
            </div>

            {/* Email */}
            <div className={styles.formGroup}>
              <label>Email</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-envelope ${styles.inputIcon}`}></i>
                <input
                  type="email"
                  value={values.email}
                  onChange={(e) => setValues({ ...values, email: e.target.value })}
                  placeholder=""
                />
              </div>
              {errors.email && <span className={styles.error}>{errors.email}</span>}
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

            {/* CUIT */}
            <div className={styles.formGroup}>
              <label>CUIT</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-regular fa-id-card ${styles.inputIcon}`}></i>
                <input
                  type="text"
                  value={values.cuit}
                  onChange={(e) => {
                    const v = e.target.value;
                    // Formateo suave: cuando tiene 11 dígitos, mostramos xx-xxxxxxxx-x
                    const digits = v.replace(/\D/g, "");
                    setValues({ ...values, cuit: digits.length === 11 ? formatCuit(digits) : v });
                  }}
                  inputMode="numeric"
                  placeholder=""
                />
              </div>
              {errors.cuit && <span className={styles.error}>{errors.cuit}</span>}
            </div>

            {/* Dirección */}
            <div className={styles.formGroup}>
              <label>Dirección</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-location-dot ${styles.inputIcon}`}></i>
                <input
                  type="text"
                  value={values.address}
                  onChange={(e) => setValues({ ...values, address: e.target.value })}
                  placeholder=""
                />
              </div>
            </div>

            {/* Datos financieros */}
            <div className={styles.formGroup}>
              <label>Datos financieros</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-coins ${styles.inputIcon}`}></i>
                <input
                  type="text"
                  value={values.financialData}
                  onChange={(e) => setValues({ ...values, financialData: e.target.value })}
                  placeholder=""
                />
              </div>
            </div>

            {/* Perfil de riesgo */}
            <div className={styles.formGroup}>
              <label>Perfil de riesgo</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-gauge-high ${styles.inputIcon}`}></i>
                <select
                  value={values.riskProfile}
                  onChange={(e) => setValues({ ...values, riskProfile: e.target.value })}
                >
                  <option value="Bajo">Bajo</option>
                  <option value="Moderado">Moderado</option>
                  <option value="Alto">Alto</option>
                </select>
              </div>
            </div>

            {/* Tipo de servicio */}
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

            {/* Sueldo (solo Integral) */}
            <div className={`${styles.formGroup} ${!isIntegral ? styles.hidden : ""}`}>
              <label>Sueldo (mensual)</label>
              <div className={styles.inputWithIcon}>
                <i className={`fa-solid fa-money-bill-wave ${styles.inputIcon}`}></i>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.salary}
                  onChange={(e) => setValues({ ...values, salary: e.target.value })}
                  placeholder=""
                />
              </div>
              <small className={styles.hint}>Sueldo neto mensual (opcional)</small>
              {errors.salary && <span className={styles.error}>{errors.salary}</span>}
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
              <button type="submit" className={styles.btnSave}>Guardar</button>
              <button type="button" className={styles.btnClose} onClick={onClose}>Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
