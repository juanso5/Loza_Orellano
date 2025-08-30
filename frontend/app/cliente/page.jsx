"use client";
import { useMemo, useState, useCallback, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import ClienteCard from "../../components/ClienteCard";
import ClienteFormModal from "../../components/ClienteFormModal";
import ClienteViewModal from "../../components/ClienteViewModal";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import styles from "../../styles/clientes.module.css";

// Utils
const onlyDigits = (s = "") => s.replace(/\D/g, "");
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

function normalize(s = "") {
  return s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function formatCuit(digits) {
  const d = onlyDigits(digits);
  if (d.length !== 11) return digits || "";
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}
function pad2(n) { return n.toString().padStart(2, "0"); }
function nowLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatEsDate(isoStr = "") {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ——— Página
export default function ClientesPage() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem('sidebarCollapsed'); if (saved!==null) setCollapsed(JSON.parse(saved)); } catch {}
  }, []);

  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showView, setShowView] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Cargar desde API
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cliente", { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || "Error al cargar clientes");
        const list = Array.isArray(payload.data) ? payload.data : [];
        // Completar con campos usados por UI y compat con banco/alias/comentario
        setClients(list.map((c) => {
          const banks =
            Array.isArray(c.banks) ? c.banks :
            (c.bank ? [{ name: c.bank, alias: c.alias || c.bankAlias || "" }] : []);
          return {
            ...c,
            banks,
            comments: c.comments || c.comentario || "",
            joinedAt: c.joinedAt || new Date().toISOString(), // solo para vista de fecha
          };
        }));
      } catch (e) {
        console.error(e);
        setClients([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return clients;
    const qText = normalize(q);
    const qDigits = onlyDigits(q);
    return clients.filter((c) => {
      const nameMatch = normalize(c.name).includes(qText);
      const cuitDigits = onlyDigits(c.cuit || "");
      const cuitMatch = qDigits.length >= 2 && cuitDigits.includes(qDigits);
      return nameMatch || cuitMatch;
    });
  }, [clients, query]);

  const openAdd = useCallback(() => { setEditing(null); setShowForm(true); }, []);
  const openEdit = useCallback((c) => { setEditing(c); setShowForm(true); }, []);
  const openView = useCallback((c) => { setViewing(c); setShowView(true); }, []);
  const askDelete = useCallback((c) => { setPendingDelete(c); setShowConfirm(true); }, []);

  const handleSave = useCallback(async (values) => {
    const {
      name, phone, riskProfile, serviceType,
      period, fee, banks, comments,
      bank, bankAlias, // compat si vinieran
    } = values;

    // Normalizar fee a número
    let feeNum = undefined;
    if (fee !== "" && fee !== undefined && fee !== null) {
      const f = Number(String(fee).replace(",", "."));
      if (!Number.isNaN(f)) feeNum = f;
    }

    // Tomar primer banco para persistir en columnas banco/alias
    const first = Array.isArray(banks) && banks.length ? banks[0] : null;

    const payload = {
      nombre: name,
      tipo_servicio: serviceType || null,
      celular: phone || null,
      banco: first?.name || bank || null,
      alias: first?.alias || bankAlias || null,
      arancel: feeNum ?? null,
      periodo: period || null,
      perfil: riskProfile || null,
      comentario: comments || null,
    };

    try {
      if (editing?.id) {
        const res = await fetch("/api/cliente", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
        const out = await res.json().catch(() => null);
        if (!res.ok) throw new Error(out?.error || "Error al editar cliente");
        const updated = out.data;
        setClients((prev) =>
          prev.map((p) =>
            p.id === editing.id
              ? {
                  ...p,
                  ...updated,
                  // asegurar banks/comments en el objeto actualizado
                  banks: Array.isArray(updated.banks)
                    ? updated.banks
                    : (updated.bank ? [{ name: updated.bank, alias: updated.alias || "" }] : p.banks),
                  comments: updated.comments || updated.comentario || p.comments || "",
                }
              : p
          )
        );
      } else {
        const res = await fetch("/api/cliente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const out = await res.json().catch(() => null);
        if (!res.ok) throw new Error(out?.error || "Error al crear cliente");
        const created = out.data;
        setClients((prev) => [
          ...prev,
          {
            ...created,
            banks: Array.isArray(created.banks)
              ? created.banks
              : (created.bank ? [{ name: created.bank, alias: created.alias || "" }] : []),
            comments: created.comments || created.comentario || "",
            joinedAt: new Date().toISOString(),
          },
        ]);
      }
      setShowForm(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo guardar el cliente");
    }
  }, [editing]);

  const handleDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      const res = await fetch("/api/cliente", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      if (!res.ok && res.status !== 204) {
        const out = await res.json().catch(() => null);
        throw new Error(out?.error || "Error al eliminar cliente");
      }
      setClients((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      setShowConfirm(false);
      setPendingDelete(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "No se pudo eliminar el cliente");
    }
  }, [pendingDelete]);

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        toggleSidebar={() => {
          setCollapsed((c) => {
            const n = !c;
            try { localStorage.setItem("sidebarCollapsed", JSON.stringify(n)); } catch {}
            return n;
          });
        }}
      />

      <div className={`main-content ${collapsed ? "expanded" : ""}`} style={{ padding: 24 }}>
        <main style={{ background: "#fff", padding: 18, borderRadius: 12 }}>
          {/* Buscador + botón alta */}
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o CUIT..."
            />
            <button className={styles.btnAdd} onClick={openAdd}>
              <i className="fas fa-plus" /> Agregar Cliente
            </button>
          </div>

          {/* Lista */}
          <section className={styles.clientsSection}>
            <h2>Lista de Clientes</h2>

            {filtered.length === 0 ? (
              <div className={styles.empty}>
                {query ? "No hay clientes que coincidan." : "Sin clientes aún."}
              </div>
            ) : (
              <div className={styles.list}>
                {filtered.map((c) => (
                  <ClienteCard
                    key={c.id}
                    cliente={c}
                    onView={() => openView(c)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => askDelete(c)}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Modales */}
      <ClienteFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing ? {
          name: editing.name || "",
          phone: editing.phone || "",
          riskProfile: editing.riskProfile || "Moderado",
          period: editing.period || "Mensual",
          fee: typeof editing.fee === "number" ? editing.fee : (editing.fee || ""),
          serviceType: editing.serviceType || "Integral",
          // Prefiere lista de bancos (name+alias); si no, mapear desde bank/alias
          banks: Array.isArray(editing.banks)
            ? editing.banks
            : (editing.bank ? [{ name: editing.bank, alias: editing.alias || editing.bankAlias || "" }] : []),
          comments: editing.comments || editing.comentario || "",
          salary: editing.salary ?? "",
          joinedLocal: nowLocalDate(),
        } : {
          name: "",
          phone: "",
          riskProfile: "Moderado",
          period: "Mensual",
          fee: "",
          serviceType: "Integral",
          banks: [],
          comments: "",
          salary: "",
          joinedLocal: nowLocalDate(),
        }}
        helpers={{
          isValidCuit: () => true,
          formatCuit: (s) => s,
        }}
      />

      <ClienteViewModal
        open={showView}
        onClose={() => { setShowView(false); setViewing(null); }}
        cliente={viewing}
        fmtARS={fmtARS}
        formatEsDate={formatEsDate}
      />

      <ConfirmDeleteModal
        open={showConfirm}
        onCancel={() => { setShowConfirm(false); setPendingDelete(null); }}
        onConfirm={handleDelete}
        text={pendingDelete ? `¿Eliminar al cliente "${pendingDelete.name}"? Esta acción no se puede deshacer.` : "¿Eliminar este cliente? Esta acción no se puede deshacer."}
      />
    </>
  );
}
