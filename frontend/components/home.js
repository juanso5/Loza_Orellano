document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const tasksListEl = document.getElementById('tasks-list');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const taskModal = document.getElementById('task-modal');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskDateInput = document.getElementById('task-date');
    const taskDescriptionInput = document.getElementById('task-description');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es', // Set the calendar to Spanish
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [],
        eventClick: function (info) {
            const newTitle = prompt('Editar título de la tarea:', info.event.title);
            const newDescription = prompt('Editar descripción de la tarea:', info.event.extendedProps.description);
            const newDate = prompt('Editar fecha de la tarea:', info.event.startStr);
            if (newTitle) {
                info.event.setProp('title', newTitle);
            }
            if (newDescription) {
                info.event.setExtendedProp('description', newDescription);
            }
            if (newDate) {
                info.event.setStart(newDate);
            }
            updateTaskList();
        }
    });

    calendar.render();

    // Open Modal
    openModalBtn.addEventListener('click', function () {
        taskModal.classList.add('active');
    });

    // Close Modal
    closeModalBtn.addEventListener('click', function () {
        taskModal.classList.remove('active');
    });

    // Add Task Functionality
    addTaskBtn.addEventListener('click', function () {
        const title = taskTitleInput.value;
        const date = taskDateInput.value;
        const description = taskDescriptionInput.value;

        if (title && date && description) {
            const newEvent = {
                title: title,
                start: date,
                description: description
            };
            calendar.addEvent(newEvent);
            taskTitleInput.value = '';
            taskDateInput.value = '';
            taskDescriptionInput.value = '';
            taskModal.classList.remove('active');
            updateTaskList();
        } else {
            alert('Por favor, complete todos los campos.');
        }
    });

    // Update Task List
    function updateTaskList() {
        tasksListEl.innerHTML = '';
        const events = calendar.getEvents();
        events.forEach(event => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.innerHTML = `
                <div class="task-title">${event.title}</div>
                <div class="task-description">${event.extendedProps.description || ''}</div>
                <div class="task-date">Fecha: ${event.start.toLocaleDateString('es-ES')}</div>
                <div class="task-actions">
                    <button class="edit-btn" onclick="editTask('${event.id}')">Editar</button>
                    <button class="delete-btn" onclick="deleteTask('${event.id}')">Eliminar</button>
                </div>
            `;
            tasksListEl.appendChild(taskItem);
        });
    }

    // Edit Task
    window.editTask = function (id) {
        const event = calendar.getEventById(id);
        const newTitle = prompt('Editar título de la tarea:', event.title);
        const newDescription = prompt('Editar descripción de la tarea:', event.extendedProps.description);
        const newDate = prompt('Editar fecha de la tarea:', event.startStr);
        if (newTitle) {
            event.setProp('title', newTitle);
        }
        if (newDescription) {
            event.setExtendedProp('description', newDescription);
        }
        if (newDate) {
            event.setStart(newDate);
        }
        updateTaskList();
    };

    // Delete Task
    window.deleteTask = function (id) {
        const event = calendar.getEventById(id);
        event.remove();
        updateTaskList();
    };
});

document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    toggleBtn.addEventListener('click', function () {
        sidebar.classList.toggle('collapsed');
    });
});