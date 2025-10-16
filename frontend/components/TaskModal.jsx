// components/home/TaskModal.jsx
'use client';
import { useEffect, useState } from 'react';
export default function TaskModal({ initialTask, onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState('');
  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || '');
      setDesc(initialTask.description || '');
      setDate(initialTask.date || '');
      setPriority(initialTask.priority || '');
    } else {
      setTitle('');
      setDesc('');
      setDate('');
      setPriority('');
    }
  }, [initialTask]);
  const isEdit = !!(initialTask && initialTask.id);
  const handleSave = () => {
    if (!title.trim() || !date || !priority) {
      alert('Completa título, fecha y prioridad.');
      return;
    }
    onSave({
      id: initialTask?.id || null,
      title: title.trim(),
      description,
      date,
      priority,
    });
  };
  const handleOverlay = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };
  return (
    <div className="modal" aria-hidden="false" onMouseDown={handleOverlay} style={{ display: 'flex' }}>
      <div className="modal-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="modal-title">{isEdit ? 'Editar Tarea' : 'Agregar Tarea'}</h2>
        </header>
        <div className="modal-body">
          <label htmlFor="task-title">Título</label>
          <input id="task-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label htmlFor="task-desc">Descripción</label>
          <textarea id="task-desc" value={description} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label htmlFor="task-date">Fecha</label>
              <input id="task-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="task-priority">Prioridad</label>
              <select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Seleccionar</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <button className="btn-save" onClick={handleSave}>
            <i className="fas fa-check" /> Guardar
          </button>
          <button className="btn-close" onClick={onCancel}>
            <i className="fas fa-times" /> Cancelar
          </button>
        </footer>
      </div>
    </div>
  );
}
