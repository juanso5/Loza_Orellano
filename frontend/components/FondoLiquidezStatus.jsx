"use client";
import { useState, useEffect } from "react";
export default function FondoLiquidezStatus({ clienteId, fondoId }) {
  const [estado, setEstado] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (clienteId && fondoId) {
      fetchEstado();
    }
  }, [clienteId, fondoId]);
  const fetchEstado = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/liquidez/estado?cliente_id=${clienteId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success && json.data && json.data.fondos) {
        const fondoEstado = json.data.fondos.find(f => f.id_fondo === fondoId);
        setEstado(fondoEstado || null);
      }
    } catch (err) {
      } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-body">
          <p className="muted">Cargando estado de liquidez...</p>
        </div>
      </div>
    );
  }
  if (!estado) return null;
  const getColorByPercentage = (percentage) => {
    if (percentage >= 80) return { color: "#e74c3c", bg: "#fff1f2" };
    if (percentage >= 50) return { color: "#f39c12", bg: "#fff9e6" };
    return { color: "#27ae60", bg: "#d1fae5" };
  };
  const colors = getColorByPercentage(estado.porcentajeInvertido || 0);
  return (
    <div className="card" style={{ marginBottom: "20px" }}>
      <div className="card-body">
        <h3 style={{ marginBottom: "16px", fontSize: "1.1rem", fontWeight: 700 }}>
          ­ƒÆ░ Estado de Liquidez
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
              Liquidez Asignada
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f6cff" }}>
              ${estado.liquidezAsignada?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
              En Acciones
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#9333ea" }}>
              ${estado.dineroEnAcciones?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "4px" }}>
              Disponible
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#27ae60" }}>
              ${estado.saldoDisponible?.toFixed(2) || "0.00"}
            </div>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span className="muted" style={{ fontSize: "0.85rem" }}>Utilizacion</span>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: colors.color,
              }}
            >
              {estado.porcentajeInvertido || 0}%
            </span>
          </div>
          <div style={{ width: "100%", height: "8px", background: "#e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(estado.porcentajeInvertido || 0, 100)}%`,
                height: "100%",
                background: colors.color,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
        {estado.saldoDisponible <= 0 && (
          <div
            style={{
              marginTop: "12px",
              padding: "8px 12px",
              background: "#fff1f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              fontSize: "0.85rem",
              color: "#b91c1c",
            }}
          >
            ÔÜá´©Å Sin liquidez disponible. Asigna m├ís fondos desde la p├ígina de Liquidez.
          </div>
        )}
      </div>
    </div>
  );
}
