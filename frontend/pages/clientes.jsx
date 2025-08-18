import Head from "next/head";
import { useMemo, useState, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import ClienteCard from "../components/ClienteCard";
import ClienteFormModal from "../components/ClienteFormModal";
import ClienteViewModal from "../components/ClienteViewModal";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import styles from "../styles/clientes.module.css";
import { useEffect } from 'react';

// ——— Utils (comparten misma lógica que tu JS original)
const onlyDigits = (s = "") => s.replace(/\D/g, "");
const fmtARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

function normalize(s = "") {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatCuit(digits) {
  const d = onlyDigits(digits);
  if (d.length !== 11) return digits || "";
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function isValidCuit(raw = "") {
  const d = onlyDigits(raw);
  if (d.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = mult.reduce((acc, m, i) => acc + m * Number(d[i]), 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === Number(d[10]);
}

function pad2(n) { return n.toString().padStart(2, "0"); }
function nowLocalForInput() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function isoFromLocalInput(localStr) {
  if (!localStr) return new Date().toISOString();
  const d = new Date(localStr);
  if (Number.isNaN(d.getTime())) {
    const [date, time] = localStr.split("T");
    const [y, m, day] = date.split("-").map(Number);
    const [h, min] = (time || "00:00").split(":").map(Number);
    return new Date(y, (m || 1) - 1, day || 1, h || 0, min || 0, 0, 0).toISOString();
  }
  return d.toISOString();
}
function inputFromISO(isoStr) {
  if (!isoStr) return nowLocalForInput();
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return nowLocalForInput();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatEsDateTime(isoStr = "") {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const fecha = d.toLocaleDateString("es-AR", { year: "numeric", month: "2-digit", day: "2-digit" });
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return `${fecha} ${hora}`;
}

// ——— Página
export default function ClientesPage() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { const saved = localStorage.getItem('sidebarCollapsed'); if (saved!==null) setCollapsed(JSON.parse(saved)); } catch {}
  }, []);
  // Estado base (demo)
  const [clients, setClients] = useState([
    { id: 1, name: "Juancito Pérez", cuit: "20-12345678-3", email: "juan@example.com", phone: "+54 9 11 1234-5678", riskProfile: "Moderado", serviceType: "Integral", joinedAt: new Date().toISOString() },
    { id: 2, name: "Ana Gómez", cuit: "27-00000000-5", email: "ana@example.com", phone: "+54 9 11 9876-5432", riskProfile: "Bajo", serviceType: "Cartera Administrada", joinedAt: new Date().toISOString() },
  ]);

  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // objeto cliente o null
  const [showView, setShowView] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

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

  const handleSave = useCallback((values) => {
    const {
      name, email, phone, cuit: cuitRaw, address, financialData,
      riskProfile, serviceType, salary, joinedLocal, comments,
    } = values;

    const cuit = (() => {
      const digits = onlyDigits(cuitRaw || "");
      return digits.length === 11 ? formatCuit(digits) : "";
    })();
    const joinedAt = isoFromLocalInput(joinedLocal || nowLocalForInput());

    setClients((prev) => {
      if (editing) {
        return prev.map((p) => (p.id === editing.id ? { ...p, name, email, phone, cuit, address, financialData, riskProfile, serviceType, salary, joinedAt, comments } : p));
      }
      const nextId = prev.length ? Math.max(...prev.map((x) => x.id)) + 1 : 1;
      return [...prev, { id: nextId, name, email, phone, cuit, address, financialData, riskProfile, serviceType, salary, joinedAt, comments }];
    });

    setShowForm(false);
    setEditing(null);
  }, [editing]);

  const handleDelete = useCallback(() => {
    if (!pendingDelete) return;
    setClients((prev) => prev.filter((x) => x.id !== pendingDelete.id));
    setShowConfirm(false);
    setPendingDelete(null);
  }, [pendingDelete]);

  return (
    <>
      <Head>
        <title>Clientes</title>
      </Head>

      <Sidebar collapsed={collapsed} toggleSidebar={() => {
        setCollapsed(c => { const n=!c; try { localStorage.setItem('sidebarCollapsed', JSON.stringify(n)); } catch {}; return n; });
      }} />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`} style={{ padding: 24 }}>
        <main style={{ background:'#fff', padding:18, borderRadius:12 }}>
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
              <div className={styles.empty}> {query ? "No hay clientes que coincidan." : "Sin clientes aún."} </div>
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
          email: editing.email || "",
          phone: editing.phone || "",
          cuit: editing.cuit || "",
          address: editing.address || "",
          financialData: editing.financialData || "",
          riskProfile: editing.riskProfile || "Moderado",
          serviceType: editing.serviceType || "Integral",
          salary: typeof editing.salary === "number" ? editing.salary : (editing.salary || ""),
          joinedLocal: inputFromISO(editing.joinedAt),
          comments: editing.comments || "",
        } : {
          name: "",
          email: "",
          phone: "",
          cuit: "",
          address: "",
          financialData: "",
          riskProfile: "Moderado",
          serviceType: "Integral",
          salary: "",
          joinedLocal: nowLocalForInput(),
          comments: "",
        }}
        helpers={{ isValidCuit, formatCuit }}
      />

      <ClienteViewModal
        open={showView}
        onClose={() => { setShowView(false); setViewing(null); }}
        cliente={viewing}
        fmtARS={fmtARS}
        formatEsDateTime={formatEsDateTime}
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
