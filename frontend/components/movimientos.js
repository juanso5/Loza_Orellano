/* movimientos.js
   Versión integrada, completa y estable:
   - Sidebar (intenta cargar sidebar.html, fallback inyectado)
   - Resumen global sticky
   - Agrupado por cliente -> cartera -> especie (sum nominal)
   - Modal propio para agregar/editar movimiento (validaciones)
   - Modal confirm reutilizable (para borrar y otras confirmaciones)
   - Tabla últimos movimientos
   - Persistencia en localStorage (claves: clients_v1, movements_v1, movements_species_v1, sidebar_collapsed)
*/

document.addEventListener('DOMContentLoaded', () => {
  /************** Constantes / Keys **************/
  const CLIENTS_KEY = 'clients_v1';
  const MOVEMENTS_KEY = 'movements_v1';
  const SPECIES_KEY = 'movements_species_v1';
  const SIDEBAR_KEY = 'sidebar_collapsed';
  const DEFAULT_LAST_N = 10;

  /************** DOM references **************/
  const sidebarContainer = document.getElementById('sidebar-container');
  const mainContentEl = document.getElementById('mainContent');

  const searchInput = document.getElementById('searchInput');
  const openAddBtn = document.getElementById('openAddBtn');

  const summaryClientsEl = document.getElementById('summaryClients');
  const summaryFundsEl = document.getElementById('summaryFunds');
  const summarySpeciesEl = document.getElementById('summarySpecies');
  const summaryNominalEl = document.getElementById('summaryNominal');

  const clientsContainer = document.getElementById('clientsContainer');
  const lastMovementsTbody = document.getElementById('lastMovementsTbody');

  // modals
  const movementModal = document.getElementById('movementModal');
  const clientModal = document.getElementById('clientModal');
  const confirmModal = document.getElementById('confirmModal');

  // movement form fields
  const movementIdInput = document.getElementById('movementId');
  const clienteSelect = document.getElementById('clienteSelect');
  const fondoSelect = document.getElementById('fondoSelect');
  const fechaInput = document.getElementById('fechaInput');
  const tipoSelect = document.getElementById('tipoSelect');
  const especieSelect = document.getElementById('especieSelect');
  const newEspecieInput = document.getElementById('newEspecieInput');
  const nominalInput = document.getElementById('nominalInput');
  const tcInput = document.getElementById('tcInput');
  const obsInput = document.getElementById('obsInput');

  const movementSaveBtn = document.getElementById('movementSaveBtn');
  const movementCancelBtn = document.getElementById('movementCancelBtn');
  const movementModalTitle = document.getElementById('movementModalTitle');

  // client modal
  const clientModalTitle = document.getElementById('clientModalTitle');
  const clientModalBody = document.getElementById('clientModalBody');
  const clientCloseBtn = document.getElementById('clientCloseBtn');

  // confirm modal
  const confirmMessageEl = document.getElementById('confirmMessage');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');

  /************** Estado local (in-memory) **************/
  let clients = [];
  let fondos = [];            // array {id, name}
  let movements = [];
  let speciesList = [];

  let openModalEl = null;

  /************** Utilitarios **************/
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch(e){ return null; }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function genId(){ return Date.now() + Math.floor(Math.random()*9999); }
  function fmtNumber(n) { return Number(n).toLocaleString(undefined, {maximumFractionDigits:2}); }
  function fmtCurrency(n) { return `$ ${Number(n).toLocaleString(undefined, {maximumFractionDigits:2})}`; }
  function escapeHtml(s){ if (s===0) return '0'; if(!s) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  function formatLocalReadable(dtStr){
    if (!dtStr) return '';
    const d = new Date(dtStr);
    if (isNaN(d)) return dtStr;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }

  /************** Sidebar loader (tries to fetch sidebar.html; fallback) **************/
  const SIDEBAR_FALLBACK_HTML = `
    <div class="sidebar" id="sidebar">
      <button id="sidebar-toggle" class="sidebar-toggle"><i class="fas fa-bars"></i></button>
      <ul>
        <li><a href="/home.html"><i class="fas fa-home"></i><span class="menu-text">Inicio</span></a></li>
        <li><a href="/clientes.html"><i class="fas fa-users"></i><span class="menu-text">Clientes</span></a></li>
        <li><a href="/movimientos.html"><i class="fas fa-exchange-alt"></i><span class="menu-text">Movimientos</span></a></li>
        <li><a href="/rendimientos.html"><i class="fas fa-chart-line"></i><span class="menu-text">Rendimientos</span></a></li>
      </ul>
    </div>
  `;

  function loadSidebarAndWire() {
    fetch('sidebar.html').then(r => {
      if (!r.ok) throw new Error('no sidebar file');
      return r.text();
    }).then(html => {
      sidebarContainer.innerHTML = html;
      wireSidebarToggle();
    }).catch(() => {
      // fallback: inject the provided markup
      sidebarContainer.innerHTML = SIDEBAR_FALLBACK_HTML;
      wireSidebarToggle();
    });
  }

  function wireSidebarToggle(){
    const sidebarEl = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (!sidebarEl || !sidebarToggle) return;

    // default: collapsed unless stored explicitly as '0'
    const stored = localStorage.getItem(SIDEBAR_KEY);
    const collapsedDefault = stored === null ? true : stored === '1';
    if (collapsedDefault) {
      sidebarEl.classList.add('collapsed');
      mainContentEl.classList.add('expanded');
    } else {
      sidebarEl.classList.remove('collapsed');
      mainContentEl.classList.remove('expanded');
    }

    sidebarToggle.addEventListener('click', () => {
      sidebarEl.classList.toggle('collapsed');
      mainContentEl.classList.toggle('expanded');
      localStorage.setItem(SIDEBAR_KEY, sidebarEl.classList.contains('collapsed') ? '1' : '0');
      // small delay so reflow happens for components that listen to resize
      setTimeout(()=> window.dispatchEvent(new Event('resize')), 120);
    });
  }

  /************** Modales (show/hide) **************/
  function showModal(el) {
    if (!el) return;
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    openModalEl = el;
  }
  function hideModal(el) {
    if (!el) return;
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (openModalEl === el) openModalEl = null;
  }

  // overlay click and close buttons
  function wireModalClose(modalEl) {
    if (!modalEl) return;
    modalEl.addEventListener('click', (ev) => {
      if (ev.target === modalEl) hideModal(modalEl);
    });
    modalEl.querySelectorAll('.btn-close, .modal-close, .close-btn').forEach(b => b.addEventListener('click', () => hideModal(modalEl)));
  }

  // ESC to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openModalEl) hideModal(openModalEl);
  });

  /************** Confirm modal (promisified) **************/
  function showConfirm(message) {
    return new Promise((resolve, reject) => {
      if (!confirmModal) return reject();
      confirmMessageEl.textContent = message || 'Confirmar acción';
      showModal(confirmModal);
      function onOk(){ cleanup(); resolve(true); }
      function onCancel(){ cleanup(); reject(false); }
      function onKey(e){ if (e.key === 'Escape') { onCancel(); } }
      function cleanup(){
        confirmOkBtn.removeEventListener('click', onOk);
        confirmCancelBtn.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKey);
        hideModal(confirmModal);
      }
      confirmOkBtn.addEventListener('click', onOk);
      confirmCancelBtn.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKey);
    });
  }

  /************** Datos de ejemplo / carga inicial **************/
  const SAMPLE_CLIENTS = [
    { id: 'c1', name: 'Juan Pérez', perfil: 'Conservador', cuit:'20-12345678-9', observ: 'Plan retiro activo' },
    { id: 'c2', name: 'Ana Gómez', perfil: 'Moderado', cuit:'27-87654321-4', observ: '' },
    { id: 'c3', name: 'Carlos López', perfil: 'Agresivo', cuit:'23-11223344-5', observ: 'Interesado en fondos' }
  ];
  const SAMPLE_FONDOS = [ {id:'f1', name:'Fondo Retiro'}, {id:'f2', name:'Fondo Auto'}, {id:'f3', name:'Fondo Viaje'} ];
  const SAMPLE_SPECIES = ['Acciones','Bonos','Fondos','YPF','GGAL'];

  function loadInitialData() {
    const clStored = readJSON(CLIENTS_KEY);
    clients = Array.isArray(clStored) && clStored.length ? clStored : SAMPLE_CLIENTS.slice();

    const spStored = readJSON(SPECIES_KEY);
    speciesList = Array.isArray(spStored) && spStored.length ? spStored : SAMPLE_SPECIES.slice();

    // fondos: if you have an API you'd load them — for now, use sample
    fondos = SAMPLE_FONDOS.slice();

    const mvStored = readJSON(MOVEMENTS_KEY);
    if (Array.isArray(mvStored) && mvStored.length) {
      movements = mvStored.slice();
    } else {
      // seed sample movements
      movements = [
        { id: genId(), fecha:'2025-08-06T10:00:00', clienteId:'c1', clienteName:'Juan Pérez', tipo:'Ingreso', especie:'Bonos', nominal:1000, tc:1, fondoId:'f1', fondoName:'Fondo Retiro', obs:'' },
        { id: genId()+1, fecha:'2025-08-06T11:30:00', clienteId:'c2', clienteName:'Ana Gómez', tipo:'Egreso', especie:'Acciones', nominal:500, tc:1, fondoId:'f2', fondoName:'Fondo Auto', obs:'' },
        { id: genId()+2, fecha:'2025-08-07T09:15:00', clienteId:'c1', clienteName:'Juan Pérez', tipo:'Ingreso', especie:'YPF', nominal:150, tc:1, fondoId:'f1', fondoName:'Fondo Retiro', obs:'' }
      ];
      writeJSON(MOVEMENTS_KEY, movements);
    }

    // persist species so UI shows them next time
    writeJSON(SPECIES_KEY, speciesList);
  }

  /************** Form helpers / validation **************/
  function clearFieldError(el) {
    if (!el) return;
    el.classList.remove('invalid');
    const err = document.getElementById('error-' + el.id);
    if (err) err.textContent = '';
  }
  function showFieldError(el, msg) {
    if (!el) return;
    el.classList.add('invalid');
    const err = document.getElementById('error-' + el.id);
    if (err) err.textContent = msg;
  }

  function validateMovementForm() {
    // clear previous
    [clienteSelect, fondoSelect, fechaInput, tipoSelect, especieSelect, newEspecieInput, nominalInput, tcInput].forEach(clearFieldError);
    const errors = {};
    const clienteId = clienteSelect.value;
    const fondoId = fondoSelect.value;
    const fecha = fechaInput.value;
    const tipo = tipoSelect.value;
    let especieVal = especieSelect.value;
    if (especieVal === '__new__') especieVal = (newEspecieInput.value || '').trim();
    const nominalVal = nominalInput.value;

    if (!clienteId) errors.clienteSelect = 'Seleccioná un cliente.';
    if (!fondoId) errors.fondoSelect = 'Seleccioná una cartera (obligatorio).';
    if (!fecha) errors.fechaInput = 'Seleccioná fecha y hora.';
    if (!tipo) errors.tipoSelect = 'Seleccioná tipo.';
    if (!especieVal) errors.especieSelect = 'Seleccioná o escribí una especie.';
    if (!nominalVal || isNaN(Number(nominalVal)) || Number(nominalVal) <= 0) errors.nominalInput = 'Ingresá un nominal válido (>0).';

    if (errors.clienteSelect) showFieldError(clienteSelect, errors.clienteSelect);
    if (errors.fondoSelect) showFieldError(fondoSelect, errors.fondoSelect);
    if (errors.fechaInput) showFieldError(fechaInput, errors.fechaInput);
    if (errors.tipoSelect) showFieldError(tipoSelect, errors.tipoSelect);
    if (errors.especieSelect) {
      if (especieSelect.value === '__new__') showFieldError(newEspecieInput, errors.especieSelect);
      else showFieldError(especieSelect, errors.especieSelect);
    }
    if (errors.nominalInput) showFieldError(nominalInput, errors.nominalInput);

    return { valid: Object.keys(errors).length === 0, cleaned: { clienteId, fondoId, fecha, tipo, especieVal, nominal: Number(nominalVal), tc: Number(tcInput.value) || 1, obs: obsInput.value || '' } };
  }

  /************** Populate selects (clientes / fondos / especies) **************/
  function populateFormSelects(selectedSpecies) {
    // clients
    clienteSelect.innerHTML = '';
    clients.forEach(c => clienteSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`));

    // fondos
    fondoSelect.innerHTML = '<option value="">-- Seleccionar cartera --</option>';
    fondos.forEach(f => fondoSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`));

    // especies
    populateSpeciesSelect(selectedSpecies);
  }

  function populateSpeciesSelect(selected) {
    especieSelect.innerHTML = '';
    speciesList.forEach(sp => especieSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(sp)}">${escapeHtml(sp)}</option>`));
    especieSelect.insertAdjacentHTML('beforeend', `<option value="__new__">Agregar nueva...</option>`);
    if (selected) {
      if (!speciesList.includes(selected)) { speciesList.push(selected); writeJSON(SPECIES_KEY, speciesList); return populateSpeciesSelect(selected); }
      especieSelect.value = selected;
      newEspecieInput.classList.add('d-none');
    } else {
      especieSelect.selectedIndex = 0;
      newEspecieInput.classList.add('d-none');
      newEspecieInput.value = '';
    }
  }

  especieSelect.addEventListener('change', () => {
    if (especieSelect.value === '__new__') {
      newEspecieInput.classList.remove('d-none'); newEspecieInput.focus();
    } else {
      newEspecieInput.classList.add('d-none'); newEspecieInput.value = '';
      clearFieldError(newEspecieInput);
    }
  });

  newEspecieInput.addEventListener('input', () => clearFieldError(newEspecieInput));

  /************** Grouping / rendering **************/
  // Agrupa movimientos por cliente -> fondo -> especie sumando nominal
  function groupByClient(movs) {
    const map = {};
    movs.forEach(m => {
      const cid = String(m.clienteId);
      const clientName = m.clienteName || (getClientById(cid) || {}).name || 'Cliente';
      const fundName = m.fondoName || (m.fondoId ? (getFundById(m.fondoId)||{}).name : '') || 'Sin cartera';
      if (!map[cid]) map[cid] = { clientName, carteras: {} };
      if (!map[cid].carteras[fundName]) map[cid].carteras[fundName] = {};
      if (!map[cid].carteras[fundName][m.especie]) map[cid].carteras[fundName][m.especie] = 0;
      map[cid].carteras[fundName][m.especie] += Number(m.nominal || 0);
    });
    return map;
  }

  function renderClients(filterQ = '') {
    clientsContainer.innerHTML = '';
    const q = (filterQ || '').trim().toLowerCase();
    const grouped = groupByClient(movements);

    // Render each client in clients array order
    clients.forEach(client => {
      const clientId = String(client.id);
      const aggregated = grouped[clientId];

      // filtering: by client name or internal carteras/especies
      let include = !q || client.name.toLowerCase().includes(q);
      if (!include && aggregated) {
        for (const fund in aggregated.carteras) {
          if (fund.toLowerCase().includes(q)) { include = true; break; }
          for (const sp in aggregated.carteras[fund]) {
            if (sp.toLowerCase().includes(q)) { include = true; break; }
          }
          if (include) break;
        }
      }
      if (!include) return;

      const card = document.createElement('article'); card.className = 'client-card'; card.dataset.clientId = clientId;

      const header = document.createElement('div'); header.className = 'client-header';
      header.innerHTML = `
        <div class="client-left">
          <div class="avatar">${client.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</div>
          <div>
            <div class="client-title">${escapeHtml(client.name)}</div>
            <div class="client-meta">${escapeHtml(client.perfil || '')}${client.arancel ? ' • ' + escapeHtml(client.arancel) : ''}</div>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn" data-action="add" title="Agregar movimiento"><i class="fas fa-plus"></i></button>
          <button class="btn" data-action="detail" title="Ver detalle"><i class="fas fa-eye"></i></button>
          <button class="btn" data-action="toggle" title="Abrir/Cerrar"><i class="fas fa-chevron-down"></i></button>
        </div>
      `;
      card.appendChild(header);

      const body = document.createElement('div'); body.className = 'client-body';

      if (aggregated) {
        // render carteras
        for (const fundName of Object.keys(aggregated.carteras)) {
          const fundBlock = document.createElement('div'); fundBlock.className = 'fund-block';
          fundBlock.innerHTML = `<h4>${escapeHtml(fundName)}</h4>`;
          const ul = document.createElement('ul'); ul.className = 'fund-list';
          for (const sp of Object.keys(aggregated.carteras[fundName])) {
            const nominal = aggregated.carteras[fundName][sp];
            const li = document.createElement('li');
            li.innerHTML = `<span>${escapeHtml(sp)}</span><strong>${fmtNumber(nominal)}</strong>`;
            ul.appendChild(li);
          }
          fundBlock.appendChild(ul);
          body.appendChild(fundBlock);
        }
      } else {
        body.innerHTML = `<div class="hint">Este cliente no tiene movimientos registrados.</div>`;
      }

      card.appendChild(body);

      // event wiring
      header.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleClientCard(card));
      header.querySelector('[data-action="detail"]').addEventListener('click', () => openClientDetail(clientId));
      header.querySelector('[data-action="add"]').addEventListener('click', () => openAddModal(clientId));
      // click on left area also toggles
      header.querySelector('.client-left').addEventListener('click', () => toggleClientCard(card));

      clientsContainer.appendChild(card);
    });
  }

  function toggleClientCard(cardEl) {
    const body = cardEl.querySelector('.client-body');
    if (!body) return;
    const isOpen = body.style.display === 'block';
    body.style.display = isOpen ? 'none' : 'block';
    const icon = cardEl.querySelector('[data-action="toggle"] i');
    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
  }

  function renderLastMovements(lastN = DEFAULT_LAST_N, filterQ = '') {
    lastMovementsTbody.innerHTML = '';
    const q = (filterQ || '').trim().toLowerCase();
    const list = movements.slice().sort((a,b)=> new Date(b.fecha) - new Date(a.fecha))
                  .filter(m => {
                    if (!q) return true;
                    return (m.clienteName || '').toLowerCase().includes(q)
                        || (m.especie || '').toLowerCase().includes(q)
                        || (m.fondoName || '').toLowerCase().includes(q)
                        || (m.obs || '').toLowerCase().includes(q);
                  })
                  .slice(0, lastN);

    if (list.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" class="hint">No hay movimientos recientes</td>`;
      lastMovementsTbody.appendChild(tr);
      return;
    }

    list.forEach(m => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatLocalReadable(m.fecha)}</td>
        <td><a href="#" class="link-client" data-clientid="${m.clienteId}">${escapeHtml(m.clienteName)}</a></td>
        <td>${escapeHtml(m.fondoName || '')}</td>
        <td>${escapeHtml(m.especie)}</td>
        <td>${escapeHtml(m.tipo)}</td>
        <td>${fmtNumber(m.nominal)}</td>
        <td>
          <button class="btn" data-action="edit" data-id="${m.id}" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn" data-action="delete" data-id="${m.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
        </td>
      `;
      lastMovementsTbody.appendChild(tr);
    });

    // delegation on tbody
    lastMovementsTbody.onclick = async (ev) => {
      const btn = ev.target.closest('button, a');
      if (!btn) return;
      if (btn.classList.contains('link-client')) {
        ev.preventDefault();
        const cid = btn.dataset.clientid;
        expandClient(cid);
        openClientDetail(cid);
        return;
      }
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action) return;
      if (action === 'edit') openEditModal(id);
      if (action === 'delete') {
        try {
          await showConfirm('¿Eliminar este movimiento? Esta acción es irreversible.');
          movements = movements.filter(x => String(x.id) !== String(id));
          writeJSON(MOVEMENTS_KEY, movements);
          renderAll();
        } catch (_) { /* cancelado */ }
      }
    };
  }

  function expandClient(clientId) {
    const card = clientsContainer.querySelector(`.client-card[data-client-id="${clientId}"]`);
    if (card) {
      const body = card.querySelector('.client-body');
      if (body) {
        body.style.display = 'block';
        const icon = card.querySelector('[data-action="toggle"] i');
        if (icon) icon.style.transform = 'rotate(180deg)';
        setTimeout(()=> card.scrollIntoView({behavior:'smooth', block:'center'}), 120);
      }
    }
  }

  /************** Client detail modal **************/
  function openClientDetail(clientId) {
    const client = clients.find(c => String(c.id) === String(clientId));
    if (!client) return alert('Cliente no encontrado');
    clientModalTitle.textContent = `Cliente — ${client.name}`;

    const clientMovs = movements.filter(m => String(m.clienteId) === String(clientId));
    const grouped = {};
    clientMovs.forEach(m => {
      const fund = m.fondoName || 'Sin cartera';
      grouped[fund] = grouped[fund] || {};
      grouped[fund][m.especie] = (grouped[fund][m.especie] || 0) + Number(m.nominal || 0);
    });

    let html = `<div class="client-meta-block"><h3>${escapeHtml(client.name)}</h3><div class="client-meta">${escapeHtml(client.perfil || '')} • ${escapeHtml(client.cuit || '')}</div><p style="margin-top:8px;color:#475569">${escapeHtml(client.observ||'')}</p></div>`;
    html += `<h4 style="margin-top:12px">Composición por cartera</h4>`;
    if (Object.keys(grouped).length === 0) html += `<div class="hint">Sin activos registrados</div>`;
    else {
      for (const fund of Object.keys(grouped)) {
        html += `<div class="fund-block"><h4>${escapeHtml(fund)}</h4><ul class="fund-list">`;
        for (const sp of Object.keys(grouped[fund])) {
          html += `<li><span>${escapeHtml(sp)}</span><strong>${fmtNumber(grouped[fund][sp])}</strong></li>`;
        }
        html += `</ul></div>`;
      }
    }

    html += `<hr/><h4>Movimientos recientes</h4><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Especie</th><th>Nominal</th><th>Cartera</th></tr></thead><tbody>`;
    const recent = clientMovs.slice().sort((a,b)=> new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
    if (recent.length === 0) html += `<tr><td colspan="5" class="hint">Sin movimientos</td></tr>`;
    else {
      recent.forEach(m => {
        html += `<tr><td>${formatLocalReadable(m.fecha)}</td><td>${escapeHtml(m.tipo)}</td><td>${escapeHtml(m.especie)}</td><td>${fmtNumber(m.nominal)}</td><td>${escapeHtml(m.fondoName||'')}</td></tr>`;
      });
    }
    html += `</tbody></table></div>`;
    clientModalBody.innerHTML = html;
    showModal(clientModal);
  }

  clientCloseBtn.addEventListener('click', () => hideModal(clientModal));

  /************** Open Add / Edit modals **************/
  function openAddModal(prefillClientId) {
    movementModalTitle.textContent = 'Agregar movimiento';
    movementIdInput.value = '';
    // reset form
    document.getElementById('movementForm').reset();
    // prefill client if provided
    if (prefillClientId) clienteSelect.value = prefillClientId;
    // set now local datetime
    const now = new Date();
    fechaInput.value = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
    tipoSelect.value = 'Ingreso';
    populateFormSelects();
    // clear errors
    [clienteSelect, fondoSelect, fechaInput, tipoSelect, especieSelect, newEspecieInput, nominalInput, tcInput].forEach(clearFieldError);
    showModal(movementModal);
  }

  function openEditModal(id) {
    const m = movements.find(x => String(x.id) === String(id));
    if (!m) return alert('Movimiento no encontrado');
    movementModalTitle.textContent = 'Editar movimiento';
    movementIdInput.value = m.id;
    populateFormSelects(m.especie);
    clienteSelect.value = m.clienteId;
    fondoSelect.value = m.fondoId || '';
    const d = new Date(m.fecha);
    fechaInput.value = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    tipoSelect.value = m.tipo;
    if (!speciesList.includes(m.especie)) { speciesList.push(m.especie); writeJSON(SPECIES_KEY, speciesList); populateSpeciesSelect(m.especie); }
    nominalInput.value = m.nominal;
    tcInput.value = m.tc || '';
    obsInput.value = m.obs || '';
    [clienteSelect, fondoSelect, fechaInput, tipoSelect, especieSelect, newEspecieInput, nominalInput, tcInput].forEach(clearFieldError);
    showModal(movementModal);
  }

  /************** Save movement handler **************/
  movementSaveBtn.addEventListener('click', () => {
    const { valid, cleaned } = validateMovementForm();
    if (!valid) return;
    // if new species, save it
    if (especieSelect.value === '__new__') {
      if (!speciesList.includes(cleaned.especieVal)) { speciesList.push(cleaned.especieVal); writeJSON(SPECIES_KEY, speciesList); }
    }
    const id = movementIdInput.value;
    const clienteName = (getClientById(cleaned.clienteId) || {}).name || '';
    const fondoName = (getFundById(cleaned.fondoId) || {}).name || '';
    if (id) {
      const idx = movements.findIndex(x => String(x.id) === String(id));
      if (idx === -1) { alert('Movimiento no encontrado'); return; }
      movements[idx] = { ...movements[idx], clienteId: cleaned.clienteId, clienteName, fecha: cleaned.fecha, tipo: cleaned.tipo, especie: cleaned.especieVal, nominal: cleaned.nominal, tc: cleaned.tc, fondoId: cleaned.fondoId, fondoName, obs: cleaned.obs };
    } else {
      const newId = genId();
      movements.push({ id:newId, clienteId: cleaned.clienteId, clienteName, fecha: cleaned.fecha, tipo: cleaned.tipo, especie: cleaned.especieVal, nominal: cleaned.nominal, tc: cleaned.tc, fondoId: cleaned.fondoId, fondoName, obs: cleaned.obs });
    }
    writeJSON(MOVEMENTS_KEY, movements);
    renderAll();
    hideModal(movementModal);
  });

  movementCancelBtn.addEventListener('click', () => hideModal(movementModal));

  /************** Utility getters **************/
  function getClientById(id) { return clients.find(c => String(c.id) === String(id)); }
  function getFundById(id) { return fondos.find(f => String(f.id) === String(id)); }

  /************** Summary render **************/
  function renderSummary() {
    // total clients: unique clients known (clients array)
    const totalClients = clients.length;
    // total funds: union of fondos array + funds appearing in movements
    const fundsSet = new Set(fondos.map(f=>f.name));
    movements.forEach(m => { if (m.fondoName) fundsSet.add(m.fondoName); });
    const totalFunds = fundsSet.size;
    // species: union speciesList + present in movements
    const spSet = new Set(speciesList.slice());
    movements.forEach(m => spSet.add(m.especie));
    const totalSpecies = spSet.size;
    // nominal total
    const nominalTotal = movements.reduce((acc,m)=> acc + (Number(m.nominal)||0), 0);

    summaryClientsEl.textContent = totalClients;
    summaryFundsEl.textContent = totalFunds;
    summarySpeciesEl.textContent = totalSpecies;
    summaryNominalEl.textContent = fmtCurrency(nominalTotal);
  }

  /************** Render all (main entry) **************/
  function renderAll() {
    const q = searchInput.value || '';
    renderSummary();
    renderClients(q);
    renderLastMovements(DEFAULT_LAST_N, q);
    populateFormSelects();
  }

  /************** Search filter events **************/
  searchInput.addEventListener('input', () => renderAll());

  /************** Confirm wiring for confirm modal and modal closers **************/
  [movementModal, clientModal, confirmModal].forEach(wireModalClose);

  /************** Initialization **************/
  function init() {
    loadSidebarAndWire();
    loadInitialData();
    renderAll();

    // wire top add button
    if (openAddBtn) openAddBtn.addEventListener('click', () => openAddModal());

    // wire close on client modal close button
    // already added above

    // make sure clicking client name in last movements expands & opens detail: done via delegation
  }

  // run init
  init();

  /************** Expose for debugging (optional) **************/
  window.__movementsApp = {
    get state() { return { clients, fondos, movements, speciesList }; },
    reload: () => { loadInitialData(); renderAll(); }
  };
});
