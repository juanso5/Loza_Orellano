// app/home/page.jsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

import Sidebar from "../components/Sidebar";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import TaskModal from "../components/TaskModal";
import TaskListCard from "../components/TaskListCard";

const PRIORITY_CONFIG = {
  alta: { color: '#e74c3c', className: 'prioridad-alta' },
  media: { color: '#f39c12', className: 'prioridad-media' },
  baja: { color: '#27ae60', className: 'prioridad-baja' },
};

function generateId() {
  return 't-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
}

export default function HomePage() {
  // ----- STATE -----
  const [tasks, setTasks] = useState([]); // { id, title, description, date(YYYY-MM-DD), priority, completed, eventId }
  const [editingTask, setEditingTask] = useState(null); // objeto tarea o null
  const [modalOpen, setModalOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState(null);

  const calendarRef = useRef(null);
  const suppressEventAddRef = useRef(false);

  // Sidebar collapsed state with persistence
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setCollapsed(JSON.parse(savedState));
    }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(!prev));
      return !prev;
    });
  };

  // ----- CALENDAR API -----
  const calendarApi = () => calendarRef.current?.getApi?.();

  // ----- SEED DEMO (1 sola vez) -----
  useEffect(() => {
    if (tasks.length) return;
    const today = new Date().toISOString().split('T')[0];
    const later = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const demos = [
      { title: 'Revisar cartera de María González', description: 'Actualizar distribución según perfil', date: today, priority: 'alta' },
      { title: 'Preparar informe trimestral', description: 'Comparativa con benchmark', date: today, priority: 'media' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority: 'baja' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority: 'media' },
      { title: 'Actualizar documentación', description: 'Verificar cumplimiento', date: later, priority: 'alta' },
    ];

    const api = calendarApi();
    if (!api) return;

    const seeded = [];
    demos.forEach((d) => {
      const id = generateId();
      suppressEventAddRef.current = true;
      const ev = api.addEvent({
        id: 'ev-' + id,
        title: d.title,
        start: d.date,
        allDay: true,
        backgroundColor: PRIORITY_CONFIG[d.priority].color,
        borderColor: PRIORITY_CONFIG[d.priority].color,
        classNames: [PRIORITY_CONFIG[d.priority].className],
        extendedProps: { description: d.description },
      });
      suppressEventAddRef.current = false;

      seeded.push({
        id,
        title: d.title,
        description: d.description,
        date: d.date,
        priority: d.priority,
        completed: false,
        eventId: ev.id,
      });
    });

    setTasks(seeded);
  }, []); // eslint-disable-line

  // ----- DERIVADOS -----
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

  // ----- HANDLERS -----
  const openNew = () => {
    setEditingTask(null);
    setModalOpen(true);
  };
  const openEdit = (task) => {
    setEditingTask(task);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const upsertTask = ({ id, title, description, date, priority }) => {
    const api = calendarApi();
    if (!api) return;

    if (id) {
      // editar
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          const ev = api.getEventById(String(t.eventId));
          if (ev) {
            ev.setProp('title', title);
            ev.setStart(date);
            ev.setProp('backgroundColor', PRIORITY_CONFIG[priority].color);
            ev.setProp('borderColor', PRIORITY_CONFIG[priority].color);
            // actualizar clase de prioridad
            const baseClasses = [PRIORITY_CONFIG[priority].className];
            if (t.completed) baseClasses.push('task-completed');
            ev.setProp('classNames', baseClasses);
            ev.setExtendedProp('description', description || '');
          }
          return { ...t, title, description, date, priority };
        })
      );
    } else {
      // crear
      const newId = generateId();
      suppressEventAddRef.current = true;
      const ev = api.addEvent({
        id: 'ev-' + newId,
        title,
        start: date,
        allDay: true,
        backgroundColor: PRIORITY_CONFIG[priority].color,
        borderColor: PRIORITY_CONFIG[priority].color,
        classNames: [PRIORITY_CONFIG[priority].className],
        extendedProps: { description },
      });
      suppressEventAddRef.current = false;

      setTasks((prev) => [
        ...prev,
        { id: newId, title, description, date, priority, completed: false, eventId: ev.id },
      ]);
    }
    setModalOpen(false);
  };

  const toggleComplete = (taskId) => {
    const api = calendarApi();
    if (!api) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const completed = !t.completed;
        const ev = api.getEventById(String(t.eventId));
        if (ev) {
          const classes = [PRIORITY_CONFIG[t.priority].className];
          if (completed) classes.push('task-completed');
          ev.setProp('classNames', classes);
        }
        return { ...t, completed };
      })
    );
  };

  const requestDelete = (taskId) => setToDeleteId(taskId);
  const cancelDelete = () => setToDeleteId(null);
  const confirmDelete = () => {
    if (!toDeleteId) return;
    const api = calendarApi();
    if (!api) return;
    setTasks((prev) => {
      const t = prev.find((x) => x.id === toDeleteId);
      if (t) {
        const ev = api.getEventById(String(t.eventId));
        ev?.remove();
      }
      return prev.filter((x) => x.id !== toDeleteId);
    });
    setToDeleteId(null);
  };

  // ----- FULLCALENDAR CALLBACKS -----
  const onSelect = (info) => {
    setEditingTask({
      id: null,
      title: '',
      description: '',
      date: info.startStr.split('T')[0],
      priority: '',
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
    setTasks((prev) =>
      prev.map((t) => {
        if (String(t.eventId) !== String(ev.id)) return t;
        const newDate = ev.startStr ? ev.startStr.split('T')[0] : t.date;
        return { ...t, date: newDate };
      })
    );
  };

  const onEventAdd = (addInfo) => {
    if (suppressEventAddRef.current) return;
    const ev = addInfo.event;
    const exists = tasks.some((t) => String(t.eventId) === String(ev.id));
    if (!exists) {
      setTasks((prev) => [
        ...prev,
        {
          id: generateId(),
          title: ev.title || 'Sin título',
          description: ev.extendedProps?.description || '',
          date: ev.startStr ? ev.startStr.split('T')[0] : new Date().toISOString().split('T')[0],
          priority: 'media',
          completed: false,
          eventId: ev.id,
        },
      ]);
    }
  };

  const onEventRemove = (removeInfo) => {
    setTasks((prev) => prev.filter((t) => String(t.eventId) !== String(removeInfo.event.id)));
  };

  // ----- CARRUSEL CONTROLS (hoy/pendientes) -----
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

  const scrollAmount = () => {
    const el = tasksRowRef.current;
    if (!el) return 0;
    return Math.round(el.clientWidth * 0.8);
  };
  const scrollPrev = () => tasksRowRef.current?.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  const scrollNext = () => tasksRowRef.current?.scrollBy({ left: scrollAmount(), behavior: 'smooth' });

  return (
    <>
      <div id="sidebar-container">
        <Sidebar collapsed={collapsed} toggleSidebar={toggleSidebar} />
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
              onDelete={requestDelete}
            />
            <TaskListCard
              title="Tareas Pendientes"
              tasks={pendingTasks}
              onToggleComplete={toggleComplete}
              onEdit={openEdit}
              onDelete={requestDelete}
            />

            {showCarouselBtns && (
              <>
                <button
                  className={`carousel-btn left ${!canPrev ? 'hidden' : ''}`}
                  aria-label="Anterior tareas"
                  onClick={scrollPrev}
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <button
                  className={`carousel-btn right ${!canNext ? 'hidden' : ''}`}
                  aria-label="Siguiente tareas"
                  onClick={scrollNext}
                >
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
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}