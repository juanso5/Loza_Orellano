document.addEventListener('DOMContentLoaded', function () {
    const movementsListEl = document.getElementById('movements-list');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const movementModal = document.getElementById('movement-modal');
    const addMovementBtn = document.getElementById('add-movement-btn');
    const movementClientInput = document.getElementById('movement-client');
    const movementTypeInput = document.getElementById('movement-type');
    const movementSpecieInput = document.getElementById('movement-specie');
    const movementNominalInput = document.getElementById('movement-nominal');

    // Edit modal elements
    const editMovementModal = document.getElementById('edit-movement-modal');
    const editMovementClientInput = document.getElementById('edit-movement-client');
    const editMovementTypeInput = document.getElementById('edit-movement-type');
    const editMovementSpecieInput = document.getElementById('edit-movement-specie');
    const editMovementNominalInput = document.getElementById('edit-movement-nominal');
    const saveEditMovementBtn = document.getElementById('save-edit-movement-btn');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');

        // ...asegúrate que esto esté antes de renderMovementsList...
    let movements = [
        {
            id: 1,
            client: 'Juan Pérez',
            type: 'Ingreso',
            specie: 'Bonos',
            nominal: 1000,
            date: '2025-08-06 10:00',
        },
        {
            id: 2,
            client: 'Ana Gómez',
            type: 'Egreso',
            specie: 'Acciones',
            nominal: 500,
            date: '2025-08-06 11:30',
        }
    ];
    
    let editingMovementId = null;

    function renderMovementsList(filteredMovements = movements) {
        movementsListEl.innerHTML = '';
        // Encabezado tipo tabla
        const header = document.createElement('div');
        header.className = 'movement-row movement-header';
        header.innerHTML = `
            <div class="movement-cell">Fecha y Hora</div>
            <div class="movement-cell">Cliente</div>
            <div class="movement-cell">Tipo</div>
            <div class="movement-cell">Especie</div>
            <div class="movement-cell">Nominal</div>
            <div class="movement-cell">Acciones</div>
        `;
        movementsListEl.appendChild(header);

        filteredMovements.forEach(movement => {
            const movementRow = document.createElement('div');
            movementRow.className = 'movement-row';
            movementRow.innerHTML = `
                <div class="movement-cell">${movement.date}</div>
                <div class="movement-cell">${movement.client}</div>
                <div class="movement-cell">${movement.type}</div>
                <div class="movement-cell">${movement.specie}</div>
                <div class="movement-cell">${movement.nominal}</div>
                <div class="movement-cell">
                    <button class="edit-btn" data-id="${movement.id}">Editar</button>
                    <button class="delete-btn" data-id="${movement.id}">Eliminar</button>
                </div>
            `;
            movementsListEl.appendChild(movementRow);

            movementRow.querySelector('.edit-btn').addEventListener('click', function () {
                openEditModal(movement.id);
            });

            movementRow.querySelector('.delete-btn').addEventListener('click', function () {
                deleteMovement(movement.id);
            });
        });
    }

    openModalBtn.addEventListener('click', function () {
        movementModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', function () {
        movementModal.classList.remove('active');
        movementClientInput.value = '';
        movementTypeInput.value = '';
        movementSpecieInput.value = '';
        movementNominalInput.value = '';
    });

    addMovementBtn.addEventListener('click', function () {
        const client = movementClientInput.value;
        const type = movementTypeInput.value;
        const specie = movementSpecieInput.value;
        const nominal = movementNominalInput.value;

        if (client && type && specie && nominal) {
            const now = new Date();
            const date = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0') + ' ' +
                String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0');
            const newMovement = {
                id: movements.length ? movements[movements.length - 1].id + 1 : 1,
                client,
                type,
                specie,
                nominal: parseFloat(nominal),
                date
            };
            movements.push(newMovement);
            movementClientInput.value = '';
            movementTypeInput.value = '';
            movementSpecieInput.value = '';
            movementNominalInput.value = '';
            movementModal.classList.remove('active');
            renderMovementsList();
        } else {
            alert('Por favor, complete todos los campos.');
        }
    });

    // Editar movimiento
    function openEditModal(movementId) {
        const movement = movements.find(m => m.id === movementId);
        if (movement) {
            editingMovementId = movementId;
            editMovementClientInput.value = movement.client;
            editMovementTypeInput.value = movement.type;
            editMovementSpecieInput.value = movement.specie;
            editMovementNominalInput.value = movement.nominal;
            editMovementModal.classList.add('active');
        }
    }

    closeEditModalBtn.addEventListener('click', function () {
        editMovementModal.classList.remove('active');
        editingMovementId = null;
    });

    saveEditMovementBtn.addEventListener('click', function () {
        const client = editMovementClientInput.value;
        const type = editMovementTypeInput.value;
        const specie = editMovementSpecieInput.value;
        const nominal = editMovementNominalInput.value;

        if (client && type && specie && nominal) {
            const movement = movements.find(m => m.id === editingMovementId);
            if (movement) {
                movement.client = client;
                movement.type = type;
                movement.specie = specie;
                movement.nominal = parseFloat(nominal);
                // La fecha y hora original se mantiene
            }
            editMovementModal.classList.remove('active');
            renderMovementsList();
        } else {
            alert('Por favor, complete todos los campos.');
        }
    });

    // Eliminar movimiento
    function deleteMovement(movementId) {
        movements = movements.filter(m => m.id !== movementId);
        renderMovementsList();
    }

    searchBtn.addEventListener('click', function () {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredMovements = movements.filter(movement =>
            movement.client.toLowerCase().includes(searchTerm) ||
            movement.specie.toLowerCase().includes(searchTerm)
        );
        renderMovementsList(filteredMovements);
    });

    renderMovementsList();
});