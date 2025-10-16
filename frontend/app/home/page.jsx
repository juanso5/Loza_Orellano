// app/home/page.jsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import Sidebar from "../../components/Sidebar";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import TaskModal from "../../components/TaskModal";
import TaskListCard from "../../components/TaskListCard";
import { useLocalStorageState } from "@/lib/hooks";
const PRIORITY_CONFIG = {
  alta: { color: '#e74c3c', className: 'prioridad-alta' },
  media: { color: '#f39c12', className: 'prioridad-media' },
  baja: { color: '#27ae60', className: 'prioridad-baja' },
};
// id temporal para UI
function generateTempId() {
  return 't-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
}
// Id válido de BD: numérico y no comienza con 't-'
function isDbId(id) {
  if (id === null || id === undefined) return false;
  const s = String(id);
  if (s.startsWith('t-')) return false;
  return /^\d+$/.test(s);
}
export default function HomePage() {
  // STATE
  const [tasks, setTasks] = useState([]); // { id(num|temp), title, description, date(YYYY-MM-DD), priority, completed, eventId }
  const [editingTask, setEditingTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);
  const calendarRef = useRef(null);
  const suppressEventAddRef = useRef(false);
  const loadedFromDbRef = useRef(false);
  // Sidebar collapsed con persistencia
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  // Calendar API
  const calendarApi = () => calendarRef.current?.getApi?.();
  // Cargar tareas desde BD y pintarlas en el calendario (reemplaza el seed local)
  useEffect(() => {
    const api = calendarApi();
    if (!api || loadedFromDbRef.current) return;
    (async () => {
      try {
        const res = await fetch('/api/home', { method: 'GET' });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || 'Error al cargar tareas');
        const list = Array.isArray(payload.data) ? payload.data : [];
        const mapped = list.map((t) => {
          suppressEventAddRef.current = true;
          const ev = api.addEvent({
            id: 'ev-' + t.id,
            title: t.title,
            start: t.date,
            allDay: true,
            backgroundColor: PRIORITY_CONFIG[t.priority]?.color || PRIORITY_CONFIG.media.color,
            borderColor: PRIORITY_CONFIG[t.priority]?.color || PRIORITY_CONFIG.media.color,
            classNames: [
              PRIORITY_CONFIG[t.priority]?.className || PRIORITY_CONFIG.media.className,
              ...(t.completed ? ['task-completed'] : []),
            ],
            extendedProps: { description: t.description || '' },
          });
          suppressEventAddRef.current = false;
          return { ...t, eventId: ev?.id || ('ev-' + t.id) };
        });
        setTasks(mapped);
        loadedFromDbRef.current = true;
      } catch (e) {
        }
    })();
  }, [calendarRef.current]);
  // Derivados
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { todayTasks, pendingTasks } = useMemo(() => {
    const sorted = tasks.slice().sort((a, b) => {
      if (a.date === b.date) {
        if (a.priority === b.priority) return 0;
        return a.priority === 'alta' ? -1 : 1;
      }
      return a.date.localeCompare(b.date);
    });
    return {
      todayTasks: sorted.filter((t) => t.date === todayStr && !t.completed),
      pendingTasks: sorted.filter((t) => !(t.date === todayStr && !t.completed)),
    };
  }, [tasks, todayStr]);
  // Handlers
  const openNew = () => {
    setEditingTask({
      id: null,
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      priority: 'media',
      completed: false,
    });
    setModalOpen(true);
  };
  const openEdit = (task) => { setEditingTask(task); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);
  // Crear/Editar contra /api/home
  const upsertTask = async ({ id, title, description, date, priority }) => {
    const api = calendarApi();
    try {
      if (!isDbId(id)) {
        // Crear
        const res = await fetch('/api/home', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description: description || '', date, priority }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || 'Error al crear la tarea');
        const data = payload.data;
        // si venía de temporal, remover evento temporal
        if (id) {
          const temp = tasks.find((t) => String(t.id) === String(id));
          if (temp?.eventId) api?.getEventById(String(temp.eventId))?.remove();
        }
        // Crear evento definitivo
        const ev = api?.addEvent({
          id: 'ev-' + data.id,
          title: data.title,
          start: data.date,
          allDay: true,
          backgroundColor: PRIORITY_CONFIG[data.priority].color,
          borderColor: PRIORITY_CONFIG[data.priority].color,
          classNames: [
            PRIORITY_CONFIG[data.priority].className,
            ...(data.completed ? ['task-completed'] : []),
          ],
          extendedProps: { description: data.description || '' },
        });
        // Reemplazar temporal o agregar nuevo
        setTasks((prev) => {
          if (id) {
            return prev.map((t) =>
              String(t.id) === String(id)
                ? { id: data.id, title: data.title, description: data.description, date: data.date, priority: data.priority, completed: data.completed, eventId: ev?.id }
                : t
            );
          }
          return [...prev, { id: data.id, title: data.title, description: data.description, date: data.date, priority: data.priority, completed: data.completed, eventId: ev?.id }];
        });
      } else {
        // Editar
        const res = await fetch('/api/home', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id), title, description: description || '', date, priority }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || 'Error al editar la tarea');
        const data = payload.data;
        setTasks((prev) =>
          prev.map((t) => {
            if (String(t.id) !== String(id)) return t;
            const ev = api?.getEventById(String(t.eventId));
            if (ev) {
              ev.setProp('title', data.title);
              ev.setStart(data.date);
              ev.setProp('backgroundColor', PRIORITY_CONFIG[data.priority].color);
              ev.setProp('borderColor', PRIORITY_CONFIG[data.priority].color);
              const classes = [PRIORITY_CONFIG[data.priority].className];
              if (t.completed) classes.push('task-completed');
              ev.setProp('classNames', classes);
              ev.setExtendedProp('description', data.description || '');
            }
            return { ...t, title: data.title, description: data.description, date: data.date, priority: data.priority };
          })
        );
      }
      setModalOpen(false);
    } catch (e) {
      alert(e.message || 'Error al guardar la tarea');
    }
  };
  const toggleComplete = async (taskId) => {
    const api = calendarApi();
    const task = tasks.find((t) => String(t.id) === String(taskId));
    if (!task) return;
    const nextCompleted = !task.completed;
    try {
      if (isDbId(taskId)) {
        const res = await fetch('/api/home', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(taskId), completed: nextCompleted }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || 'Error al actualizar estado');
      }
      setTasks((prev) =>
        prev.map((t) => {
          if (String(t.id) !== String(taskId)) return t;
          const ev = api?.getEventById(String(t.eventId));
          if (ev) {
            const classes = [PRIORITY_CONFIG[t.priority].className];
            if (nextCompleted) classes.push('task-completed');
            ev.setProp('classNames', classes);
          }
          return { ...t, completed: nextCompleted };
        })
      );
    } catch (e) {
      alert(e.message || 'No se pudo actualizar la tarea');
    }
  };
  const requestDelete = (taskId) => setToDeleteId(taskId);
  const confirmDelete = async () => {
    if (!toDeleteId) return;
    const api = calendarApi();
    try {
      if (isDbId(toDeleteId)) {
        const res = await fetch('/api/home', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(toDeleteId) }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok && res.status !== 204) throw new Error(payload?.error || 'Error al borrar');
      }
      setTasks((prev) => {
        const t = prev.find((x) => String(x.id) === String(toDeleteId));
        if (t?.eventId) api?.getEventById(String(t.eventId))?.remove();
        return prev.filter((x) => String(x.id) !== String(toDeleteId));
      });
    } catch (e) {
      alert(e.message || 'No se pudo borrar la tarea');
    } finally {
      setToDeleteId(null);
    }
  };
  // FullCalendar callbacks
  const onSelect = (info) => {
    setEditingTask({
      id: null,
      title: '',
      description: '',
      date: info.startStr.split('T')[0],
      priority: 'media',
      completed: false,
    });
    setModalOpen(true);
  };
  const onEventClick = (clickInfo) => {
    const evId = String(clickInfo.event.id);
    const task = tasks.find((t) => String(t.eventId) === evId);
    if (task) openEdit(task);
  };
  const onEventDropOrResize = (eventChangeInfo) => {
    const ev = eventChangeInfo.event;
    const newDate = ev.startStr ? ev.startStr.split('T')[0] : null;
    setTasks((prev) =>
      prev.map((t) => (String(t.eventId) === String(ev.id) && newDate ? { ...t, date: newDate } : t))
    );
    const t = tasks.find((x) => String(x.eventId) === String(ev.id));
    if (t && isDbId(t.id) && newDate) {
      fetch('/api/home', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(t.id), date: newDate }),
      }).catch(() => {});
    }
  };
  const onEventAdd = (addInfo) => {
    if (suppressEventAddRef.current) return;
    // evita eventos agregados sin pasar por el modal
    addInfo.event.remove();
  };
  const onEventRemove = (removeInfo) => {
    setTasks((prev) => prev.filter((t) => String(t.eventId) !== String(removeInfo.event.id)));
  };
  // Carrusel
  const tasksRowRef = useRef(null);
  const [showCarouselBtns, setShowCarouselBtns] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  useEffect(() => {
    const el = tasksRowRef.current;
    if (!el) return;
    const update = () => {
      const needs = el.scrollWidth > el.clientWidth + 8;
      setShowCarouselBtns(needs);
      setCanPrev(el.scrollLeft > 2);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    update();
    const onScroll = () => update();
    const onResize = () => update();
    el.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);
    const mo = new MutationObserver(() => setTimeout(update, 60));
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mo.disconnect();
    };
  }, [todayTasks.length, pendingTasks.length]);
  const scrollAmount = () => Math.round((tasksRowRef.current?.clientWidth || 0) * 0.8);
  const scrollPrev = () => tasksRowRef.current?.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  const scrollNext = () => tasksRowRef.current?.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
  return (
    <>
      <div id="sidebar-container">
        <Sidebar collapsed={collapsed} toggleSidebar={() => setCollapsed(c => !c)} />
      </div>
      <div className={`main-content ${collapsed ? 'expanded' : ''}`} id="main-content">
        <div className="main-inner">
          <div className="top-row">
            <h1>Calendario y Tareas</h1>
            <div className="top-controls">
              <button id="open-new-btn" className="btn-add" onClick={openNew}>
                <i className="fas fa-plus" /> Nuevo Evento
              </button>
            </div>
          </div>
          {/* TASKS ROW */}
          <div className="tasks-row" ref={tasksRowRef}>
            <TaskListCard
              title="Tareas de Hoy"
              tasks={todayTasks}
              onToggleComplete={toggleComplete}
              onEdit={openEdit}
              onDelete={setToDeleteId}
            />
            <TaskListCard
              title="Tareas Pendientes"
              tasks={pendingTasks}
              onToggleComplete={toggleComplete}
              onEdit={openEdit}
              onDelete={setToDeleteId}
            />
            {showCarouselBtns && (
              <>
                <button className={`carousel-btn left ${!canPrev ? 'hidden' : ''}`} aria-label="Anterior tareas" onClick={scrollPrev}>
                  <i className="fas fa-chevron-left" />
                </button>
                <button className={`carousel-btn right ${!canNext ? 'hidden' : ''}`} aria-label="Siguiente tareas" onClick={scrollNext}>
                  <i className="fas fa-chevron-right" />
                </button>
              </>
            )}
          </div>
          {/* CALENDAR */}
          <div className="card calendar-card">
            <div className="calendar-wrapper">
              <div id="calendar" style={{ width: '100%' }}>
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  locale="es"
                  selectable
                  editable
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay',
                  }}
                  select={onSelect}
                  eventClick={onEventClick}
                  eventDrop={onEventDropOrResize}
                  eventResize={onEventDropOrResize}
                  eventAdd={onEventAdd}
                  eventRemove={onEventRemove}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Modales */}
      {modalOpen && (
        <TaskModal
          initialTask={editingTask}
          onCancel={() => setModalOpen(false)}
          onSave={upsertTask}
        />
      )}
      {toDeleteId && (
        <ConfirmDeleteModal
          open={!!toDeleteId}
          text="¿Seguro que querés eliminar esta tarea?"
          onCancel={() => setToDeleteId(null)}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}