/* components/home.js (actualizado: modal de confirmación integrado) */

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const openNewBtn = document.getElementById('open-new-btn');
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('modal-title');
  const saveBtn = document.getElementById('save-task');
  const cancelBtn = document.getElementById('cancel-task');

  // Confirm modal elements (nuevo)
  const confirmModal = document.getElementById('confirm-modal');
  const confirmText = document.getElementById('confirm-text');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  let deleteTaskPendingId = null;

  const inputTitle = document.getElementById('task-title');
  const inputDesc = document.getElementById('task-desc');
  const inputDate = document.getElementById('task-date');
  const inputPriority = document.getElementById('task-priority');

  const todayContainer = document.getElementById('today-tasks');
  const pendingContainer = document.getElementById('pending-tasks');
  const calendarEl = document.getElementById('calendar');

  // In-memory data
  let tasks = []; // { id, title, description, date (YYYY-MM-DD), priority, completed, eventId }
  let editingTaskId = null;
  let suppressEventAdd = false; // flag to prevent eventAdd handler creating duplicate tasks

  // Priority colors
  const PRIORITY_CONFIG = {
    alta: { color: '#e74c3c' },
    media: { color: '#f39c12' },
    baja: { color: '#27ae60' }
  };

  // Initialize FullCalendar
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    selectable: true,
    editable: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    select: function(info) {
      // Open new-task modal with date prefilled
      editingTaskId = null;
      modalTitle.textContent = 'Agregar Tarea';
      clearModalFields();
      inputDate.value = info.startStr.split('T')[0];
      openModal();
      calendar.unselect();
    },
    eventClick: function(info) {
      // Open edit modal for clicked event
      const evId = String(info.event.id);
      const task = tasks.find(t => String(t.eventId) === evId);
      if (task) openModalForEdit(task.id);
    },
    eventDrop: function(info) {
      updateTaskDateByEvent(info.event);
    },
    eventResize: function(info) {
      updateTaskDateByEvent(info.event);
    },
    eventAdd: function(info) {
      // ignore programmatic adds when suppressed
      if (suppressEventAdd) return;
      // If an event is added by external source, create a corresponding task if not exist
      const ev = info.event;
      const already = tasks.some(t => String(t.eventId) === String(ev.id));
      if (!already) {
        const newId = generateId();
        tasks.push({
          id: newId,
          title: ev.title || 'Sin título',
          description: ev.extendedProps?.description || '',
          date: ev.startStr ? ev.startStr.split('T')[0] : (new Date()).toISOString().split('T')[0],
          priority: 'media',
          completed: false,
          eventId: ev.id
        });
        renderTaskLists();
      }
    },
    eventRemove: function(info) {
      // remove corresponding task
      tasks = tasks.filter(t => String(t.eventId) !== String(info.event.id));
      renderTaskLists();
    }
  });

  calendar.render();

  // Helpers
  function generateId() {
    return 't-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
  }

  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
  }
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    editingTaskId = null;
    modalTitle.textContent = 'Agregar Tarea';
    clearModalFields();
  }
  function clearModalFields() {
    inputTitle.value = '';
    inputDesc.value = '';
    inputDate.value = '';
    inputPriority.value = '';
  }

  // CONFIRM modal helpers (nuevo)
  function openConfirmModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    confirmText.textContent = task ? `¿Eliminar la tarea "${task.title}"? Esta acción no se puede deshacer.` : '¿Eliminar esta tarea?';
    deleteTaskPendingId = taskId;
    confirmModal.setAttribute('aria-hidden', 'false');
    confirmModal.style.display = 'flex';
  }
  function closeConfirmModal() {
    confirmModal.setAttribute('aria-hidden', 'true');
    confirmModal.style.display = 'none';
    deleteTaskPendingId = null;
  }

  // Open new task modal
  openNewBtn.addEventListener('click', () => {
    editingTaskId = null;
    modalTitle.textContent = 'Agregar Tarea';
    clearModalFields();
    openModal();
  });

  // Cancel modal
  cancelBtn.addEventListener('click', closeModal);
  // Close edit/add modal when clicking outside
  window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Confirm modal events
  cancelDeleteBtn.addEventListener('click', closeConfirmModal);
  confirmDeleteBtn.addEventListener('click', () => {
    if (!deleteTaskPendingId) { closeConfirmModal(); return; }
    const task = tasks.find(t => t.id === deleteTaskPendingId);
    if (task) {
      const ev = calendar.getEventById(String(task.eventId));
      if (ev) ev.remove();
      tasks = tasks.filter(t => t.id !== deleteTaskPendingId);
      renderTaskLists();
    }
    closeConfirmModal();
  });
  // Close confirm modal when clicking outside it
  window.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirmModal(); });

  // Save (create or update)
  saveBtn.addEventListener('click', () => {
    const title = inputTitle.value.trim();
    const description = inputDesc.value.trim();
    const date = inputDate.value;
    const priority = inputPriority.value;

    if (!title || !date || !priority) {
      alert('Completa título, fecha y prioridad.');
      return;
    }

    if (editingTaskId) {
      // Edit existing
      const task = tasks.find(t => t.id === editingTaskId);
      if (!task) return;
      task.title = title;
      task.description = description;
      task.date = date;
      task.priority = priority;

      // Update calendar event
      const ev = calendar.getEventById(String(task.eventId));
      if (ev) {
        ev.setProp('title', title);
        ev.setStart(date);
        ev.setProp('backgroundColor', PRIORITY_CONFIG[priority].color);
        ev.setProp('borderColor', PRIORITY_CONFIG[priority].color);
        // keep completed class if needed
        if (task.completed) ev.setProp('classNames', ['task-completed']);
        else ev.setProp('classNames', []);
      }
    } else {
      // Create new task + event (avoid eventAdd handler creating duplicate)
      const id = generateId();
      const task = {
        id,
        title,
        description,
        date,
        priority,
        completed: false,
        eventId: null
      };

      // Add event programmatically while suppressing eventAdd handler
      suppressEventAdd = true;
      const ev = calendar.addEvent({
        id: 'ev-' + id,
        title: title,
        start: date,
        allDay: true,
        backgroundColor: PRIORITY_CONFIG[priority].color,
        borderColor: PRIORITY_CONFIG[priority].color,
        extendedProps: { description }
      });
      suppressEventAdd = false;

      task.eventId = ev.id;
      tasks.push(task);
    }

    renderTaskLists();
    closeModal();
  });

  // Update task date when event moved/resized
  function updateTaskDateByEvent(ev) {
    const task = tasks.find(t => String(t.eventId) === String(ev.id));
    if (task) {
      const newDate = ev.startStr ? ev.startStr.split('T')[0] : task.date;
      task.date = newDate;
      renderTaskLists();
    }
  }

  // Render lists (today and pending)
  function renderTaskLists() {
    const todayStr = (new Date()).toISOString().split('T')[0];
    todayContainer.innerHTML = '';
    pendingContainer.innerHTML = '';

    // Sort tasks by date asc
    const sorted = tasks.slice().sort((a,b) => a.date.localeCompare(b.date));

    for (const t of sorted) {
      const el = createTaskElement(t);
      if (t.date === todayStr && !t.completed) {
        todayContainer.appendChild(el);
      } else {
        pendingContainer.appendChild(el);
      }
    }
  }

  // Build a task DOM element with actions (complete / edit / delete)
  function createTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task-item';
    if (task.completed) el.classList.add('completed');
    el.classList.add(task.priority === 'alta' ? 'pr-alta' : task.priority === 'media' ? 'pr-media' : 'pr-baja');

    // Left (info)
    const info = document.createElement('div'); info.className = 'task-info';
    const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title;
    const desc = document.createElement('div'); desc.className = 'task-desc'; desc.textContent = task.description || '';
    const meta = document.createElement('div'); meta.className = 'task-meta'; meta.textContent = task.date;

    info.appendChild(title);
    info.appendChild(desc);
    info.appendChild(meta);

    // Right (actions)
    const actions = document.createElement('div'); actions.className = 'task-actions';

    // Complete / undo
    const completeBtn = document.createElement('button'); completeBtn.className = 'action-btn';
    completeBtn.title = task.completed ? 'Marcar no completada' : 'Marcar completada';
    completeBtn.innerHTML = task.completed ? '<i class="fas fa-check"></i>' : '<i class="far fa-square"></i>';
    completeBtn.addEventListener('click', () => {
      task.completed = !task.completed;
      // Update calendar event visual
      const ev = calendar.getEventById(String(task.eventId));
      if (ev) {
        if (task.completed) {
          ev.setProp('classNames', ['task-completed']);
        } else {
          ev.setProp('classNames', []);
        }
      }
      renderTaskLists();
    });

    // Edit
    const editBtn = document.createElement('button'); editBtn.className = 'action-btn';
    editBtn.title = 'Editar';
    editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.addEventListener('click', () => openModalForEdit(task.id));

    // Delete — opens confirm modal
    const deleteBtn = document.createElement('button'); deleteBtn.className = 'action-btn';
    deleteBtn.title = 'Eliminar';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', () => {
      openConfirmModal(task.id);
    });

    actions.appendChild(completeBtn);
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    el.appendChild(info);
    el.appendChild(actions);

    return el;
  }

  // Open modal with task pre-filled
  function openModalForEdit(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    editingTaskId = task.id;
    modalTitle.textContent = 'Editar Tarea';
    inputTitle.value = task.title;
    inputDesc.value = task.description || '';
    inputDate.value = task.date;
    inputPriority.value = task.priority || '';
    openModal();
  }

  // Seed demo tasks (so page looks like your screenshot) - safe (won't duplicate)
  (function seedDemo(){
    if (tasks.length) return; // don't seed twice
    const today = (new Date()).toISOString().split('T')[0];
    const later = new Date(Date.now() + 5*24*3600*1000).toISOString().split('T')[0];

    const demos = [
      { title: 'Revisar cartera de María González', description: 'Actualizar distribución según perfil', date: today, priority:'alta' },
      { title: 'Preparar informe trimestral', description: 'Comparativa con benchmark', date: today, priority:'media' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority:'baja' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Actualizar documentación', description: 'Verificar cumplimiento', date: later, priority:'alta' }
    ];

    for (const d of demos) {
      // use same path as create: add event programmatically suppressed and push task
      const id = generateId();
      suppressEventAdd = true;
      const ev = calendar.addEvent({
        id: 'ev-' + id,
        title: d.title,
        start: d.date,
        allDay: true,
        backgroundColor: PRIORITY_CONFIG[d.priority].color,
        borderColor: PRIORITY_CONFIG[d.priority].color,
        extendedProps: { description: d.description }
      });
      suppressEventAdd = false;
      tasks.push({
        id,
        title: d.title,
        description: d.description,
        date: d.date,
        priority: d.priority,
        completed: false,
        eventId: ev.id
      });
    }
    renderTaskLists();
  })();

}); // DOMContentLoaded end
