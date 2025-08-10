/* components/home.js
   Full implementation: calendar + tasks + modal + confirm + carousel + "ver más"
   (versión ajustada visualmente: botones no se pisen, ver-mas instantáneo)
*/

document.addEventListener('DOMContentLoaded', () => {
  // DOM
  const openNewBtn = document.getElementById('open-new-btn');
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('modal-title');
  const saveBtn = document.getElementById('save-task');
  const cancelBtn = document.getElementById('cancel-task');

  const confirmModal = document.getElementById('confirm-modal');
  const confirmText = document.getElementById('confirm-text');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

  const inputTitle = document.getElementById('task-title');
  const inputDesc = document.getElementById('task-desc');
  const inputDate = document.getElementById('task-date');
  const inputPriority = document.getElementById('task-priority');

  const todayContainer = document.getElementById('today-tasks');
  const pendingContainer = document.getElementById('pending-tasks');
  const calendarEl = document.getElementById('calendar');

  // state
  let tasks = []; // each: { id, title, description, date, priority, completed, eventId }
  let editingTaskId = null;
  let suppressEventAdd = false;

  const PRIORITY_CONFIG = { alta:{color:'#e74c3c'}, media:{color:'#f39c12'}, baja:{color:'#27ae60'} };

  // FullCalendar init
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    selectable: true,
    editable: true,
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    select: function(info) {
      editingTaskId = null;
      modalTitle.textContent = 'Agregar Tarea';
      clearModalFields();
      inputDate.value = info.startStr.split('T')[0];
      openModal();
      calendar.unselect();
    },
    eventClick: function(info) {
      const evId = String(info.event.id);
      const task = tasks.find(t => String(t.eventId) === evId);
      if (task) openModalForEdit(task.id);
    },
    eventDrop: function(info) { updateTaskDateByEvent(info.event); },
    eventResize: function(info) { updateTaskDateByEvent(info.event); },
    eventAdd: function(info) {
      if (suppressEventAdd) return;
      const ev = info.event;
      const exists = tasks.some(t => String(t.eventId) === String(ev.id));
      if (!exists) {
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
      tasks = tasks.filter(t => String(t.eventId) !== String(info.event.id));
      renderTaskLists();
    }
  });
  calendar.render();

  // Helpers
  function generateId(){ return 't-' + Date.now().toString(36) + '-' + Math.floor(Math.random()*10000); }
  function openModal(){ if (!modal) return; modal.setAttribute('aria-hidden','false'); modal.style.display='flex'; }
  function closeModal(){ if (!modal) return; modal.setAttribute('aria-hidden','true'); modal.style.display='none'; editingTaskId=null; modalTitle.textContent='Agregar Tarea'; clearModalFields(); }
  function clearModalFields(){ if (!inputTitle) return; inputTitle.value=''; inputDesc.value=''; inputDate.value=''; inputPriority.value=''; }

  // Confirm modal
  let deleteTaskPendingId = null;
  function openConfirmModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (confirmText) confirmText.textContent = task ? `¿Eliminar la tarea "${task.title}"? Esta acción no se puede deshacer.` : '¿Eliminar esta tarea?';
    deleteTaskPendingId = taskId;
    if (confirmModal) { confirmModal.setAttribute('aria-hidden','false'); confirmModal.style.display='flex'; }
  }
  function closeConfirmModal(){ if (confirmModal) { confirmModal.setAttribute('aria-hidden','true'); confirmModal.style.display='none'; } deleteTaskPendingId=null; }

  // Event wiring
  if (openNewBtn) openNewBtn.addEventListener('click', ()=>{ editingTaskId=null; modalTitle.textContent='Agregar Tarea'; clearModalFields(); openModal(); });
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  window.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });

  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmModal);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', ()=>{
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
  window.addEventListener('click', (e)=>{ if (e.target === confirmModal) closeConfirmModal(); });

  // Save handler
  if (saveBtn) saveBtn.addEventListener('click', ()=>{
    const title = inputTitle.value.trim();
    const description = inputDesc.value.trim();
    const date = inputDate.value;
    const priority = inputPriority.value;

    if (!title || !date || !priority) {
      alert('Completa título, fecha y prioridad.');
      return;
    }

    if (editingTaskId) {
      const task = tasks.find(t => t.id === editingTaskId);
      if (!task) return;
      task.title = title; task.description = description; task.date = date; task.priority = priority;
      const ev = calendar.getEventById(String(task.eventId));
      if (ev) {
        ev.setProp('title', title);
        ev.setStart(date);
        ev.setProp('backgroundColor', PRIORITY_CONFIG[priority].color);
        ev.setProp('borderColor', PRIORITY_CONFIG[priority].color);
        if (task.completed) ev.setProp('classNames', ['task-completed']); else ev.setProp('classNames', []);
      }
    } else {
      // create event + task
      const id = generateId();
      suppressEventAdd = true;
      const ev = calendar.addEvent({
        id: 'ev-'+id,
        title: title,
        start: date,
        allDay: true,
        backgroundColor: PRIORITY_CONFIG[priority].color,
        borderColor: PRIORITY_CONFIG[priority].color,
        extendedProps: { description }
      });
      suppressEventAdd = false;
      tasks.push({ id, title, description, date, priority, completed:false, eventId: ev.id });
    }

    renderTaskLists();
    closeModal();
  });

  // update when event moves/resizes
  function updateTaskDateByEvent(ev) {
    const task = tasks.find(t => String(t.eventId) === String(ev.id));
    if (task) {
      const newDate = ev.startStr ? ev.startStr.split('T')[0] : task.date;
      task.date = newDate;
      renderTaskLists();
    }
  }

  // Render lists (today / pending)
  function renderTaskLists() {
    const todayStr = (new Date()).toISOString().split('T')[0];
    if (todayContainer) todayContainer.innerHTML='';
    if (pendingContainer) pendingContainer.innerHTML='';

    // sort tasks by date then priority
    const sorted = tasks.slice().sort((a,b) => {
      if (a.date === b.date) return (a.priority === b.priority) ? 0 : (a.priority === 'alta' ? -1 : 1);
      return a.date.localeCompare(b.date);
    });

    // build separate arrays
    const todayTasks = sorted.filter(t => t.date === todayStr && !t.completed);
    const pendingTasks = sorted.filter(t => !(t.date === todayStr && !t.completed));

    // render today
    todayTasks.forEach(t => { if (todayContainer) todayContainer.appendChild(createTaskElement(t)); });

    pendingTasks.forEach(t => { if (pendingContainer) pendingContainer.appendChild(createTaskElement(t)); });
    // init carousel (buttons) after content updates
    initTaskCarousel();
  }

  // Create DOM element for a task
  function createTaskElement(task) {
    const el = document.createElement('div');
    el.className = 'task-item';
    if (task.completed) el.classList.add('completed');
    el.classList.add(task.priority === 'alta' ? 'pr-alta' : task.priority === 'media' ? 'pr-media' : 'pr-baja');

    const info = document.createElement('div'); info.className = 'task-info';
    const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title;
    const desc = document.createElement('div'); desc.className = 'task-desc'; desc.textContent = task.description || '';
    const meta = document.createElement('div'); meta.className = 'task-meta'; meta.textContent = task.date;
    info.appendChild(title); info.appendChild(desc); info.appendChild(meta);

    const actions = document.createElement('div'); actions.className = 'task-actions';

    // complete btn
    const completeBtn = document.createElement('button'); completeBtn.className = 'action-btn';
    completeBtn.type = 'button';
    completeBtn.dataset.id = task.id;
    completeBtn.title = task.completed ? 'Marcar no completada' : 'Marcar completada';
    completeBtn.innerHTML = task.completed ? '<i class="fas fa-check"></i>' : '<i class="far fa-square"></i>';
    completeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      task.completed = !task.completed;
      const evCal = calendar.getEventById(String(task.eventId));
      if (evCal) {
        if (task.completed) evCal.setProp('classNames', ['task-completed']);
        else evCal.setProp('classNames', []);
      }
      renderTaskLists();
    });

    // edit
    const editBtn = document.createElement('button'); editBtn.className = 'action-btn';
    editBtn.type = 'button';
    editBtn.dataset.id = task.id;
    editBtn.title = 'Editar'; editBtn.innerHTML = '<i class="fas fa-pen"></i>';
    editBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openModalForEdit(task.id); });

    // delete (confirm)
    const deleteBtn = document.createElement('button'); deleteBtn.className = 'action-btn';
    deleteBtn.type = 'button';
    deleteBtn.dataset.id = task.id;
    deleteBtn.title = 'Eliminar'; deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openConfirmModal(task.id); });

    actions.appendChild(completeBtn); actions.appendChild(editBtn); actions.appendChild(deleteBtn);

    el.appendChild(info); el.appendChild(actions);

    return el;
  }

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

  // seed demo tasks (no duplication)
  (function seedDemo(){
    if (tasks.length) return;
    const today = (new Date()).toISOString().split('T')[0];
    const later = new Date(Date.now() + 5*24*3600*1000).toISOString().split('T')[0];
    const demos = [
      { title: 'Revisar cartera de María González', description: 'Actualizar distribución según perfil', date: today, priority:'alta' },
      { title: 'Preparar informe trimestral', description: 'Comparativa con benchmark', date: today, priority:'media' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority:'baja' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority:'baja' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority:'baja' },
      { title: 'Contactar nuevo fondo', description: 'Solicitar prospectos', date: today, priority:'baja' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Reunión equipo comercial', description: 'Estrategias Q3', date: later, priority:'media' },
      { title: 'Actualizar documentación', description: 'Verificar cumplimiento', date: later, priority:'alta' }
    ];
    for (const d of demos) {
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
      tasks.push({ id, title: d.title, description: d.description, date: d.date, priority: d.priority, completed:false, eventId: ev.id });
    }
    renderTaskLists();
  })();


  // --------------------------
  // CAROUSEL CONTROLS
  // --------------------------
  function initTaskCarousel() {
    const container = document.querySelector('.tasks-row');
    if (!container) return;
    // avoid duplicate injection
    if (container.querySelector('.carousel-btn')) return;

    const prev = document.createElement('button');
    prev.className = 'carousel-btn left hidden';
    prev.setAttribute('aria-label','Anterior tareas');
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';

    const next = document.createElement('button');
    next.className = 'carousel-btn right hidden';
    next.setAttribute('aria-label','Siguiente tareas');
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';

    container.appendChild(prev);
    container.appendChild(next);

    const scrollAmount = () => Math.round(container.clientWidth * 0.8);

    prev.addEventListener('click', ()=> container.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
    next.addEventListener('click', ()=> container.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));

    function updateControls(){
      const needs = container.scrollWidth > container.clientWidth + 8;
      if (needs) { prev.classList.remove('hidden'); next.classList.remove('hidden'); }
      else { prev.classList.add('hidden'); next.classList.add('hidden'); }
      prev.disabled = container.scrollLeft <= 2;
      next.disabled = container.scrollLeft + container.clientWidth >= container.scrollWidth - 2;
      prev.style.opacity = prev.disabled ? '0.6' : '0.95';
      next.style.opacity = next.disabled ? '0.6' : '0.95';
    }

    container.addEventListener('scroll', () => updateControls());
    window.addEventListener('resize', () => updateControls());
    const mo = new MutationObserver(()=> setTimeout(updateControls, 60));
    mo.observe(container, { childList:true, subtree:true, attributes:true });
    setTimeout(updateControls,120);
  }

  // initialize carousel controls on load as well
  initTaskCarousel();

  // initial render
  renderTaskLists();

  // expose for debugging
  window.__tasksApp = { tasks, render: renderTaskLists };
}); // DOMContentLoaded end
