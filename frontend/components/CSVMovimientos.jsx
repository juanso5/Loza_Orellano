'use client';

import { useEffect, useRef } from 'react';

/**
 * Datos 100% desde la base vía /api/movimiento:
 * - Nombres reales: cliente_nombre, cartera_nombre, especie (JOINs en el handler)
 * - tipo_mov: compra/venta (UI: Ingreso/Egreso)
 * - nominal: int (DB int4)
 * - precio_usd: se muestra en el campo "Tipo de cambio"
 */
export default function CSVMovimientos() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const CSV_KEY = 'movements_prices_v1';
    const DEFAULT_LAST_N = 10;

    // DOM refs
    const searchInput = document.getElementById('searchInput');
    const openAddBtn = document.getElementById('openAddBtn');
    const summaryNominalEl = document.getElementById('summaryNominal');
    const clientsContainer = document.getElementById('clientsContainer');
    const lastMovementsTbody = document.getElementById('lastMovementsTbody');

    // form refs
    const movementModal = document.getElementById('movementModal');
    const movementModalTitle = document.getElementById('movementModalTitle');
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
    const availableHint = document.getElementById('availableHint');

    // client modal
    const clientModal = document.getElementById('clientModal');
    const clientModalTitle = document.getElementById('clientModalTitle');
    const clientModalBody = document.getElementById('clientModalBody');
    const clientCloseBtn = document.getElementById('clientCloseBtn');

    // confirm modal
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessageEl = document.getElementById('confirmMessage');
    const confirmOkBtn = document.getElementById('confirmOkBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');

    // csv controls
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    const csvFileInput = document.getElementById('csvFileInput');
    const csvStatusText = document.getElementById('csvStatusText');
    const clearCsvBtn = document.getElementById('clearCsvBtn');

    // Estado in-memory
    let clients = [];                 // {id,name,perfil}
    let allFunds = [];                // [{id, clienteId, name}]
    let fondos = [];                  // fondos del cliente seleccionado (para el modal)
    let movements = [];               // [{...}]
    let species = [];                 // [{id,name}]
    let fundNamesById = new Map();    // fondo_id -> cartera_nombre (derivado de movimientos)
    let openModalEl = null;
    let currentModalClientId = '';

    // Utils
    const fmtNumber = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const escapeHtml = (s) => { if (s === 0) return '0'; if (!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); };
    const formatLocalReadable = (dtStr) => { if (!dtStr) return ''; const d = new Date(dtStr); if (isNaN(d)) return dtStr; const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${yyyy}-${mm}-${dd} ${hh}:${mi}`; };

    // Fecha UI (datetime-local) -> ISO
    function normalizeDateForAPI(s) {
      if (!s) return null;
      const d = new Date(s);
      if (!isNaN(d)) return d.toISOString(); // movimiento.fecha_alta (timestamptz)
      return s;
    }

    // Modal helpers
    function showModal(el){ if(!el) return; el.classList.add('active'); el.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; openModalEl = el; }
    function hideModal(el){ if(!el) return; el.classList.remove('active'); el.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; if(openModalEl===el) openModalEl=null; }
    function wireModalClose(modalEl){ if(!modalEl) return; modalEl.addEventListener('click', ev => { if(ev.target===modalEl) hideModal(modalEl); }); modalEl.querySelectorAll('.btn-close, .modal-close, .close-btn').forEach(b => b.addEventListener('click', () => hideModal(modalEl))); }
    document.addEventListener('keydown', e => { if(e.key==='Escape' && openModalEl) hideModal(openModalEl); });

    function showConfirm(message){ 
      return new Promise((resolve, reject)=> { 
      if(!confirmModal) return reject(); 
      if (confirmMessageEl) confirmMessageEl.textContent = message || 'Confirmar acción'; 
      showModal(confirmModal); const onOk=()=>{
        cleanup();
        resolve(true);
      }; 
      const onCancel=()=>{
        cleanup(); reject(false);
      }; 
      const onKey=(e)=>{ if(e.key==='Escape'){ onCancel(); } }; 
      function cleanup(){ 
        confirmOkBtn.removeEventListener('click', onOk); 
        confirmCancelBtn.removeEventListener('click', onCancel); 
        document.removeEventListener('keydown', onKey); 
        hideModal(confirmModal);
      } 
      confirmOkBtn.addEventListener('click', onOk); 
      confirmCancelBtn.addEventListener('click', onCancel); 
      document.addEventListener('keydown', onKey); 
    }); }

    // ===== API =====
    async function apiJSON(url, options) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers||{}) },
        cache: 'no-store',
        ...options,
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data?.error || data?.message || res.statusText || 'API error');
      return data;
    }

    async function fetchClients() {
      const j = await apiJSON('/api/cliente');
      const arr = Array.isArray(j?.data) ? j.data : [];
      return arr.map(c => ({
        id: String(c.id_cliente ?? c.id ?? c.cliente_id ?? ''),
        name: c.nombre ?? c.name ?? '',
        perfil: c.perfil ?? '',
      })).filter(c => c.id && c.name);
    }

    async function fetchAllFunds() {
      try {
        const j = await apiJSON('/api/fondo');
        const arr = Array.isArray(j?.data) ? j.data : [];
        return arr.map(f => ({
          id: String(f.id_fondo ?? f.id ?? f.fondo_id ?? ''),
          clienteId: String(f.cliente_id ?? f.id_cliente ?? ''),
          // Preferir el nombre que venga embebido; si no, reemplazamos con lo visto en movimientos
          name:
            f?.tipo_cartera?.descripcion ??
            f?.tipo_cartera_descripcion ??
            f?.nombre ?? f?.name ?? f?.descripcion ?? `Cartera ${f.id ?? ''}`,
        })).filter(f => f.id);
      } catch {
        // Si no hay endpoint de fondo, lo derivamos de movimientos
        const set = new Map(); // key: id -> {id, clienteId, name}
        movements.forEach(m => {
          if (!m.fondoId) return;
          set.set(m.fondoId, {
            id: m.fondoId,
            clienteId: m.clienteId,
            name: m.fondoName || `Cartera ${m.fondoId}`,
          });
        });
        return Array.from(set.values());
      }
    }

    async function fetchFundsForClient(clienteId) {
      if (!clienteId) return [];
      try {
        const j = await apiJSON(`/api/fondo?cliente_id=${encodeURIComponent(clienteId)}`);
        const arr = Array.isArray(j?.data) ? j.data : [];
        const list = arr.map(f => ({
          id: String(f.id_fondo ?? f.id ?? f.fondo_id ?? ''),
          clienteId: String(clienteId),
          name:
            f?.tipo_cartera?.descripcion ??
            f?.tipo_cartera_descripcion ??
            f?.nombre ?? f?.name ?? f?.descripcion ?? `Cartera ${f.id ?? ''}`,
        })).filter(f => f.id);
        list.forEach(f => {
          const seen = fundNamesById.get(f.id);
          if (seen && (!f.name || /^Cartera\s+\d+$/i.test(f.name))) f.name = seen;
        });
        return list;
      } catch {
        const filtered = allFunds.filter(f => f.clienteId === String(clienteId));
        filtered.forEach(f => {
          const seen = fundNamesById.get(f.id);
          if (seen) f.name = seen;
        });
        return filtered;
      }
    }

    function mapTipoToUI(tipoMov) {
      const t = String(tipoMov || '').toLowerCase();
      if (t.includes('venta')) return 'Egreso';
      return 'Ingreso';
    }
    function mapTipoToAPI(uiTipo) {
      return String(uiTipo || '').toLowerCase() === 'egreso' ? 'venta' : 'compra';
    }

    async function fetchMovements() {
      const j = await apiJSON('/api/movimiento?limit=10000');
      const arr = Array.isArray(j?.data) ? j.data : [];
      const mapped = arr.map(r => {
        const id = String(r.id_movimiento ?? r.id ?? '');
        const clienteId = String(r.cliente_id ?? '');
        const fondoId = String(r.fondo_id ?? '');
        const especieId = r.tipo_especie_id == null ? '' : String(r.tipo_especie_id);
        const fecha = r.fecha_alta ?? r.fecha ?? r.created_at;
        const nominal = Number(r.nominal ?? 0);
        const precioUsd = r.precio_usd == null ? null : Number(r.precio_usd);
        return {
          id,
          fecha: fecha ? new Date(fecha).toISOString().slice(0,16) : new Date().toISOString().slice(0,16),
          clienteId,
          clienteName: r.cliente_nombre ?? '',
          fondoId,
          fondoName: r.cartera_nombre ?? '',
          especieId,
          especieName: r.especie ?? '',
          tipo: mapTipoToUI(r.tipo_mov ?? r.tipo),
          nominal,
          tc: precioUsd ?? 1,
          obs: '',
        };
      }).filter(x => x.id);

      // Derivar catálogos
      fundNamesById = new Map();
      mapped.forEach(m => { if (m.fondoId && m.fondoName) fundNamesById.set(m.fondoId, m.fondoName); });

      const spMap = new Map();
      mapped.forEach(m => {
        if (m.especieId && m.especieName) spMap.set(m.especieId, m.especieName);
      });
      species = Array.from(spMap, ([id,name]) => ({ id, name }));

      return mapped;
    }

    async function createMovement(payload) {
      const body = {
        cliente_id: Number(payload.clienteId),
        fondo_id: Number(payload.fondoId),
        fecha_alta: normalizeDateForAPI(payload.fecha),
        tipo_mov: mapTipoToAPI(payload.tipo),
        nominal: Number(payload.nominal),
        precio_usd: payload.tc != null ? Number(payload.tc) : null,
      };
      if (payload.especieId) body.tipo_especie_id = Number(payload.especieId);
      if (!payload.especieId && payload.especieNombre) body.especie = payload.especieNombre;
      return apiJSON('/api/movimiento', { method: 'POST', body: JSON.stringify(body) });
    }

    async function updateMovement(id, payload) {
      const body = {
        id: Number(id),
        cliente_id: Number(payload.clienteId),
        fondo_id: Number(payload.fondoId),
        fecha_alta: normalizeDateForAPI(payload.fecha),
        tipo_mov: mapTipoToAPI(payload.tipo),
        nominal: Number(payload.nominal),
        precio_usd: payload.tc != null ? Number(payload.tc) : null,
      };
      if (payload.especieId) body.tipo_especie_id = Number(payload.especieId);
      if (!payload.especieId && payload.especieNombre) body.especie = payload.especieNombre;
      // PATCH a /api/movimiento (el handler espera id en el body)
      return apiJSON('/api/movimiento', { method: 'PATCH', body: JSON.stringify(body) });
    }

    async function deleteMovement(id) {
      // DELETE con body { id }
      return apiJSON('/api/movimiento', { method: 'DELETE', body: JSON.stringify({ id: Number(id) }) });
    }

    // ===== Helpers Disponibilidad =====
    function signedNominal(m) {
      return m.tipo === 'Egreso' ? -Number(m.nominal || 0) : Number(m.nominal || 0);
    }

    function getAvailableFor(clienteId, fondoId, especieId, especieNombre) {
      if (!clienteId || !fondoId) return 0;
      const cid = String(clienteId);
      const fid = String(fondoId);
      const sid = especieId ? String(especieId) : null;
      const sname = (especieNombre || '').trim().toLowerCase();
      let sum = 0;
      for (const m of movements) {
        if (String(m.clienteId) !== cid) continue;
        if (String(m.fondoId) !== fid) continue;
        const matchById = sid && m.especieId && String(m.especieId) === sid;
        const matchByName = !sid && sname && (m.especieName || '').trim().toLowerCase() === sname;
        if (!(matchById || matchByName)) continue;
        sum += signedNominal(m);
      }
      return Math.max(0, sum);
    }

    function currentSelection() {
      const clienteId = clienteSelect.value || '';
      const fondoId = fondoSelect.value || '';
      const tipo = tipoSelect.value || '';
      let especieId = especieSelect.value || '';
      let especieNombre = null;
      if (especieId === '__new__') {
        especieNombre = (newEspecieInput.value || '').trim();
        especieId = '';
      }
      return { clienteId, fondoId, tipo, especieId, especieNombre };
    }

    function updateAvailableUI() {
      if (!availableHint) return;
      const { clienteId, fondoId, tipo, especieId, especieNombre } = currentSelection();
      if (String(tipo).toLowerCase() !== 'egreso' || !clienteId || !fondoId || (!especieId && !especieNombre)) {
        availableHint.classList.add('d-none');
        availableHint.textContent = '';
        nominalInput.removeAttribute('max');
        return;
      }
      const available = getAvailableFor(clienteId, fondoId, especieId, especieNombre);
      availableHint.classList.remove('d-none');
      availableHint.textContent = `Disponible para vender: ${Number(available).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      nominalInput.setAttribute('max', String(Math.max(0, available)));
    }

    // ===== Form helpers =====
    function clearFieldError(el){ if(!el) return; el.classList.remove('invalid'); const err = document.getElementById('error-'+el.id); if(err) err.textContent=''; }
    function showFieldError(el,msg){ if(!el) return; el.classList.add('invalid'); const err = document.getElementById('error-'+el.id); if(err) err.textContent=msg; }
    function validateMovementForm(){
      [clienteSelect, fondoSelect, fechaInput, tipoSelect, especieSelect, newEspecieInput, nominalInput, tcInput].forEach(clearFieldError);
      const errors={};
      const clienteId=clienteSelect.value;
      const fondoId=fondoSelect.value;
      const fecha=fechaInput.value;
      const tipo=tipoSelect.value;
      let especieId=especieSelect.value;
      let especieNombre=null;

      if(especieId==='__new__'){
        const n=(newEspecieInput.value||'').trim();
        if(!n) errors.especieSelect='Ingresá el nombre de la nueva especie.';
        else especieNombre=n;
      } else if(!especieId) {
        errors.especieSelect='Seleccioná una especie.';
      }

      const nominalVal=nominalInput.value;
      const nominalNum = Number(nominalVal);

      if(!clienteId) errors.clienteSelect='Seleccioná un cliente.';
      if(!fondoId) errors.fondoSelect='Seleccioná una cartera (obligatorio).';
      if(!fecha) errors.fechaInput='Seleccioná fecha y hora.';
      if(!tipo) errors.tipoSelect='Seleccioná tipo.';
      if(!nominalVal || isNaN(nominalNum) || nominalNum<=0 || !Number.isInteger(nominalNum)) errors.nominalInput='Ingresá un nominal entero (>0).';

      // Validar disponible cuando es Egreso
      if (String(tipo).toLowerCase()==='egreso' && clienteId && fondoId && !errors.especieSelect) {
        const available = getAvailableFor(clienteId, fondoId, especieId==='__new__'? null : especieId, especieNombre);
        if (available <= 0) {
          errors.nominalInput = 'No hay disponibilidad para vender.';
        } else if (nominalNum > available) {
          errors.nominalInput = `No podés vender más de ${available.toLocaleString()}.`;
        }
      }

      if(errors.clienteSelect) showFieldError(clienteSelect, errors.clienteSelect);
      if(errors.fondoSelect) showFieldError(fondoSelect, errors.fondoSelect);
      if(errors.fechaInput) showFieldError(fechaInput, errors.fechaInput);
      if(errors.tipoSelect) showFieldError(tipoSelect, errors.tipoSelect);
      if(errors.especieSelect){
        if(especieSelect.value==='__new__') showFieldError(newEspecieInput, errors.especieSelect);
        else showFieldError(especieSelect, errors.especieSelect);
      }
      if(errors.nominalInput) showFieldError(nominalInput, errors.nominalInput);

      return {
        valid:Object.keys(errors).length===0,
        cleaned:{
          clienteId, fondoId, fecha, tipo,
          especieId: especieId==='__new__' ? null : especieId,
          especieNombre,
          nominal: parseInt(nominalNum, 10),
          tc: (tcInput.value==='' ? null : Number(tcInput.value)),
          obs: obsInput.value||'',
        }
      };
    }

    function populateSpeciesSelect(selectedId){
      especieSelect.innerHTML='';
      species.forEach(sp => especieSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(sp.id)}">${escapeHtml(sp.name)}</option>`));
      especieSelect.insertAdjacentHTML('beforeend', '<option value="__new__">Agregar nueva...</option>');
      if(selectedId){
        const found = species.some(sp => sp.id===String(selectedId));
        if(found){ especieSelect.value=String(selectedId); newEspecieInput.classList.add('d-none'); }
        else { especieSelect.value='__new__'; newEspecieInput.classList.remove('d-none'); newEspecieInput.value=''; }
      } else {
        if (species.length) { especieSelect.selectedIndex=0; newEspecieInput.classList.add('d-none'); newEspecieInput.value=''; }
        else { especieSelect.value='__new__'; newEspecieInput.classList.remove('d-none'); }
      }
      updateAvailableUI(); // actualizar hint al cambiar especies
    }

    function populateFormSelects(selectedSpeciesId){
      // clientes
      clienteSelect.innerHTML='';
      clients.forEach(c => clienteSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`));
      // fondos (por cliente)
      const noFunds = fondos.length === 0;
      fondoSelect.innerHTML = noFunds
        ? '<option value="">(Sin carteras para este cliente)</option>'
        : '<option value="">-- Seleccionar cartera --</option>';
      fondos.forEach(f => fondoSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`));
      fondoSelect.disabled = noFunds;
      // especies
      populateSpeciesSelect(selectedSpeciesId);
    }

    especieSelect.addEventListener('change', () => {
      if(especieSelect.value==='__new__'){
        newEspecieInput.classList.remove('d-none'); newEspecieInput.focus();
      } else {
        newEspecieInput.classList.add('d-none'); newEspecieInput.value=''; clearFieldError(newEspecieInput);
      }
      updateAvailableUI();
    });
    newEspecieInput.addEventListener('input', () => { 
      clearFieldError(newEspecieInput);
      updateAvailableUI();
    });
    tipoSelect.addEventListener('change', updateAvailableUI);
    fondoSelect.addEventListener('change', updateAvailableUI);

    const getClientById = (id) => clients.find(c => String(c.id)===String(id));
    const getFundById = (id) => fondos.find(f => String(f.id)===String(id));

    function groupByClient(movs){
      const map={};
      movs.forEach(m => {
        const cid=String(m.clienteId);
        const clientName=m.clienteName || (getClientById(cid)||{}).name || 'Cliente';
        const fundName=m.fondoName || (m.fondoId ? (getFundById(m.fondoId)||{}).name: '') || 'Sin cartera';
        if(!map[cid]) map[cid]={ clientName, carteras:{} };
        if(!map[cid].carteras[fundName]) map[cid].carteras[fundName]={};
        if(!map[cid].carteras[fundName][m.especieName]) map[cid].carteras[fundName][m.especieName]=0;
        const signed = m.tipo==='Egreso' ? -Number(m.nominal||0) : Number(m.nominal||0);
        map[cid].carteras[fundName][m.especieName]+= signed;
      });
      return map;
    }

    function renderClients(filterQ=''){
      if(!clientsContainer) return;
      clientsContainer.innerHTML='';
      const q=(filterQ||'').trim().toLowerCase();
      const grouped=groupByClient(movements);
      clients.forEach(client => {
        const clientId=String(client.id);
        const aggregated=grouped[clientId];
        let include=!q || client.name.toLowerCase().includes(q);
        if(!include && aggregated){
          for(const fund in aggregated.carteras){
            if(fund.toLowerCase().includes(q)){ include=true; break;}
            for(const sp in aggregated.carteras[fund]){
              if(sp.toLowerCase().includes(q)){ include=true; break;}
            }
            if(include) break;
          }
        }
        if(!include) return;

        const card=document.createElement('article');
        card.className='client-card';
        card.dataset.clientId=clientId;

        const header=document.createElement('div');
        header.className='client-header';
        header.innerHTML=`<div class="client-left"><div class="avatar">${client.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><div><div class="client-title">${escapeHtml(client.name)}</div><div className="client-meta">${escapeHtml(client.perfil||'')}</div></div></div><div class="header-actions"><button class="btn" data-action="add" title="Agregar movimiento"><i class="fas fa-plus"></i></button><button class="btn" data-action="detail" title="Ver detalle"><i class="fas fa-eye"></i></button><button class="btn" data-action="toggle" title="Abrir/Cerrar"><i class="fas fa-chevron-down"></i></button></div>`;
        card.appendChild(header);

        const body=document.createElement('div');
        body.className='client-body';
        if(aggregated){
          for(const fundName of Object.keys(aggregated.carteras)){
            const fundBlock=document.createElement('div');
            fundBlock.className='fund-block';
            fundBlock.innerHTML=`<h4>${escapeHtml(fundName)}</h4>`;
            const ul=document.createElement('ul');
            ul.className='fund-list';
            for(const sp of Object.keys(aggregated.carteras[fundName])){
              const nominal=aggregated.carteras[fundName][sp];
              const li=document.createElement('li');
              li.innerHTML=`<span>${escapeHtml(sp)}</span><strong>${fmtNumber(nominal)}</strong>`;
              ul.appendChild(li);
            }
            fundBlock.appendChild(ul);
            body.appendChild(fundBlock);
          }
        } else {
          body.innerHTML='<div class="hint">Este cliente no tiene movimientos registrados.</div>';
        }
        body.style.display='none';
        card.appendChild(body);

        clientsContainer.appendChild(card);
      });
    }

    function renderLastMovements(){
      if(!lastMovementsTbody) return;
      lastMovementsTbody.innerHTML='';
      const sorted=[...movements].sort((a,b)=> new Date(b.fecha)-new Date(a.fecha)).slice(0, DEFAULT_LAST_N);
      sorted.forEach(m => {
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${formatLocalReadable(m.fecha)}</td><td>${escapeHtml(m.clienteName)}</td><td>${escapeHtml(m.fondoName||'')}</td><td>${escapeHtml(m.especieName)}</td><td>${escapeHtml(m.tipo)}</td><td>${fmtNumber(m.nominal)}</td><td><button class="btn" data-action="edit" data-id="${m.id}" title="Editar"><i class="fas fa-edit"></i></button><button class="btn" data-action="delete" data-id="${m.id}" title="Eliminar"><i class="fas fa-trash"></i></button></td>`;
        lastMovementsTbody.appendChild(tr);
      });
    }

    async function ensureFundsForClient(clientId){
      fondos = await fetchFundsForClient(clientId || '');
      // Forzar nombres reales si hay en movimientos
      fondos = fondos.map(f => {
        const seen = fundNamesById.get(f.id);
        return { ...f, name: seen || f.name };
      });
    }

    async function openNewMovement(clientId){
      if (!clients || clients.length === 0) {
        try { clients = await fetchClients(); } catch { clients = []; }
      }
      const fallbackSelected = (clienteSelect && clienteSelect.value) ? clienteSelect.value : (clients[0]?.id ?? '');
      const selectedId = clientId ?? fallbackSelected;

      currentModalClientId = String(selectedId || ''); // usar el seleccionado real
      movementModalTitle.textContent='Agregar movimiento';
      movementIdInput.value='';

      await ensureFundsForClient(currentModalClientId);
      populateFormSelects();

      if (currentModalClientId) { clienteSelect.value = currentModalClientId; }
      // Limpiar selección de cartera para mostrar placeholder si corresponde
      fondoSelect.value='';

      fechaInput.value=new Date().toISOString().slice(0,16);
      tipoSelect.value='Ingreso';

      if (species.length === 0) {
        especieSelect.value='__new__'; newEspecieInput.classList.remove('d-none');
      } else {
        especieSelect.value=species[0].id; newEspecieInput.classList.add('d-none'); newEspecieInput.value='';
      }

      nominalInput.value='';
      tcInput.value='';
      obsInput.value='';
      updateAvailableUI();
      showModal(movementModal);
    }
    async function openEditMovement(id){
      const m=movements.find(x=> String(x.id)===String(id));
      if(!m) return;
      currentModalClientId = String(m.clienteId || '');
      movementModalTitle.textContent='Editar movimiento';
      movementIdInput.value=m.id;

      await ensureFundsForClient(currentModalClientId);
      populateFormSelects(m.especieId);

      clienteSelect.value=m.clienteId;
      fondoSelect.value=m.fondoId || '';
      fechaInput.value=m.fecha.slice(0,16);
      tipoSelect.value=m.tipo;

      if(m.especieId && species.some(sp => sp.id===m.especieId)){
        especieSelect.value=m.especieId; newEspecieInput.classList.add('d-none'); newEspecieInput.value='';
      } else {
        especieSelect.value='__new__'; newEspecieInput.classList.remove('d-none'); newEspecieInput.value=m.especieName || '';
      }

      nominalInput.value=m.nominal;
      tcInput.value=m.tc ?? '';
      obsInput.value=m.obs||'';
      updateAvailableUI();
      showModal(movementModal);
    }

    // Guardar
    movementSaveBtn.addEventListener('click', async () => {
      const {valid, cleaned} = validateMovementForm();
      if(!valid) return;

      try {
        const payload = {
          clienteId: cleaned.clienteId,
          fondoId: cleaned.fondoId,
          fecha: cleaned.fecha,
          tipo: cleaned.tipo,
          especieId: cleaned.especieId,
          especieNombre: cleaned.especieNombre,
          nominal: cleaned.nominal,
          tc: cleaned.tc,
        };

        if(movementIdInput.value){
          await updateMovement(movementIdInput.value, payload);
        } else {
          await createMovement(payload);
        }

        hideModal(movementModal);

        // Recargar datos
        movements = await fetchMovements();
        allFunds = await fetchAllFunds();

        if (currentModalClientId) {
          fondos = await fetchFundsForClient(currentModalClientId);
        } else {
          fondos = [];
        }

        populateFormSelects();
        renderClients(searchInput.value||'');
        renderLastMovements();
        applyStoredCSVValues();
      } catch (e) {
        console.error(e);
        alert('Error guardando movimiento: ' + (e?.message || e));
      }
    });
    movementCancelBtn.addEventListener('click', () => hideModal(movementModal));

    // Acciones en tarjetas
    clientsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if(!btn) return; const action=btn.dataset.action; const card = btn.closest('.client-card');
      if(action==='toggle'){ const body=card.querySelector('.client-body'); if(body){ body.style.display = body.style.display==='none' ? 'block':'none'; }
      } else if(action==='add'){ openNewMovement(card.dataset.clientId); }
      else if(action==='detail'){ openClientDetail(card.dataset.clientId); }
    });

    function openClientDetail(clientId){
      const c=getClientById(clientId); if(!c) return;
      clientModalTitle.textContent=c.name;
      clientModalBody.innerHTML=`<p><strong>Perfil:</strong> ${escapeHtml(c.perfil||'')}</p>`;
      showModal(clientModal);
    }
    clientCloseBtn.addEventListener('click', () => hideModal(clientModal));

    // Acciones tabla
    lastMovementsTbody.addEventListener('click', async (e) => {
      const btn=e.target.closest('button'); if(!btn) return; const id=btn.dataset.id; const action=btn.dataset.action;
      if(action==='edit'){ openEditMovement(id); }
      else if(action==='delete'){
        try {
          await showConfirm('¿Eliminar movimiento?');
          await deleteMovement(id);
          movements = await fetchMovements();
          allFunds = await fetchAllFunds();
          if (currentModalClientId) {
            fondos = await fetchFundsForClient(currentModalClientId);
          } else {
            fondos = [];
          }
          renderClients(searchInput.value||'');
          renderLastMovements();
          applyStoredCSVValues();
        } catch {}
      }
    });

    // Cambio de cliente en modal => actualizar fondos
    clienteSelect.addEventListener('change', async () => {
      const sel = clienteSelect.value;
      currentModalClientId = String(sel || '');
      await ensureFundsForClient(sel);
      const keepSpeciesId = (especieSelect.value && especieSelect.value !== '__new__') ? especieSelect.value : undefined;
      populateFormSelects(keepSpeciesId);
      clienteSelect.value = sel;
      updateAvailableUI();
    });

    searchInput.addEventListener('input', () => { renderClients(searchInput.value||''); applyStoredCSVValues(); });
    openAddBtn.addEventListener('click', () => openNewMovement());

    wireModalClose(movementModal); wireModalClose(clientModal); wireModalClose(confirmModal);

    // ===== CSV (precios locales opcional) =====
    function normalizeName(s){ if(!s) return ''; return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\.,_\-"'()\/\\]+/g,'').replace(/[^a-z0-9]/g,'').trim(); }
    function parseNumber(s){ if(s===null||s===undefined) return NaN; let t=String(s).trim(); if(t==='') return NaN; t=t.replace(/\u00A0/g,' ').replace(/\$/g,'').replace(/\s/g,''); const hasDot=t.indexOf('.')!==-1; const hasComma=t.indexOf(',')!==-1; if(hasDot && hasComma){ if(t.indexOf('.') < t.indexOf(',')) t=t.replace(/\./g,'').replace(',', '.'); else t=t.replace(/,/g,''); } else if(hasComma && !hasDot){ t=t.replace(',', '.'); } t=t.replace(/[^0-9\.\-]/g,''); const v=parseFloat(t); return isFinite(v)? v: NaN; }

    function applyStoredCSVValues(){ try { const raw=localStorage.getItem(CSV_KEY); if(!raw) return; const map=JSON.parse(raw); if(map) updateValuesFromMapping(map); } catch(e){ console.error(e);} }

    function updateValuesFromMapping(mapping){
      if(!clientsContainer) return;
      const clientCards=clientsContainer.querySelectorAll('.client-card');
      let globalTotal=0;
      clientCards.forEach(card => {
        let clientTotal=0;
        const header=card.querySelector('.client-header .client-left');
        if(header && !header.querySelector('.client-total')){
          const div=document.createElement('div');
          div.className='client-total';
          div.style.marginLeft='12px';
          div.style.fontWeight='600';
          div.textContent='$ 0';
          header.appendChild(div);
        }
        const lis=card.querySelectorAll('.fund-list li');
        lis.forEach(li => {
          const nameEl=li.querySelector('span');
          const nomEl=li.querySelector('strong');
          if(!nameEl||!nomEl) return;
          const displayName=nameEl.textContent.trim();
          const nominalRaw=nomEl.textContent||'0';
          const nominal=parseNumber(nominalRaw);
          const normName=normalizeName(displayName);
          let price=undefined;
          if(mapping[normName]!==undefined) price=mapping[normName];
          if(price===undefined){
            if(normName.endsWith('d')){
              const v=normName.slice(0,-1);
              if(mapping[v]!==undefined) price=mapping[v];
            } else {
              const v=normName+'d';
              if(mapping[v]!==undefined) price=mapping[v];
            }
          }
          if(price===undefined){
            for(const k of Object.keys(mapping)){
              if(k.includes(normName)||normName.includes(k)){ price=mapping[k]; break;}
            }
          }
          if(price===undefined){
            const tokens=displayName.split(/\s+/).map(t=>normalizeName(t)).filter(Boolean);
            for(const tok of tokens){
              if(mapping[tok]!==undefined){ price=mapping[tok]; break;}
              if(!tok.endsWith('d') && mapping[tok+'d']!==undefined){ price=mapping[tok+'d']; break;}
            }
          }
          const value=(isNaN(price)||price===undefined)? NaN: (Number(nominal)*Number(price));
          let valueEl=li.querySelector('.especie-value');
          if(!valueEl){
            valueEl=document.createElement('span');
            valueEl.className='especie-value';
            valueEl.style.marginLeft='8px';
            valueEl.style.fontWeight='600';
            li.appendChild(valueEl);
          }
          if(isNaN(value)){
            valueEl.textContent=' - ';
          } else {
            valueEl.textContent='$ '+Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
            clientTotal+=Number(value);
          }
        });
        const clientTotalEl=card.querySelector('.client-total');
        if(clientTotalEl) clientTotalEl.textContent='$ '+Number(clientTotal).toLocaleString(undefined,{maximumFractionDigits:2});
        globalTotal+=clientTotal;
      });
      if(summaryNominalEl) summaryNominalEl.textContent='$ '+Number(globalTotal).toLocaleString(undefined,{maximumFractionDigits:2});
    }

    if(csvUploadBtn && csvFileInput){
      csvUploadBtn.addEventListener('click', ()=> csvFileInput.click());
      clearCsvBtn.addEventListener('click', ()=> {
        localStorage.removeItem(CSV_KEY);
        if (csvStatusText) csvStatusText.textContent='Precios eliminados'; // guard
        clearCsvBtn.style.display='none';
        applyStoredCSVValues();
      });
      csvFileInput.addEventListener('change', (e)=> {
        const f=e.target.files&&e.target.files[0];
        if(!f) return;
        const reader=new FileReader();
        reader.onload = (ev)=> {
          try {
            const text=ev.target.result;
            const mapping=parseCSVtoMapping(text);
            if(!mapping || Object.keys(mapping).length===0){
              alert('No se pudieron detectar pares especie-precio.');
              return;
            }
            localStorage.setItem(CSV_KEY, JSON.stringify(mapping));
            csvStatusText.textContent=`Precios cargados (${Object.keys(mapping).length}) — ${f.name}`;
            clearCsvBtn.style.display='inline-block';
            updateValuesFromMapping(mapping);
            alert('CSV cargado correctamente.');
          } catch(err){
            console.error(err);
            alert('Error leyendo CSV: '+(err?.message||err));
          } finally {
            csvFileInput.value='';
          }
        };
        reader.readAsText(f,'utf-8');
      });
    }

    function detectDelimiter(text){ const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0).slice(0,8); let comma=0, semi=0, tab=0; lines.forEach(l=> { comma += (l.match(/,/g)||[]).length; semi += (l.match(/;/g)||[]).length; tab += (l.match(/\t/g)||[]).length; }); if(semi>comma && semi>=tab) return ';'; if(tab>comma && tab>=semi) return '\t'; return ','; }
    function splitCsvLine(line, delim){ const res=[]; let cur=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(inQ && i+1<line.length && line[i+1]==='"'){ cur+='"'; i++; } else { inQ=!inQ; } } else if(ch===delim && !inQ){ res.push(cur); cur=''; } else { cur+=ch; } } res.push(cur); return res.map(c=>c.trim()); }
    function parseCSVtoMapping(text){ 
      const delim=detectDelimiter(text); 
      const rawLines=text.split(/\r?\n/); 
      const rows=rawLines.map(l=>splitCsvLine(l,delim)).filter(r=> r.some(c=>c&&c.trim()!==''));
      const mapping={}; function parseNumber2(s){ return parseNumber(s); } function addMappingForRow(row,tickerIdx,priceIdx,pVal){ const rawTicker=(row[tickerIdx]||'').trim(); let rawDesc=''; if(tickerIdx+1<row.length) rawDesc=(row[tickerIdx+1]||'').trim(); const keys=new Set(); if(rawTicker){ keys.add(normalizeName(rawTicker)); keys.add(String(rawTicker).toUpperCase().replace(/[^A-Z0-9]/g,'')); const tno=rawTicker.replace(/[^A-Za-z0-9]/g,''); if(tno.length>1){ if(/[dD]$/.test(tno)) keys.add(normalizeName(tno.slice(0,-1))); else keys.add(normalizeName(tno+'D')); } } if(rawDesc){ keys.add(normalizeName(rawDesc)); const firstTok=rawDesc.split(/\s+/)[0]; if(firstTok) keys.add(normalizeName(firstTok)); } if(rawTicker && rawDesc) keys.add(normalizeName(rawTicker+' '+rawDesc)); const priceNum=Number(pVal); keys.forEach(k=> { if(k && !isNaN(priceNum)) mapping[k]=priceNum; }); }
      function isFooterOrTotalCell(s){ if(!s) return false; const ss=s.toLowerCase(); return ss.includes('total')||ss.includes('subtotal')||ss.includes('total general')||ss.includes('fondo'); }
      for(const row of rows){ if(row.length>=6){ const candTicker=(row[1]||'').trim(); const candPrice=(row[5]||''); const pVal=parseNumber2(candPrice); if(candTicker && !isFooterOrTotalCell(candTicker) && !isNaN(pVal)){ addMappingForRow(row,1,5,pVal); continue; } } let tickerIdx=-1; for(let i=0;i<row.length;i++){ const cell=(row[i]||'').trim(); if(!cell) continue; const token=cell.replace(/[^A-Za-z0-9]/g,''); if(token.length>=2 && token.length<=6 && /[A-Za-z]/.test(token)){ const low=token.toLowerCase(); if(low==='total'||low==='fondo'||low==='dolar') continue; tickerIdx=i; break; } } if(tickerIdx===-1){ for(let i=0;i<row.length;i++){ const cell=(row[i]||'').trim(); if(!cell) continue; const low=cell.toLowerCase(); if(['pesos','usd','u$s','dólar','dolar','%','fondo'].some(k=>low.includes(k))) continue; tickerIdx=i; break; } } if(tickerIdx===-1) continue; let priceIdx=-1; for(let j=tickerIdx+1;j<Math.min(row.length,tickerIdx+7);j++){ const val=parseNumber2(row[j]); if(!isNaN(val)){ priceIdx=j; break; } } if(priceIdx===-1){ for(let j=Math.max(0,tickerIdx-3); j<=tickerIdx; j++){ const val=parseNumber2(row[j]); if(!isNaN(val)){ priceIdx=j; break; } } } if(priceIdx===-1){ for(let j=0;j<row.length;j++){ const val=parseNumber2(row[j]); if(!isNaN(val)){ priceIdx=j; break; } } } if(priceIdx===-1) continue; const pVal=parseNumber2(row[priceIdx]); if(isNaN(pVal)) continue; addMappingForRow(row,tickerIdx,priceIdx,pVal); }
      if(Object.keys(mapping).length===0 && rows.length>0){ for(const r of rows){ if(r.length>=6){ const ticker=(r[1]||'').trim(); const p=parseNumber2(r[5]||''); if(ticker && !isNaN(p)) addMappingForRow(r,1,5,p); } } }
      return mapping; }

    // Observador para aplicar precios luego de render
    const mo = new MutationObserver(() => { applyStoredCSVValues(); });
    if(clientsContainer) mo.observe(clientsContainer,{childList:true,subtree:true});

    // Exponer para debug
    window.__movementsApp = {
      async reload(){
        movements = await fetchMovements();
        allFunds = await fetchAllFunds();
        fondos = allFunds.slice();
        renderClients(searchInput.value||''); renderLastMovements(); applyStoredCSVValues();
      }
    };

    // ===== Carga inicial =====
    (async () => {
      try { clients = await fetchClients(); } catch (e) { console.error('Error clientes', e); clients = []; }

      try { movements = await fetchMovements(); } catch (e) { console.error('Error movimientos', e); movements = []; }

      try {
        allFunds = await fetchAllFunds();
      } catch (e) {
        console.error('Error fondos', e);
        allFunds = [];
      }

      // Inicial: sin cliente en modal => todos los fondos (con nombre real visto)
      fondos = allFunds.map(f => ({ ...f, name: fundNamesById.get(f.id) || f.name }));

      // Render
      // Clientes al select
      clienteSelect.innerHTML='';
      clients.forEach(c => clienteSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`));
      // Especies desde movimientos
      const spSelected = species[0]?.id;
      populateFormSelects(spSelected);
      renderClients();
      renderLastMovements();
      applyStoredCSVValues();
      updateAvailableUI();
    })();

    return () => { mo.disconnect(); };
  }, []);

  return (
    <div className="csv-movimientos-wrapper">
      <header className="page-header">
        <div className="page-left">
          <h1>Movimientos</h1>
        </div>
        <div className="page-right">
          <button id="csvUploadBtn" className="btn secondary" title="Cargar precios CSV"><i className="fas fa-file-csv" /> Cargar precios CSV</button>
          <input id="csvFileInput" type="file" accept=".csv" style={{ display: 'none' }} />
          <div id="csvStatus" className="csv-status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <small id="csvStatusText">No hay precios cargados</small>
            <button id="clearCsvBtn" className="btn" title="Quitar precios cargados" style={{ display: 'none' }}>Limpiar</button>
          </div>
          <input id="searchInput" className="search-input" placeholder="Buscar por cliente, especie o cartera..." />
          <button id="openAddBtn" className="btn primary"><i className="fas fa-plus" /> Agregar Movimiento</button>
        </div>
      </header>
      <main className="content-area">
        <section id="clientsContainer" className="clients-container" aria-live="polite" />
        <section className="last-movements-section">
          <h2>Últimos movimientos</h2>
            <div className="table-wrap">
              <table id="lastMovementsTable" className="table">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Cliente</th><th>Cartera</th><th>Especie</th><th>Tipo</th><th>Nominal</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="lastMovementsTbody" />
              </table>
            </div>
        </section>
      </main>

      {/* Modal Movimiento */}
      <div className="modal" id="movementModal" aria-hidden="true">
        <div className="modal-dialog"><div className="modal-content">
          <div className="modal-header">
            <h3 id="movementModalTitle">Agregar movimiento</h3>
            <button className="modal-close btn-close" aria-label="Cerrar"><i className="fas fa-times" /></button>
          </div>
          <form id="movementForm" className="modal-body" autoComplete="off" noValidate>
            <input type="hidden" id="movementId" />
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="clienteSelect">Cliente <span className="required">*</span></label>
                <select id="clienteSelect" />
                <div className="error-message" id="error-clienteSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="fondoSelect">Cartera <span className="required">*</span></label>
                <select id="fondoSelect" />
                <div className="error-message" id="error-fondoSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="fechaInput">Fecha y hora <span className="required">*</span></label>
                <input id="fechaInput" type="datetime-local" />
                <div className="error-message" id="error-fechaInput" />
              </div>
              <div className="form-group">
                <label htmlFor="tipoSelect">Tipo <span className="required">*</span></label>
                <select id="tipoSelect">
                  <option value="Ingreso">Ingreso</option>
                  <option value="Egreso">Egreso</option>
                </select>
                <div className="error-message" id="error-tipoSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="especieSelect">Especie <span className="required">*</span></label>
                <div className="input-with-side">
                  <select id="especieSelect" />
                  <input id="newEspecieInput" className="d-none" placeholder="Nombre nueva especie..." />
                </div>
                <div className="error-message" id="error-especieSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="nominalInput">Nominal <span className="required">*</span></label>
                <input id="nominalInput" type="number" min="1" step="1" />
                <div className="error-message" id="error-nominalInput" />
                {/* Hint como small debajo del nominal */}
                <small id="availableHint" className="available-hint small d-none" aria-live="polite"></small>
              </div>
              {/* (el div disponible anterior se elimina) */}
              <div className="form-group">
                <label htmlFor="tcInput">Tipo de cambio (precio_usd)</label>
                <input id="tcInput" type="number" min="0" step="any" placeholder="1.00" />
                <div className="error-message" id="error-tcInput" />
              </div>
              <div className="form-group form-span-2">
                <label htmlFor="obsInput">Observaciones (no se guarda)</label>
                <textarea id="obsInput" rows={3} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-save" id="movementSaveBtn">
                <i className="fas fa-check" /> Guardar</button>
              <button type="button" className="btn-close" id="movementCancelBtn">
                <i className="fas fa-times" /> Cancelar</button>
            </div>
          </form>
        </div></div>
      </div>

      {/* Modal Cliente */}
      <div className="modal" id="clientModal" aria-hidden="true">
        <div className="modal-dialog"><div className="modal-content">
          <div className="modal-header"><h3 id="clientModalTitle">Cliente</h3><button className="modal-close btn-close" aria-label="Cerrar"><i className="fas fa-times" /></button></div>
          <div className="modal-body" id="clientModalBody" />
          <div className="modal-footer">
            <button className="btn-close" id="clientCloseBtn">
              <i className="fas fa-times" /> Cerrar</button>
          </div>
        </div></div>
      </div>

      {/* Modal Confirm */}
      <div className="modal" id="confirmModal" aria-hidden="true">
        <div className="modal-dialog"><div className="modal-content">
          <div className="modal-header"><h3 id="confirmTitle">Confirmar</h3></div>
          <div className="modal-body"><p id="confirmMessage">¿Confirmar?</p></div>
          <div className="modal-footer"><button className="btn primary" id="confirmOkBtn">Confirmar</button><button className="btn" id="confirmCancelBtn">Cancelar</button></div>
        </div></div>
      </div>
    </div>
  );
}
