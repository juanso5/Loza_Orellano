document.addEventListener('DOMContentLoaded', function () {
  // Listado
  const clientsListEl = document.getElementById('clients-list');

  // Botones abrir/cerrar modal principal
  const openModalBtn = document.getElementById('open-modal-btn');
  const clientModal = document.getElementById('client-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const closeModalX = document.getElementById('modal-close-x');

  // Form y campos
  const clientForm = document.getElementById('client-form');
  const modalTitle = document.getElementById('modal-title');

  const clientNameInput = document.getElementById('client-name');
  const clientEmailInput = document.getElementById('client-email');
  const clientPhoneInput = document.getElementById('client-phone');
  const clientCuitInput = document.getElementById('client-cuit');
  const clientAddressInput = document.getElementById('client-address');
  const clientFinancialDataInput = document.getElementById('client-financial-data');
  const clientRiskProfileInput = document.getElementById('client-risk-profile');
  const clientCommentsInput = document.getElementById('client-comments');
  
  // Búsqueda en vivo
  const searchInput = document.getElementById('search-input');

  // Errores
  const errorName = document.getElementById('error-name');
  const errorEmail = document.getElementById('error-email');
  const errorCuit = document.getElementById('error-cuit');

  // Modal confirmación de borrado
  const confirmModal = document.getElementById('confirm-delete-modal');
  const confirmText = document.getElementById('confirm-delete-text');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const cancelConfirmBtn = document.getElementById('cancel-delete-btn');
  
  // Modal ver cliente
  const viewModal = document.getElementById('view-client-modal');
  const closeViewBtn = document.getElementById('close-view-modal-btn');

  // Estado
  let clients = [];
  let editingClientId = null;
  let pendingDeleteId = null;

  // Utils CUIT
  const onlyDigits = (s) => (s || '').replace(/\D/g, '');
  function formatCuit(digits) { /* ...existing code... */ }
  function isValidCuit(raw) { /* ...existing code... */ }

  // Normalizar texto para comparar nombres (quita tildes y pasa a minúsculas)
  const normalize = (s) =>
    (s || '').toString().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function filterClients(query) {
    const q = (query || '').trim();
    if (!q) return clients;
    const qText = normalize(q);
    const qDigits = onlyDigits(q);

    return clients.filter(c => {
      const nameMatch = normalize(c.name).includes(qText);
      const cuitDigits = onlyDigits(c.cuit || '');
      const cuitMatch = qDigits.length >= 2 && cuitDigits.includes(qDigits);
      return nameMatch || cuitMatch;
    });
  }

  function applyFilterAndRender() {
    const list = filterClients(searchInput?.value || '');
    renderClientsList(list);
  }

  function openViewModal(clientId) {
    const c = clients.find(x => x.id === clientId);
    if (!c || !viewModal) return;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || 'No disponible';
    };
    set('view-client-name', c.name);
    set('view-client-cuit', c.cuit);
    set('view-client-email', c.email);
    set('view-client-phone', c.phone);
    set('view-client-address', c.address);
    set('view-client-financial', c.financialData);
    set('view-client-risk', c.riskProfile);
    set('view-client-comments', c.comments);
    viewModal.classList.add('active');
  }
  function closeViewModal() { viewModal?.classList.remove('active'); }

  // UI helpers
  function openClientModal(isEdit = false) {
    if (!clientModal) return;
    clientModal.classList.add('active');
    if (isEdit) {
      modalTitle.textContent = 'Editar Cliente';
    } else {
      modalTitle.textContent = 'Agregar Cliente';
      clientForm?.reset();
      clearErrors();
    }
    setTimeout(() => clientNameInput?.focus(), 50);
  }
  function closeClientModal() {
    clientModal?.classList.remove('active');
    editingClientId = null;
  }
  function clearErrors() {
    if (errorName) errorName.textContent = '';
    if (errorEmail) errorEmail.textContent = '';
    if (errorCuit) errorCuit.textContent = '';
  }

  // Confirm delete modal
  function openConfirmDelete(id) {
    pendingDeleteId = id;
    const c = clients.find(x => x.id === id);
    if (confirmText) {
      confirmText.textContent = c
        ? `¿Eliminar al cliente "${c.name}"? Esta acción no se puede deshacer.`
        : '¿Eliminar este cliente? Esta acción no se puede deshacer.';
    }
    if (confirmModal) {
      confirmModal.setAttribute('aria-hidden', 'false');
      confirmModal.classList.add('active');
    }
  }
  function closeConfirmDelete() {
    pendingDeleteId = null;
    if (confirmModal) {
      confirmModal.setAttribute('aria-hidden', 'true');
      confirmModal.classList.remove('active');
    }
  }

    // CRUD
  function renderClientsList(list = clients) {
    if (!clientsListEl) return;
    clientsListEl.innerHTML = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = (searchInput && searchInput.value?.trim())
        ? 'No hay clientes que coincidan.'
        : 'Sin clientes aún.';
      clientsListEl.appendChild(empty);
      return;
    }
    list.forEach(c => {
      const item = document.createElement('div');
      item.className = 'client-item';
      item.innerHTML = `
        <div class="client-main">
          <h3 class="client-name">${c.name}</h3>
          <div class="client-meta">
            ${c.cuit ? `<span><i class="fa-regular fa-id-card"></i> ${c.cuit}</span>` : ''}
            ${c.email ? `<span><i class="fa-regular fa-envelope"></i> ${c.email}</span>` : ''}
            ${c.phone ? `<span><i class="fa-solid fa-phone"></i> ${c.phone}</span>` : ''}
            ${c.riskProfile ? `<span><i class="fa-solid fa-gauge-high"></i> ${c.riskProfile}</span>` : ''}
          </div>
        </div>
        <div class="client-actions">
          <button class="action-btn edit-btn" title="Editar" aria-label="Editar cliente">
            <i class="fas fa-pen"></i>
          </button>
          <button class="action-btn delete-btn" title="Eliminar" aria-label="Eliminar cliente">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.edit-btn') || e.target.closest('.delete-btn')) return;
        openViewModal(c.id);
      });
      item.querySelector('.edit-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openEdit(c.id);
      });
      item.querySelector('.delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openConfirmDelete(c.id);
      });
      clientsListEl.appendChild(item);
    });
  }

  function openEdit(id) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    editingClientId = id;
    clientNameInput.value = c.name || '';
    clientCuitInput.value = c.cuit || '';
    clientEmailInput.value = c.email || '';
    clientPhoneInput.value = c.phone || '';
    clientAddressInput.value = c.address || '';
    clientFinancialDataInput.value = c.financialData || '';
    clientRiskProfileInput.value = c.riskProfile || '';
    clientCommentsInput.value = c.comments || '';
    clearErrors();
    openClientModal(true);
  }

  function upsertFromForm() {
    clearErrors();
    const name = clientNameInput.value.trim();
    const cuitRaw = clientCuitInput.value.trim();
    const email = clientEmailInput.value.trim();
    const phone = clientPhoneInput.value.trim();
    const address = clientAddressInput.value.trim();
    const financialData = clientFinancialDataInput.value.trim();
    const riskProfile = clientRiskProfileInput.value;
    const comments = clientCommentsInput.value.trim();

    let hasError = false;
    if (!name) {
      if (errorName) errorName.textContent = 'El nombre es obligatorio.';
      hasError = true;
    }
    if (email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        if (errorEmail) errorEmail.textContent = 'Ingrese un email válido.';
        hasError = true;
      }
    }
    if (cuitRaw) {
      if (!isValidCuit(cuitRaw)) {
        if (errorCuit) errorCuit.textContent = 'CUIT inválido. Debe tener 11 dígitos (ej. 20-12345678-3).';
        hasError = true;
      }
    }
    if (hasError) return false;

    const cuitDigits = onlyDigits(cuitRaw);
    const cuit = cuitDigits.length === 11 ? formatCuit(cuitDigits) : '';

    if (editingClientId) {
      const c = clients.find(x => x.id === editingClientId);
      if (c) Object.assign(c, { name, cuit, email, phone, address, financialData, riskProfile, comments });
    } else {
      const id = clients.length ? Math.max(...clients.map(x => x.id)) + 1 : 1;
      clients.push({ id, name, cuit, email, phone, address, financialData, riskProfile, comments });
    }
    return true;
  }

  function deleteClient(id) {
    clients = clients.filter(x => x.id !== id);
  }

  // Eventos UI
  openModalBtn?.addEventListener('click', () => openClientModal(false));
  closeModalBtn?.addEventListener('click', closeClientModal);
  closeModalX?.addEventListener('click', closeClientModal);
  clientModal?.addEventListener('click', (e) => { if (e.target === clientModal) closeClientModal(); });

  // Cierres de modales
  closeViewBtn?.addEventListener('click', closeViewModal);
  viewModal?.addEventListener('click', (e) => { if (e.target === viewModal) closeViewModal(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (clientModal?.classList.contains('active')) closeClientModal();
      if (viewModal?.classList.contains('active')) closeViewModal();
      if (confirmModal && confirmModal.getAttribute('aria-hidden') === 'false') closeConfirmDelete();
    }
  });

  // Submit formulario
  clientForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = upsertFromForm();
    if (!ok) return;
    applyFilterAndRender();
    clientForm.reset();
    closeClientModal();
  });

  // Confirmación de borrado
  confirmBtn?.addEventListener('click', () => {
    if (pendingDeleteId != null) {
      deleteClient(pendingDeleteId);
     applyFilterAndRender();
    }
    closeConfirmDelete();
  });

  // Búsqueda en vivo
  searchInput?.addEventListener('input', applyFilterAndRender);

  // Datos demo opcionales
  clients = [
    { id: 1, name: 'Juancito Pérez', cuit: '20-12345678-3', email: 'juan@example.com', phone: '+54 9 11 1234-5678', riskProfile: 'Moderado' },
    { id: 2, name: 'Ana Gómez', cuit: '27-00000000-5', email: 'ana@example.com', phone: '+54 9 11 9876-5432', riskProfile: 'Bajo' }
  ];
  applyFilterAndRender();
});

