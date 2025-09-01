// components/AddPortfolioModal.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";

// YYYY-MM-DD para <input type="date">
function toDateInputValue(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// DD-MM-YYYY para mostrar
function toDisplayDMY(d) {
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// Parse seguro desde YYYY-MM-DD a Date (local)
function parseDateInput(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function computeEndDate(fechaAltaInput, tipoPlazo, periodo) {
  if (!fechaAltaInput || !periodo) return null;
  const start = parseDateInput(fechaAltaInput);
  if (!start) return null;

  const end = new Date(start);
  const p = Number(periodo) || 0;
  if (p <= 0) return null;

  const t = String(tipoPlazo || "").toLowerCase();
  if (t === "meses") {
    end.setMonth(end.getMonth() + p);
  } else if (t === "dias" || t === "días") {
    end.setDate(end.getDate() + p);
  } else if (t === "año" || t === "años" || t === "anio" || t === "anios") {
    end.setFullYear(end.getFullYear() + p);
  } else {
    return null;
  }
  return end;
}

const AddPortfolioModal = ({ onClose, onSave, uid, existingNames = [] }) => {
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [tipoPlazo, setTipoPlazo] = useState("meses"); // meses | dias | años (solo visual)
  const [fechaAlta, setFechaAlta] = useState(() => toDateInputValue(new Date())); // YYYY-MM-DD para input
  const [rendEsperado, setRendEsperado] = useState("");
  const [depositoInicial, setDepositoInicial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef(null);

  // Autofocus en nombre
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Validaciones
  const periodNum = Number.isFinite(parseInt(period, 10)) ? parseInt(period, 10) : NaN;
  const fechaValida = useMemo(() => !!parseDateInput(fechaAlta), [fechaAlta]);

  const errors = useMemo(() => {
    const es = {};
    if (name && existingNames.map((n) => n.toLowerCase().trim()).includes(name.toLowerCase().trim())) {
      es.name = "Ya existe una cartera con ese nombre.";
    }
    if (!Number.isFinite(periodNum) || periodNum < 1) es.period = "";
    if (!fechaValida) es.fechaAlta = "Ingresá una fecha válida.";
    if (rendEsperado !== "" && !Number.isFinite(Number(rendEsperado))) {
      es.rendEsperado = "Debe ser un número.";
    }
    if (depositoInicial !== "" && (!Number.isFinite(Number(depositoInicial)) || Number(depositoInicial) < 0)) {
      es.depositoInicial = "Debe ser un número mayor o igual a 0.";
    }
    return es;
  }, [name, existingNames, periodNum, fechaValida, rendEsperado, depositoInicial]);

  const isSaveDisabled = submitting || Object.keys(errors).length > 0;

  // Preview de fecha fin (DD-MM-YYYY)
  const endDate = useMemo(() => computeEndDate(fechaAlta, tipoPlazo, periodNum), [fechaAlta, tipoPlazo, periodNum]);

  const handleSave = async () => {
    if (isSaveDisabled) return;
    try {
      setSubmitting(true);
      const payload = {
        id: uid?.("p"),
        name: name.trim(),
        // Mantener periodo en meses para backend (consistente con tu página)
        periodMonths:
          String(tipoPlazo).toLowerCase() === "meses"
            ? periodNum
            : String(tipoPlazo).toLowerCase().startsWith("a")
            ? periodNum * 12
            : Math.round(periodNum / 30),
        // Estos campos son opcionales para tu POST /api/fondo
        tipo_plazo: String(tipoPlazo).toLowerCase() === "dias" || String(tipoPlazo).toLowerCase() === "días" ? "dias" : "meses",
        fecha_alta: fechaAlta, // YYYY-MM-DD (backend acepta este formato)
        rend_esperado: rendEsperado === "" ? null : Number(rendEsperado),
        deposito_inicial: depositoInicial === "" ? null : Number(depositoInicial),
        progress: 0,
        funds: [],
      };
      await onSave?.(payload);
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSaveDisabled) handleSave();
  };

  // Cerrar al hacer click fuera del modal (overlay)
  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget && !submitting) {
      onClose?.();
    }
  };

  return (
    <div
      className="modal"
      style={{ display: "flex" }}
      aria-hidden="false"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-portfolio-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="modal-dialog">
        <form onSubmit={handleSubmit} noValidate>
          <header className="modal-header">
            <h2 id="add-portfolio-title">Agregar nueva cartera</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Cerrar"
              disabled={submitting}
            >
              &times;
            </button>
          </header>

          <div className="modal-body">
            <div className="input-group">
              <label htmlFor="add-portfolio-name">
                Nombre de la cartera <span className="required">*</span>
              </label>
              <input
                id="add-portfolio-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errors.name ? "true" : "false"}
                aria-describedby={errors.name ? "err-name" : undefined}
                disabled={submitting}
              />
              {errors.name && (
                <div className="error-message" id="err-name">
                  {errors.name}
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="tipo-plazo">Tipo de plazo</label>
              <select
                id="tipo-plazo"
                value={tipoPlazo}
                onChange={(e) => setTipoPlazo(e.target.value)}
                disabled={submitting}
              >
                <option value="dias">Días</option>
                <option value="meses">Meses</option>
                <option value="años">Años</option>
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="add-portfolio-period">
                Periodo objetivo ({tipoPlazo}) <span className="required">*</span>
              </label>
              <input
                id="add-portfolio-period"
                type="number"
                min="1"
                step="1"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                aria-invalid={errors.period ? "true" : "false"}
                aria-describedby={errors.period ? "err-period" : undefined}
                disabled={submitting}
              />
              {errors.period && (
                <div className="error-message" id="err-period">
                  {errors.period}
                </div>
              )}
              <div className="hint muted">
                {endDate ? `Termina el: ${toDisplayDMY(endDate)}` : ""}
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="fecha-alta">
                Fecha de alta <span className="required">*</span>
              </label>
              <input
                id="fecha-alta"
                type="date"
                value={fechaAlta}
                onChange={(e) => setFechaAlta(e.target.value)}
                aria-invalid={errors.fechaAlta ? "true" : "false"}
                aria-describedby={errors.fechaAlta ? "err-fecha" : undefined}
                disabled={submitting}
              />
              {errors.fechaAlta && (
                <div className="error-message" id="err-fecha">
                  {errors.fechaAlta}
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="rend-esperado">Rendimiento esperado (opcional)</label>
              <input
                id="rend-esperado"
                type="number"
                step="any"
                value={rendEsperado}
                onChange={(e) => setRendEsperado(e.target.value)}
                aria-invalid={errors.rendEsperado ? "true" : "false"}
                aria-describedby={errors.rendEsperado ? "err-rend" : undefined}
                disabled={submitting}
              />
              {errors.rendEsperado && (
                <div className="error-message" id="err-rend">
                  {errors.rendEsperado}
                </div>
              )}
            </div>

            <div className="input-group">
              <label htmlFor="deposito-inicial">Depósito inicial (opcional)</label>
              <input
                id="deposito-inicial"
                type="number"
                step="any"
                min="0"
                value={depositoInicial}
                onChange={(e) => setDepositoInicial(e.target.value)}
                aria-invalid={errors.depositoInicial ? "true" : "false"}
                aria-describedby={errors.depositoInicial ? "err-dep" : undefined}
                disabled={submitting}
              />
              {errors.depositoInicial && (
                <div className="error-message" id="err-dep">
                  {errors.depositoInicial}
                </div>
              )}
            </div>
          </div>

          <footer className="modal-footer">
            <button
              type="submit"
              className="btn-save"
              disabled={isSaveDisabled}
              aria-disabled={isSaveDisabled}
            >
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Guardando…
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i> Guardar
                </>
              )}
            </button>
            <button type="button" className="btn-close" onClick={onClose} disabled={submitting}>
              <i className="fas fa-times"></i> Cancelar
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddPortfolioModal;