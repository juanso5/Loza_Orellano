// components/home/TaskListCard.jsx
'use client';
function TaskItem({ task, onToggleComplete, onEdit, onDelete }) {
  const prClass =
    task.priority === 'alta' ? 'pr-alta' : task.priority === 'media' ? 'pr-media' : 'pr-baja';
  return (
    <div className={`task-item ${prClass} ${task.completed ? 'completed' : ''}`}>
      <div className="task-info">
        <div className="task-title">{task.title}</div>
        <div className="task-desc">{task.description || ''}</div>
        <div className="task-meta">{task.date}</div>
      </div>
      <div className="task-actions">
        <button
          className="action-btn"
          title={task.completed ? 'Marcar no completada' : 'Marcar completada'}
          onClick={() => onToggleComplete(task.id)}
        >
          {task.completed ? <i className="fas fa-check" /> : <i className="far fa-square" />}
        </button>
        <button className="action-btn" title="Editar" onClick={() => onEdit(task)}>
          <i className="fas fa-pen" />
        </button>
        <button className="action-btn" title="Eliminar" onClick={() => onDelete(task.id)}>
          <i className="fas fa-trash" />
        </button>
      </div>
    </div>
  );
}
export default function TaskListCard({ title, tasks, onToggleComplete, onEdit, onDelete }) {
  return (
    <div className="card tasks-card">
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-body task-list">
        {tasks.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: '.9rem' }}>No hay tareas.</div>
        ) : (
          tasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
