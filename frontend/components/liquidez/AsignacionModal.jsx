"use client";
import { useState, useEffect } from "react";
export default function AsignacionModal({
  isOpen,
  onClose,
  onSave,
  clienteId,
  fondo,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [liquidezDisponible, setLiquidezDisponible] = useState(null);
  const [tipoCambioActual, setTipoCambioActual] = useState(null);
  const [formData, setFormData] = useState({
    monto: "",
    moneda: "USD",
    tipo_cambio_usado: "",
    tipo_operacion: "asignacion",
    comentario: "",
  });
  useEffect(() => {
    if (isOpen && clienteId) {
      // Cargar liquidez disponible
      fetch(`/api/liquidez/estado?cliente_id=${clienteId}`)
        .then(r => r.json())
        .then((liquidezData) => {
          if (liquidezData.success) {
            setLiquidezDisponible(liquidezData.data.liquidezDisponible);
          }
        })
        .catch((err) => {
          });
      // Cargar el tipo de cambio actual desde la base de datos
      fetch('/api/tipo-cambio-actual')
        .then(r => r.json())
        .then((tcData) => {
          if (tcData.success && tcData.data?.valor) {
            const tc = tcData.data.valor;
            setTipoCambioActual(tc);
            setFormData(prev => ({ ...prev, tipo_cambio_usado: tc.toString() }));
          } else {
            setTipoCambioActual(null);
            setFormData(prev => ({ ...prev, tipo_cambio_usado: "" }));
          }
        })
        .catch((err) => {
          setTipoCambioActual(null);
          setFormData(prev => ({ ...prev, tipo_cambio_usado: "" }));
        });
    }
  }, [isOpen, clienteId]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const payload = {
        cliente_id: clienteId,
        fondo_id: fondo.id_fondo,
        monto: parseFloat(formData.monto),
        moneda: formData.moneda,
        tipo_cambio_usado: parseFloat(formData.tipo_cambio_usado) || null,
        tipo_operacion: formData.tipo_operacion,
        comentario: formData.comentario,
      };
      const resp = await fetch("/api/liquidez/asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Error al procesar la asignación");
      }
      // Actualizar el tipo de cambio actual en la base de datos
      if (payload.tipo_cambio_usado) {
        fetch('/api/tipo-cambio-actual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valor: payload.tipo_cambio_usado,
            comentario: `Actualizado desde asignación a fondo #${fondo.id_fondo}`
          })
        }).catch(err => {/* Error al actualizar tipo cambio */});
      }
      setSuccess("Operación realizada correctamente");
      setTimeout(() => {
        onSave();
        onClose();
        // Reset form - mantiene el tipo de cambio usado
        setFormData(prev => ({
          monto: "",
          moneda: "USD",
          tipo_cambio_usado: prev.tipo_cambio_usado, // Mantiene el último usado
          tipo_operacion: "asignacion",
          comentario: "",
        }));
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  if (!isOpen) return null;
  // Calcular montos
  const monto = parseFloat(formData.monto) || 0;
  const tc = parseFloat(formData.tipo_cambio_usado) || 1;
  const montoUSD = formData.moneda === "ARS" ? monto / tc : monto;
  const excedeDisponible =
    formData.tipo_operacion === "asignacion" &&
    liquidezDisponible !== null &&
    montoUSD > liquidezDisponible;
  // Datos del fondo
  const nombreFondo = fondo?.nombre || fondo?.tipo_cartera?.descripcion || `Fondo #${fondo?.id_fondo}`;
  const color = fondo?.tipo_cartera?.color || '#3b82f6';
  const esAsignacion = formData.tipo_operacion === "asignacion";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          maxWidth: "540px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header simple */}
        <div style={{
          padding: "1.5rem",
          borderBottom: "1px solid #e5e7eb"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: "1.25rem", 
              fontWeight: "700",
              color: "#111827"
            }}>
              {esAsignacion ? "Asignar" : "Desasignar"} Liquidez
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                cursor: "pointer",
                color: "#6b7280",
                fontSize: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
                e.currentTarget.style.color = "#111827";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              ×
            </button>
          </div>
          {/* Info del fondo */}
          <div style={{
            marginTop: "1rem",
            padding: "0.875rem",
            background: "#f9fafb",
            borderRadius: "8px",
            border: "1px solid #e5e7eb"
          }}>
            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
              Fondo seleccionado
            </div>
            <div style={{ fontSize: "0.9375rem", fontWeight: "600", color: "#111827" }}>
              {nombreFondo}
            </div>
          </div>
        </div>
        {/* Body del formulario */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {/* Liquidez disponible del cliente (para asignación) */}
          {esAsignacion && liquidezDisponible !== null && (
            <div style={{
              background: excedeDisponible ? "#fef2f2" : "#eff6ff",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1.25rem",
              border: excedeDisponible ? "1px solid #fca5a5" : "1px solid #bfdbfe"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#6b7280", textTransform: "uppercase" }}>
                  💰 Liquidez Disponible del Cliente
                </span>
                {excedeDisponible && (
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    color: "#dc2626"
                  }}>
                    ⚠ Insuficiente
                  </span>
                )}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "800", color: excedeDisponible ? "#dc2626" : "#3b82f6" }}>
                ${liquidezDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
            </div>
          )}
          {/* Liquidez asignada al fondo (para desasignación) */}
          {!esAsignacion && fondo?.liquidez_asignada !== undefined && (
            <div style={{
              background: "#f0fdf4",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1.25rem",
              border: "1px solid #86efac"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "#15803d", textTransform: "uppercase" }}>
                  📊 Liquidez Asignada al Fondo
                </span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: "800", color: "#16a34a" }}>
                ${(fondo.liquidez_asignada || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </div>
              <div style={{ fontSize: "0.75rem", color: "#15803d", marginTop: "6px" }}>
                Este es el monto máximo que puedes desasignar
              </div>
            </div>
          )}
          {/* Tipo de operación */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem", color: "#374151" }}>
              Tipo de Operación
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo_operacion: "asignacion" })}
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: formData.tipo_operacion === "asignacion" ? `2px solid ${color}` : "1px solid #e5e7eb",
                  background: formData.tipo_operacion === "asignacion" ? "#f9fafb" : "#fff",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: formData.tipo_operacion === "asignacion" ? color : "#6b7280",
                  transition: "all 0.2s"
                }}
              >
                Asignación
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, tipo_operacion: "desasignacion" })}
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: formData.tipo_operacion === "desasignacion" ? `2px solid ${color}` : "1px solid #e5e7eb",
                  background: formData.tipo_operacion === "desasignacion" ? "#f9fafb" : "#fff",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: formData.tipo_operacion === "desasignacion" ? color : "#6b7280",
                  transition: "all 0.2s"
                }}
              >
                Desasignación
              </button>
            </div>
          </div>
          {/* Moneda */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem", color: "#374151" }}>
              Moneda
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {["USD", "ARS"].map(moneda => (
                <button
                  key={moneda}
                  type="button"
                  onClick={() => setFormData({ ...formData, moneda })}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: formData.moneda === moneda ? `2px solid ${color}` : "1px solid #e5e7eb",
                    background: formData.moneda === moneda ? "#f9fafb" : "#fff",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    fontWeight: "700",
                    color: formData.moneda === moneda ? color : "#6b7280",
                    transition: "all 0.2s"
                  }}
                >
                  {moneda}
                </button>
              ))}
            </div>
          </div>
          {/* Monto */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem", color: "#374151" }}>
              Monto *
            </label>
            <input
              type="number"
              name="monto"
              value={formData.monto}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: `1px solid ${excedeDisponible ? "#fca5a5" : "#d1d5db"}`,
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "500",
                outline: "none"
              }}
              placeholder="0.00"
            />
            {excedeDisponible && (
              <div style={{
                marginTop: "6px",
                fontSize: "0.8125rem",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <span>⚠</span>
                El monto excede la liquidez disponible
              </div>
            )}
          </div>
          {/* Tipo de Cambio - SIEMPRE visible */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem", color: "#374151" }}>
              Tipo de Cambio (USD/ARS) *
            </label>
            <input
              type="number"
              name="tipo_cambio_usado"
              value={formData.tipo_cambio_usado}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "1rem",
                outline: "none"
              }}
              placeholder="1500.00"
            />
            {tipoCambioActual && (
              <div style={{
                marginTop: "6px",
                fontSize: "0.75rem",
                color: "#6b7280"
              }}>
                💡 Tipo de cambio actual: ${tipoCambioActual.toFixed(2)}
              </div>
            )}
          </div>
          {/* Equivalencia */}
          {monto > 0 && (
            <div style={{
              background: "#f9fafb",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1.25rem",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "6px" }}>
                Equivalencia
              </div>
              <div style={{ fontSize: "1rem", fontWeight: "700", color: "#111827" }}>
                {formData.moneda === "USD" ? (
                  <>USD ${monto.toFixed(2)} = ARS ${(monto * tc).toFixed(2)}</>
                ) : (
                  <>ARS ${monto.toFixed(2)} = USD ${montoUSD.toFixed(2)}</>
                )}
              </div>
            </div>
          )}
          {/* Comentario */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "600", marginBottom: "8px", fontSize: "0.875rem", color: "#374151" }}>
              Comentario (opcional)
            </label>
            <textarea
              name="comentario"
              value={formData.comentario}
              onChange={handleChange}
              rows={3}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none"
              }}
              placeholder="Ej: Asignación inicial, Rebalanceo..."
            />
          </div>
          {/* Mensajes */}
          {error && (
            <div style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              border: "1px solid #fca5a5"
            }}>
              ⚠ {error}
            </div>
          )}
          {success && (
            <div style={{
              background: "#d1fae5",
              color: "#065f46",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              border: "1px solid #86efac"
            }}>
              ✓ {success}
            </div>
          )}
          {/* Botones */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#fff",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: "600",
                color: "#374151",
                opacity: loading ? 0.5 : 1
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || excedeDisponible || !formData.monto}
              style={{
                flex: 1,
                padding: "0.75rem",
                background: (loading || excedeDisponible || !formData.monto) ? "#9ca3af" : color,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: (loading || excedeDisponible || !formData.monto) ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: "700"
              }}
            >
              {loading ? "Procesando..." : `Confirmar ${esAsignacion ? "Asignación" : "Desasignación"}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
