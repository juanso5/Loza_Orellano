/**
 * components/fondos.js — implementación completa
 * - gestión de clientes, carteras, fondos y movimientos
 * - modales: movimiento, confirm delete, detalle cartera, historial de especie
 * - persistencia simple con localStorage (LS key: 'fondos_app_v2')
 */

(function () {
  const LS_KEY = 'fondos_app_v2';
  const MAX_MOVEMENTS_SHOWN = 50;

  // ---------- DOM refs ----------
  const el = {
    clientsList: document.getElementById('clients-list'),
    clientSearch: document.getElementById('client-search'),
    clientPlaceholder: document.getElementById('client-placeholder'),
    clientPanel: document.getElementById('client-panel'),
    clientName: document.getElementById('client-name'),
    clientMeta: document.getElementById('client-meta'),
    clientTotal: document.getElementById('client-total'),
    carterasGrid: document.getElementById('carteras-grid'),
    movementsTableBody: document.querySelector('#movements-table tbody'),

    // client internal filter
    clientFundSearch: document.getElementById('client-fund-search'),
    clientFundSuggestions: document.getElementById('client-fund-suggestions'),

    // movement modal
    btnNewMov: document.getElementById('btn-new-mov'),
    movementModal: document.getElementById('movement-modal'),
    moveModalClose: document.getElementById('move-modal-close'),
    movClient: document.getElementById('mov-client'),
    movType: document.getElementById('mov-type'),
    movCartera: document.getElementById('mov-cartera'),
    movFondoSelect: document.getElementById('mov-fondo-select'),
    movFondoNew: document.getElementById('mov-fondo-new'),
    movMonto: document.getElementById('mov-monto'),
    movFecha: document.getElementById('mov-fecha'),
    saveMovement: document.getElementById('save-movement'),
    cancelMovement: document.getElementById('cancel-movement'),

    // confirm delete
    confirmDeleteModal: document.getElementById('confirm-delete-modal'),
    confirmDeleteText: document.getElementById('confirm-delete-text'),
    confirmDeleteYes: document.getElementById('confirm-delete-yes'),
    confirmDeleteNo: document.getElementById('confirm-delete-no'),
    confirmDeleteClose: document.getElementById('confirm-delete-close'),

    // portfolio modal
    portfolioModal: document.getElementById('portfolio-modal'),
    portfolioModalClose: document.getElementById('portfolio-modal-close'),
    portfolioModalCloseBtn: document.getElementById('portfolio-modal-close-btn'),
    portfolioFundsTableBody: document.querySelector('#portfolio-funds-table tbody'),
    portfolioMeta: document.getElementById('portfolio-meta'),
    portfolioTotals: document.getElementById('portfolio-totals'),
    portfolioSaveBtn: document.getElementById('portfolio-save-changes'),
    portfolioFundFilter: document.getElementById('portfolio-fund-filter'),

    // species history modal
    speciesHistoryModal: document.getElementById('species-history-modal'),
    speciesHistoryMeta: document.getElementById('species-history-meta'),
    speciesHistoryTableBody: document.querySelector('#species-history-table tbody'),
    speciesHistoryClose: document.getElementById('species-history-close'),
    speciesHistoryCloseBtn: document.getElementById('species-history-close-btn')
  };

  if (!el.clientsList) { console.error('Fondos: elemento clients-list no encontrado'); return; }

  // ---------- state ----------
  let state = {
    clients: loadFromLS() || demoData(),
    selectedClientId: null,
    pendingDeleteId: null,
    portfolioModalContext: { clientId: null, portfolioId: null }
  };

  // ---------- helpers ----------
  function money(n) { return (Number(n || 0)).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }); }
  function formatNumber(n) { return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }); }
  function fmtDate(s) { if (!s) return ''; const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' }); }
  function initials(name = '') { return name.split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase(); }
  function weighted(arr, key) { const tot = arr.reduce((s, a) => s + (a.nominal || 0), 0); if (tot <= 0) return 0; return arr.reduce((s, a) => s + ((a[key] || 0) * (a.nominal || 0)), 0) / tot; }
  function uid(pref = 'id') { return `${pref}-${Date.now().toString(36)}-${Math.floor(Math.random() * 9000 + 1000)}`; }

  function saveToLS() { try { localStorage.setItem(LS_KEY, JSON.stringify(state.clients)); } catch (e) { console.warn(e); } }
  function loadFromLS() { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  window.__fondos_resetApp = function () { if (confirm('Borrar datos locales?')) { localStorage.removeItem(LS_KEY); location.reload(); } };

  // ---------- render clients ----------
  function renderClients(filter = '') {
    el.clientsList.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();
    const list = state.clients.filter(c => {
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      for (const p of c.portfolios) {
        for (const f of p.funds) {
          if ((f.name || '').toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });

    for (const c of list) {
      const row = document.createElement('div');
      row.className = 'client-row';
      row.dataset.id = c.id;
      if (c.id === state.selectedClientId) row.classList.add('active');
      row.innerHTML = `
        <div class="client-avatar">${initials(c.name)}</div>
        <div style="flex:1; min-width:0">
          <div class="client-name">${c.name}</div>
          <div class="client-meta">Carteras: ${c.portfolios.length} · Movs: ${c.movements.length}</div>
        </div>
        <div class="client-chevron"><i class="fas fa-chevron-right"></i></div>
      `;
      row.addEventListener('click', () => selectClient(c.id));
      el.clientsList.appendChild(row);
    }
  }

  // ---------- select client ----------
  function selectClient(clientId) {
    const client = state.clients.find(x => x.id === clientId);
    if (!client) return;
    state.selectedClientId = clientId;
    for (const ch of el.clientsList.children) ch.classList.toggle('active', ch.dataset.id === clientId);
    el.clientPlaceholder.style.display = 'none';
    el.clientPanel.style.display = 'block';
    el.clientName.textContent = client.name;
    el.clientMeta.textContent = client.description || '';
    el.clientTotal.textContent = money(totalClient(client));

    // clear internal fund search
    if (el.clientFundSearch) el.clientFundSearch.value = '';
    if (el.clientFundSuggestions) el.clientFundSuggestions.setAttribute('aria-hidden', 'true');

    renderCarteras(client);
    renderMovements(client);
  }

  function totalClient(client) {
    return client.portfolios.reduce((acc, p) => acc + p.funds.reduce((s, f) => s + (f.nominal || 0), 0), 0);
  }

  // ---------- render carteras (accepts optional fundFilter) ----------
  function renderCarteras(client, fundFilter = '') {
    el.carterasGrid.innerHTML = '';
    const q = (fundFilter || '').trim().toLowerCase();
    const clientTotal = totalClient(client);

    for (const p of client.portfolios) {
      // if filter active, show portfolio only if any fund matches
      if (q) {
        const has = p.funds.some(f => (f.name || '').toLowerCase().includes(q));
        if (!has) continue;
      }

      const totalNom = p.funds.reduce((s, f) => s + (f.nominal || 0), 0);
      const percent = clientTotal > 0 ? (totalNom / clientTotal * 100) : 0;
      const monthly = weighted(p.funds, 'monthlyReturn');
      const totalReturn = weighted(p.funds, 'totalReturn');

      const card = document.createElement('div');
      card.className = 'cartera-card';
      card.dataset.portfolioId = p.id;
      card.dataset.clientId = client.id;

      // Build inner HTML
      let inner = `
        <div class="cartera-top">
          <div>
            <div class="cartera-name">${p.name}</div>
            <div class="muted">Periodo objetivo: <strong>${p.periodMonths}</strong> meses</div>
          </div>
          <div class="cartera-percent">${percent.toFixed(1)}%</div>
        </div>
        <div class="returns">
          <div class="item"><div class="muted">Rend. mensual</div><div class="value">${(monthly * 100).toFixed(2)}%</div></div>
          <div class="item"><div class="muted">Rend. total</div><div class="value">${(totalReturn * 100).toFixed(2)}%</div></div>
          <div class="item"><div class="muted">Nominal</div><div class="value">${formatNumber(totalNom)}</div></div>
        </div>
      `;

      // If there is a filter show matched species & nominales
      if (q) {
        const matches = p.funds.filter(f => (f.name || '').toLowerCase().includes(q));
        if (matches.length > 0) {
          inner += `<div class="matched-funds" style="margin-top:8px;"><div class="muted" style="margin-bottom:6px;">Especies encontradas en esta cartera:</div><ul class="fund-match-list" style="margin:0; padding:0; list-style:none;">`;
          for (const f of matches) {
            inner += `<li style="padding:6px 0; display:flex; justify-content:space-between; gap:12px; border-top:1px solid rgba(0,0,0,0.03);">
                        <span style="font-weight:600;">${f.name}</span>
                        <span class="muted">${formatNumber(f.nominal)} unidades</span>
                      </li>`;
          }
          inner += `</ul></div>`;
        }
      }

      // Progress
      inner += `<div class="period" style="margin-top:8px;"><div class="muted">Progreso periodo</div>
                  <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(100, Math.round((p.progress || 0) * 100))}%"></div></div>
                </div>`;

      card.innerHTML = inner;
      el.carterasGrid.appendChild(card);
    }
  }

  // ---------- render movements (accepts optional fundFilter to filter rows) ----------
  function renderMovements(client, fundFilter = '') {
    el.movementsTableBody.innerHTML = '';
    const q = (fundFilter || '').trim().toLowerCase();
    const sorted = (client.movements || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const filtered = q ? sorted.filter(m => (m.fund || '').toLowerCase().includes(q)) : sorted;
    for (const m of filtered.slice(0, MAX_MOVEMENTS_SHOWN)) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDate(m.date)}</td>
        <td>${m.type}</td>
        <td>${m.fund}</td>
        <td>${m.portfolio}</td>
        <td class="right">${formatNumber(m.amount)}</td>
        <td><button class="btn-delete-mov" data-id="${m.id}" title="Eliminar movimiento"><i class="fas fa-trash"></i></button></td>
      `;
      el.movementsTableBody.appendChild(tr);
    }
  }

  // ---------- modals helper ----------
  function showModal(modal, focusEl = null) {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (focusEl) focusEl.focus();
  }
  function hideModal(modal) {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ---------- movement modal ----------
  function openMovementModal() {
    // fill clients select
    el.movClient.innerHTML = '';
    for (const c of state.clients) {
      const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name;
      el.movClient.appendChild(opt);
    }
    if (state.selectedClientId) el.movClient.value = state.selectedClientId;

    populateCarterasInModal();
    el.movType.value = 'compra';
    el.movFondoNew.value = '';
    if (el.movFondoNew) el.movFondoNew.style.display = 'none';
    el.movMonto.value = '';
    el.movFecha.value = (new Date()).toISOString().split('T')[0];
    showModal(el.movementModal, el.movFondoSelect);
  }
  function populateCarterasInModal() {
    const clientId = el.movClient.value;
    const client = state.clients.find(x => x.id === clientId);
    el.movCartera.innerHTML = '';
    if (!client) return;
    for (const p of client.portfolios) {
      const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
      el.movCartera.appendChild(opt);
    }
    // populate species for first portfolio
    populateSpeciesForSelectedPortfolio();
  }
  function populateSpeciesForSelectedPortfolio() {
    el.movFondoSelect.innerHTML = '';
    const clientId = el.movClient.value;
    const carteraId = el.movCartera.value;
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;
    const portfolio = client.portfolios.find(p => p.id === carteraId);
    if (!portfolio) {
      const emptyOpt = document.createElement('option'); emptyOpt.value = ''; emptyOpt.textContent = 'Seleccioná cartera primero';
      el.movFondoSelect.appendChild(emptyOpt);
      return;
    }

    // species existing
    for (const f of portfolio.funds) {
      const o = document.createElement('option');
      o.value = f.name;
      o.textContent = `${f.name} — ${formatNumber(f.nominal)} u.`;
      el.movFondoSelect.appendChild(o);
    }

    // option to add new species
    const sep = document.createElement('option');
    sep.value = '__new__';
    sep.textContent = '➕ Agregar nueva especie...';
    el.movFondoSelect.appendChild(sep);

    if (el.movFondoNew) el.movFondoNew.style.display = 'none';
    el.movFondoSelect.selectedIndex = 0;
  }
  function saveMovementFromModal() {
    const clientId = el.movClient ? el.movClient.value : null;
    const client = state.clients.find(x => x.id === clientId);
    if (!client) { alert('Seleccioná un cliente válido'); return; }
    const type = el.movType ? el.movType.value : 'compra';
    const carteraId = el.movCartera ? el.movCartera.value : null;
    const portfolio = client.portfolios.find(p => p.id === carteraId);

    // determine final fund name (selected or new)
    let fondo = '';
    if (el.movFondoSelect) {
      if (el.movFondoSelect.value === '__new__') {
        fondo = el.movFondoNew ? (el.movFondoNew.value || '').trim() : '';
      } else {
        fondo = el.movFondoSelect.value;
      }
    } else {
      fondo = (el.movFondoNew && el.movFondoNew.value) ? el.movFondoNew.value.trim() : '';
    }

    const monto = el.movMonto ? parseFloat(el.movMonto.value) : 0;
    const fecha = el.movFecha ? el.movFecha.value : '';

    if (!portfolio || !fondo || !fecha || !monto || isNaN(monto) || monto <= 0) {
      alert('Completá todos los campos correctamente (monto > 0).');
      return;
    }

    // Validation for sale: cannot sell more than nominal
    if (type === 'venta') {
      const fundObj = portfolio.funds.find(f => (f.name || '').toLowerCase() === fondo.toLowerCase());
      if (!fundObj) {
        alert('No podés vender una especie que no existe en la cartera seleccionada.');
        return;
      }
      if (monto > (fundObj.nominal || 0)) {
        alert(`No podés retirar más de lo que hay. Disponibles: ${formatNumber(fundObj.nominal)} unidades.`);
        return;
      }
    }

    // create movement and update nominal
    const movement = { id: uid('m'), date: fecha, type, fund: fondo, portfolio: portfolio.name, amount: monto };
    client.movements.push(movement);

    let fundObj = portfolio.funds.find(f => (f.name || '').toLowerCase() === fondo.toLowerCase());
    if (!fundObj) {
      fundObj = { id: uid('f'), name: fondo, nominal: 0, monthlyReturn: 0, totalReturn: 0 };
      portfolio.funds.push(fundObj);
    }

    fundObj.nominal = (fundObj.nominal || 0) + (type === 'compra' ? monto : -monto);

    if ((fundObj.nominal || 0) <= 0) portfolio.funds = portfolio.funds.filter(ff => (ff.nominal || 0) > 0);

    saveToLS();
    if (state.selectedClientId === clientId) {
      renderCarteras(client, el.clientFundSearch.value || '');
      renderMovements(client, el.clientFundSearch.value || '');
      el.clientTotal.textContent = money(totalClient(client));
    }
    renderClients(el.clientSearch.value || '');
    hideModal(el.movementModal);
  }

  // ---------- delete movement ----------
  function handleDeleteClick(movId) {
    state.pendingDeleteId = movId;
    const client = state.clients.find(c => c.id === state.selectedClientId);
    const mov = client ? client.movements.find(m => m.id === movId) : null;
    el.confirmDeleteText.textContent = mov ? `Eliminar movimiento ${mov.type} por ${formatNumber(mov.amount)} en ${mov.fund}?` : 'Eliminar movimiento?';
    showModal(el.confirmDeleteModal);
  }
  function confirmDelete() {
    const id = state.pendingDeleteId;
    if (!id || !state.selectedClientId) { hideModal(el.confirmDeleteModal); return; }
    const client = state.clients.find(c => c.id === state.selectedClientId);
    if (!client) { hideModal(el.confirmDeleteModal); return; }
    client.movements = client.movements.filter(m => m.id !== id);
    rebuildFundsFromMovements(client);
    saveToLS();
    renderCarteras(client);
    renderMovements(client);
    renderClients(el.clientSearch.value || '');
    state.pendingDeleteId = null;
    hideModal(el.confirmDeleteModal);
  }
  function rebuildFundsFromMovements(client) {
    for (const p of client.portfolios) for (const f of p.funds) f.nominal = 0;
    for (const mov of client.movements) {
      const p = client.portfolios.find(x => x.name === mov.portfolio);
      if (!p) continue;
      let f = p.funds.find(x => x.name.toLowerCase() === mov.fund.toLowerCase());
      if (!f) { f = { id: uid('f'), name: mov.fund, nominal: 0, monthlyReturn: 0, totalReturn: 0 }; p.funds.push(f); }
      f.nominal = (f.nominal || 0) + (mov.type === 'compra' ? mov.amount : -mov.amount);
    }
    for (const p of client.portfolios) p.funds = p.funds.filter(f => (f.nominal || 0) > 0);
  }

  // ---------- portfolio detail modal ----------
  function openPortfolioModal(clientId, portfolioId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;
    const portfolio = client.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return;

    state.portfolioModalContext = { clientId, portfolioId };
    el.portfolioMeta.textContent = `${client.name} — ${portfolio.name}`;
    el.portfolioFundFilter.value = '';
    renderPortfolioFundsTable(portfolio);
    const total = portfolio.funds.reduce((s, f) => s + (f.nominal || 0), 0);
    el.portfolioTotals.textContent = `Total nominal: ${formatNumber(total)} unidades`;
    showModal(el.portfolioModal);
  }

  function renderPortfolioFundsTable(portfolio, fundFilter = '') {
    if (!el.portfolioFundsTableBody) return;
    const q = (fundFilter || '').trim().toLowerCase();
    el.portfolioFundsTableBody.innerHTML = '';
    const funds = q ? portfolio.funds.filter(f => (f.name || '').toLowerCase().includes(q)) : portfolio.funds;
    if (!funds || funds.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" class="muted">No hay especies en esta cartera.</td>';
      el.portfolioFundsTableBody.appendChild(tr);
      return;
    }
    for (const f of funds) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fund-name-link" data-fund-name="${f.name}" style="cursor:pointer;color:#0f1720;font-weight:600;">${f.name}</td>
        <td><input class="fund-nominal-input" data-fund-id="${f.id}" value="${Number(f.nominal||0).toFixed(2)}" /></td>
        <td>${((f.monthlyReturn || 0) * 100).toFixed(2)}%</td>
        <td>${((f.totalReturn || 0) * 100).toFixed(2)}%</td>
      `;
      el.portfolioFundsTableBody.appendChild(tr);
    }

    // attach click listeners to fund-name cells for history
    el.portfolioFundsTableBody.querySelectorAll('.fund-name-link').forEach(td => {
      td.addEventListener('click', (e) => {
        const fundName = td.dataset.fundName;
        if (!fundName) return;
        openSpeciesHistoryModal(state.portfolioModalContext.clientId, state.portfolioModalContext.portfolioId, fundName);
      });
    });
  }

  function savePortfolioEdits() {
    const ctx = state.portfolioModalContext;
    if (!ctx.clientId || !ctx.portfolioId) { alert('Contexto inválido'); return; }
    const client = state.clients.find(c => c.id === ctx.clientId);
    if (!client) return;
    const portfolio = client.portfolios.find(p => p.id === ctx.portfolioId);
    if (!portfolio) return;

    const inputs = Array.from(el.portfolioFundsTableBody.querySelectorAll('.fund-nominal-input'));
    let changed = false;
    for (const inp of inputs) {
      const fundId = inp.dataset.fundId;
      const raw = inp.value.replace(/\s/g, '').replace(/,/g, '');
      const val = parseFloat(raw);
      if (isNaN(val)) { alert('Nominal inválido en alguna fila. Usá sólo números.'); return; }
      const fundObj = portfolio.funds.find(f => f.id === fundId);
      if (!fundObj) continue;
      if (Math.abs((fundObj.nominal || 0) - val) > 0.0001) {
        fundObj.nominal = val;
        changed = true;
      }
    }

    portfolio.funds = portfolio.funds.filter(f => (f.nominal || 0) > 0);

    if (changed) {
      saveToLS();
      if (state.selectedClientId === client.id) {
        renderCarteras(client, el.clientFundSearch.value || '');
        renderMovements(client, el.clientFundSearch.value || '');
        el.clientTotal.textContent = money(totalClient(client));
      }
      renderPortfolioFundsTable(portfolio, el.portfolioFundFilter.value || '');
      const total = portfolio.funds.reduce((s, f) => s + (f.nominal || 0), 0);
      el.portfolioTotals.textContent = `Total nominal: ${formatNumber(total)} unidades`;
    }
    hideModal(el.portfolioModal);
  }

  // ---------- species history modal ----------
  function openSpeciesHistoryModal(clientId, portfolioId, fundName) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;
    const portfolio = client.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return;
    el.speciesHistoryMeta.textContent = `${fundName} — ${portfolio.name}`;
    el.speciesHistoryTableBody.innerHTML = '';

    const rows = (client.movements || [])
      .filter(m => m.portfolio === portfolio.name && (m.fund || '').toLowerCase() === (fundName || '').toLowerCase())
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" class="muted">No hay movimientos para esta especie en la cartera.</td>';
      el.speciesHistoryTableBody.appendChild(tr);
    } else {
      for (const r of rows) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${fmtDate(r.date)}</td><td>${r.type}</td><td>${r.portfolio}</td><td class="right">${formatNumber(r.amount)}</td>`;
        el.speciesHistoryTableBody.appendChild(tr);
      }
    }
    showModal(el.speciesHistoryModal);
  }

  // ---------- events ----------
  let searchTimer = null;
  el.clientSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderClients(e.target.value || ''), 180);
  });

  let clientFilterTimer = null;
  if (el.clientFundSearch) {
    el.clientFundSearch.addEventListener('input', (e) => {
      clearTimeout(clientFilterTimer);
      clientFilterTimer = setTimeout(() => {
        const q = e.target.value || '';
        const client = state.clients.find(c => c.id === state.selectedClientId);
        if (!client) return;
        renderCarteras(client, q);
        renderMovements(client, q);
        if (el.clientFundSuggestions) renderSpeciesSuggestions(q);
      }, 180);
    });
  }

  // movement modal wiring
  el.btnNewMov && el.btnNewMov.addEventListener('click', openMovementModal);
  el.moveModalClose && el.moveModalClose.addEventListener('click', () => hideModal(el.movementModal));
  el.saveMovement && el.saveMovement.addEventListener('click', saveMovementFromModal);
  el.cancelMovement && el.cancelMovement.addEventListener('click', () => hideModal(el.movementModal));
  el.movClient && el.movClient.addEventListener('change', populateCarterasInModal);
  el.movCartera && el.movCartera.addEventListener('change', populateSpeciesForSelectedPortfolio);
  el.movFondoSelect && el.movFondoSelect.addEventListener('change', (e) => {
    if (!el.movFondoNew) return;
    if (e.target.value === '__new__') { el.movFondoNew.style.display = 'block'; el.movFondoNew.focus(); }
    else el.movFondoNew.style.display = 'none';
  });

  // delete movement delegation
  el.movementsTableBody && el.movementsTableBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-mov');
    if (!btn) return;
    const id = btn.dataset.id;
    e.stopPropagation();
    handleDeleteClick(id);
  });

  // confirm delete actions
  el.confirmDeleteYes && el.confirmDeleteYes.addEventListener('click', confirmDelete);
  el.confirmDeleteNo && el.confirmDeleteNo.addEventListener('click', () => { state.pendingDeleteId = null; hideModal(el.confirmDeleteModal); });
  el.confirmDeleteClose && el.confirmDeleteClose.addEventListener('click', () => { state.pendingDeleteId = null; hideModal(el.confirmDeleteModal); });

  // portfolio modal open via delegation on cartera-card
  el.carterasGrid && el.carterasGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.cartera-card');
    if (!card) return;
    const portfolioId = card.dataset.portfolioId;
    const clientId = card.dataset.clientId;
    if (portfolioId && clientId) openPortfolioModal(clientId, portfolioId);
  });

  // portfolio modal controls
  el.portfolioModalClose && el.portfolioModalClose.addEventListener('click', () => hideModal(el.portfolioModal));
  el.portfolioModalCloseBtn && el.portfolioModalCloseBtn.addEventListener('click', () => hideModal(el.portfolioModal));
  el.portfolioSaveBtn && el.portfolioSaveBtn.addEventListener('click', savePortfolioEdits);
  el.portfolioFundFilter && el.portfolioFundFilter.addEventListener('input', (e) => {
    const ctx = state.portfolioModalContext;
    if (!ctx.clientId || !ctx.portfolioId) return;
    const client = state.clients.find(c => c.id === ctx.clientId);
    if (!client) return;
    const portfolio = client.portfolios.find(p => p.id === ctx.portfolioId);
    if (!portfolio) return;
    renderPortfolioFundsTable(portfolio, e.target.value || '');
  });

  // species history modal close
  el.speciesHistoryClose && el.speciesHistoryClose.addEventListener('click', () => hideModal(el.speciesHistoryModal));
  el.speciesHistoryCloseBtn && el.speciesHistoryCloseBtn.addEventListener('click', () => hideModal(el.speciesHistoryModal));

  // close modals on outside click / ESC
  window.addEventListener('click', (e) => {
    if (e.target === el.movementModal) hideModal(el.movementModal);
    if (e.target === el.confirmDeleteModal) hideModal(el.confirmDeleteModal);
    if (e.target === el.portfolioModal) hideModal(el.portfolioModal);
    if (e.target === el.speciesHistoryModal) hideModal(el.speciesHistoryModal);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (el.movementModal && el.movementModal.getAttribute('aria-hidden') === 'false') hideModal(el.movementModal);
      if (el.confirmDeleteModal && el.confirmDeleteModal.getAttribute('aria-hidden') === 'false') hideModal(el.confirmDeleteModal);
      if (el.portfolioModal && el.portfolioModal.getAttribute('aria-hidden') === 'false') hideModal(el.portfolioModal);
      if (el.speciesHistoryModal && el.speciesHistoryModal.getAttribute('aria-hidden') === 'false') hideModal(el.speciesHistoryModal);
    }
  });

  // ---------- Autocomplete helpers (species suggestions) ----------
  function getSpeciesListForClient(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    const s = new Set();
    if (client) {
      for (const p of client.portfolios) for (const f of p.funds) s.add((f.name || '').trim());
    } else {
      for (const c of state.clients) for (const p of c.portfolios) for (const f of p.funds) s.add((f.name || '').trim());
    }
    return Array.from(s).filter(Boolean).sort((a,b) => a.localeCompare(b));
  }
  function renderSpeciesSuggestions(q = '') {
    const dd = el.clientFundSuggestions;
    if (!dd) return;
    const clientId = state.selectedClientId;
    const list = getSpeciesListForClient(clientId);
    const qLow = (q || '').trim().toLowerCase();
    const matches = qLow ? list.filter(s => s.toLowerCase().includes(qLow)) : list.slice(0, 30);
    dd.innerHTML = '';
    if (matches.length === 0) { dd.setAttribute('aria-hidden', 'true'); return; }
    for (const s of matches) {
      const item = document.createElement('div'); item.className = 'suggestion-item'; item.textContent = s;
      item.addEventListener('click', () => {
        if (!el.clientFundSearch) return;
        el.clientFundSearch.value = s;
        dd.setAttribute('aria-hidden', 'true');
        const client = state.clients.find(c => c.id === state.selectedClientId);
        if (client) { renderCarteras(client, s); renderMovements(client, s); }
      });
      dd.appendChild(item);
    }
    dd.setAttribute('aria-hidden', 'false');
  }

  // ---------- init ----------
  function init() {
    renderClients();
    if (state.clients.length) selectClient(state.clients[0].id);

    // wire up event delegation for delete buttons newly created
    // handled earlier by delegating on table body

    // preload species suggestions if the UI exists
    if (el.clientFundSuggestions) renderSpeciesSuggestions('');
  }
  init();

  // ---------- demo data ----------
  function demoData() {
    return [
      {
        id: 'c-1',
        name: 'María González',
        description: 'Perfil conservador - Objetivo: Preservación de capital',
        portfolios: [
          {
            id: 'p-1',
            name: 'Fondo Retiro',
            periodMonths: 120,
            progress: 0.35,
            funds: [
              { id: 'f-1', name: 'YPF', nominal: 50000, monthlyReturn: 0.012, totalReturn: 0.1625 },
              { id: 'f-2', name: 'Bonos CER', nominal: 30000, monthlyReturn: 0.006, totalReturn: 0.10 },
              { id: 'f-3', name: 'Dólar MEP', nominal: 20000, monthlyReturn: 0.008, totalReturn: 0.15 }
            ]
          },
          {
            id: 'p-2',
            name: 'Fondo Auto',
            periodMonths: 36,
            progress: 0.6,
            funds: [
              { id: 'f-4', name: 'Acciones Tech', nominal: 10000, monthlyReturn: 0.025, totalReturn: 0.45 },
              { id: 'f-5', name: 'FCI Renta Fija', nominal: 15000, monthlyReturn: 0.007, totalReturn: 0.12 }
            ]
          }
        ],
        movements: [
          { id: 'm1', date: '2023-07-15', type: 'compra', fund: 'YPF', portfolio: 'Fondo Retiro', amount: 10000 },
          { id: 'm2', date: '2023-06-01', type: 'compra', fund: 'Bonos CER', portfolio: 'Fondo Retiro', amount: 30000 },
          { id: 'm3', date: '2023-05-20', type: 'compra', fund: 'Dólar MEP', portfolio: 'Fondo Retiro', amount: 20000 }
        ]
      },
      {
        id: 'c-2',
        name: 'Juan Pérez',
        description: 'Perfil agresivo - Objetivo: Crecimiento acelerado',
        portfolios: [
          {
            id: 'p-3',
            name: 'Fondo Crecimiento',
            periodMonths: 48,
            progress: 0.2,
            funds: [
              { id: 'f-6', name: 'Acciones USA', nominal: 80000, monthlyReturn: 0.018, totalReturn: 0.30 },
              { id: 'f-7', name: 'ETF Global', nominal: 20000, monthlyReturn: 0.01, totalReturn: 0.12 }
            ]
          }
        ],
        movements: [
          { id: 'm4', date: '2023-07-20', type: 'compra', fund: 'Acciones USA', portfolio: 'Fondo Crecimiento', amount: 50000 }
        ]
      }
    ];
  }

})();
