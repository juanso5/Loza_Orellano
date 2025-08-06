document.addEventListener('DOMContentLoaded', function () {
    const clientsListEl = document.getElementById('clients-list');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const clientModal = document.getElementById('client-modal');
    const modalTitle = document.getElementById('modal-title');
    const saveClientBtn = document.getElementById('save-client-btn');
    const clientNameInput = document.getElementById('client-name');
    const clientFinancialDataInput = document.getElementById('client-financial-data');
    const clientRiskProfileInput = document.getElementById('client-risk-profile');
    const clientCommentsInput = document.getElementById('client-comments');

    let clients = [
        { id: 1, name: 'Juan Pérez', financialData: 'Activo: $50,000 | Pasivo: $10,000', riskProfile: 'Moderado', comments: 'Cliente estable.' },
        { id: 2, name: 'Ana Gómez', financialData: 'Activo: $120,000 | Pasivo: $30,000', riskProfile: 'Alto', comments: 'Requiere seguimiento.' },
        { id: 3, name: 'Carlos López', financialData: 'Activo: $80,000 | Pasivo: $20,000', riskProfile: 'Bajo', comments: 'Buen historial financiero.' }
    ];

    let editingClientId = null;

    // Render clients list
    function renderClientsList() {
        clientsListEl.innerHTML = '';
        clients.forEach(client => {
            const clientItem = document.createElement('div');
            clientItem.className = 'client-item';
            clientItem.innerHTML = `
                <h3>${client.name}</h3>
                <p><strong>Datos Financieros:</strong> ${client.financialData}</p>
                <p><strong>Perfil de Riesgo:</strong> ${client.riskProfile}</p>
                <p><strong>Comentarios:</strong> ${client.comments}</p>
                <div class="client-actions">
                    <button class="edit-btn" data-id="${client.id}">Editar</button>
                    <button class="delete-btn" data-id="${client.id}">Eliminar</button>
                </div>
            `;
            clientsListEl.appendChild(clientItem);

            clientItem.querySelector('.edit-btn').addEventListener('click', function () {
                openEditModal(client.id);
            });

            clientItem.querySelector('.delete-btn').addEventListener('click', function () {
                deleteClient(client.id);
            });
        });
    }

    // Open modal for adding client
    openModalBtn.addEventListener('click', function () {
        editingClientId = null;
        modalTitle.textContent = 'Agregar Cliente';
        clientNameInput.value = '';
        clientFinancialDataInput.value = '';
        clientRiskProfileInput.value = '';
        clientCommentsInput.value = '';
        clientModal.classList.add('active');
    });

    // Open modal for editing client
    function openEditModal(clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            editingClientId = clientId;
            modalTitle.textContent = 'Editar Cliente';
            clientNameInput.value = client.name;
            clientFinancialDataInput.value = client.financialData;
            clientRiskProfileInput.value = client.riskProfile;
            clientCommentsInput.value = client.comments;
            clientModal.classList.add('active');
        }
    }

    // Close modal
    closeModalBtn.addEventListener('click', function () {
        clientModal.classList.remove('active');
    });

    // Save client (add or edit)
    saveClientBtn.addEventListener('click', function () {
        const name = clientNameInput.value;
        const financialData = clientFinancialDataInput.value;
        const riskProfile = clientRiskProfileInput.value;
        const comments = clientCommentsInput.value;

        if (name && financialData && riskProfile && comments) {
            if (editingClientId) {
                const client = clients.find(c => c.id === editingClientId);
                client.name = name;
                client.financialData = financialData;
                client.riskProfile = riskProfile;
                client.comments = comments;
            } else {
                const newClient = {
                    id: clients.length + 1,
                    name,
                    financialData,
                    riskProfile,
                    comments
                };
                clients.push(newClient);
            }
            clientModal.classList.remove('active');
            renderClientsList();
        } else {
            alert('Por favor, complete todos los campos.');
        }
    });

    // Delete client
    function deleteClient(clientId) {
        clients = clients.filter(c => c.id !== clientId);
        renderClientsList();
    }

    // Initial render
    renderClientsList();
});