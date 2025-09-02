'use client';

import { useEffect, useRef } from 'react';

/**
 * CSV de precios (tenencias):
 * - Columnas esperadas: Instrumento, Monto total, Cantidad, Moneda (Moneda opcional, se ignora)
 * - Ignora filas de caja (Instrumento = ARS/USD/USDC/USD.C)
 * - Calcula precio ponderado = sum(Monto total) / sum(Cantidad) por Instrumento
 * - Persiste con action upsertPrecios en /api/movimiento
 * - Valorización SIEMPRE desde la base (GET /api/movimiento?action=latestPrecios), sin localStorage
 */
export default function CSVMovimientos() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

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
    const movementSaveBtn = document.getElementById('movementSaveBtn');
    const movementCancelBtn = document.getElementById('movementCancelBtn');
    const availableHint = document.getElementById('availableHint');

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

    // Estado
    let clients = [];
    let allFunds = [];
    let fondos = [];
    let movements = [];
    let species = [];
    let fundNamesById = new Map();
    let openModalEl = null;
    let currentModalClientId = '';
    // Mapa de precios cargado desde la base
    let pricesMap = {};

    // Utils
    const fmtNumber = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const escapeHtml = (s) => { if (s === 0) return '0'; if (!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); };
    const formatLocalReadable = (dtStr) => { if (!dtStr) return ''; const d = new Date(dtStr); if (isNaN(d)) return dtStr; const yyyy=d.getFullYear(); const mm=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${yyyy}-${mm}-${dd} ${hh}:${mi}`; };

    function normalizeDateForAPI(s) {
      if (!s) return null;
      const d = new Date(s);
      if (!isNaN(d)) return d.toISOString();
      return s;
    }

    function showModal(el){ if(!el) return; el.classList.add('active'); el.setAttribute('aria-hidden','false'); document.documentElement.style.overflow='hidden'; openModalEl = el; }
    function hideModal(el){ if(!el) return; el.classList.remove('active'); el.setAttribute('aria-hidden','true'); document.documentElement.style.overflow=''; if(openModalEl===el) openModalEl=null; }
    document.addEventListener('keydown', e => { if(e.key==='Escape' && openModalEl) hideModal(openModalEl); });

    // Cierre correcto: por botón (X) y por click en overlay
    function wireModalClose(modalEl){
      if(!modalEl) return;
      modalEl.querySelectorAll('.modal-close, .btn-close, [data-action="close"]').forEach(btn=>{
        btn.addEventListener('click', (ev)=>{ ev.preventDefault(); hideModal(modalEl); });
      });
      modalEl.addEventListener('mousedown', (ev)=>{
        if(ev.target === modalEl) hideModal(modalEl);
      });
    }
    wireModalClose(movementModal);
    wireModalClose(confirmModal);

    function showConfirm(message){ 
      return new Promise((resolve, reject)=> { 
        if(!confirmModal) return reject(); 
        if (confirmMessageEl) confirmMessageEl.textContent = message || 'Confirmar acción'; 
        showModal(confirmModal);
        const onOk=()=>{ cleanup(); resolve(true); }; 
        const onCancel=()=>{ cleanup(); reject(false); }; 
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
      }); 
    }

    // ===== API =====
    async function apiJSON(url, options) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options?.headers||{}) },
        cache: 'no-store',
        ...options,
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (!res.ok) {
        const errObj = data?.error ?? data;
        const details = (errObj && typeof errObj === 'object')
          ? [errObj.message, errObj.code, errObj.details].filter(Boolean).join(' - ')
          : (typeof errObj === 'string' ? errObj : '');
        const msg = details || res.statusText || 'API error';
        throw new Error(msg);
      }
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
          name:
            f?.tipo_cartera?.descripcion ??
            f?.tipo_cartera_descripcion ??
            f?.nombre ?? f?.name ?? f?.descripcion ?? `Cartera ${f.id ?? ''}`,
        })).filter(f => f.id);
      } catch {
        const set = new Map();
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
        const allFunds = await fetchAllFunds();
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
      return t === 'venta' ? 'Egreso' : 'Ingreso';
    }
    function mapTipoToAPI(uiTipo) {
      const t = String(uiTipo || '').toLowerCase();
      return t === 'egreso' ? 'venta' : 'compra';
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
        };
      }).filter(x => x.id);

      fundNamesById = new Map();
      mapped.forEach(m => { if (m.fondoId && m.fondoName) fundNamesById.set(m.fondoId, m.fondoName); });

      const spMap = new Map();
      mapped.forEach(m => { if (m.aspecieId && m.especieName) spMap.set(m.especieId, m.especieName); });
      // Nota: si el join ya viene, conservamos species por id/nombre de movimientos existentes
      const spMap2 = new Map();
      mapped.forEach(m => { if (m.especieId || m.especieName) spMap2.set(m.especieId || m.especieName, m.especieName || String(m.especieId)); });
      species = Array.from(spMap2, ([id,name]) => ({ id, name }));

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
      return apiJSON('/api/movimiento', { method: 'PATCH', body: JSON.stringify(body) });
    }

    async function deleteMovement(id) {
      return apiJSON('/api/movimiento', { method: 'DELETE', body: JSON.stringify({ id: Number(id) }) });
    }

    function signedNominal(m) { return m.tipo === 'Egreso' ? -Number(m.nominal || 0) : Number(m.nominal || 0); }

    // Helpers (una sola definición)
    const getClientById = (id) => clients.find(c => String(c.id)===String(id));
    const getFundById = (id) => allFunds.find(f => String(f.id)===String(id));

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

      if (String(tipo).toLowerCase()==='egreso' && clienteId && fondoId && !errors.especieSelect) {
        const available = getAvailableFor(clienteId, fondoId, especieId==='__new__'? null : especieId, especieNombre);
        if (available <= 0) {
          errors.nominalInput = 'No hay disponibilidad para vender.';
        } else if (nominalNum > available) {
          errors.nominalInput = `No podés vender más de ${available.toLocaleString()}.`;
        }
      }

      if (errors.clienteSelect) showFieldError(clienteSelect, errors.clienteSelect);
      if (errors.fondoSelect) showFieldError(fondoSelect, errors.fondoSelect);
      if (errors.fechaInput) showFieldError(fechaInput, errors.fechaInput);
      if (errors.tipoSelect) showFieldError(tipoSelect, errors.tipoSelect);
      if (errors.especieSelect){
        if (especieSelect.value==='__new__') showFieldError(newEspecieInput, errors.especieSelect);
        else showFieldError(especieSelect, errors.especieSelect);
      }
      if (errors.nominalInput) showFieldError(nominalInput, errors.nominalInput);

      return {
        valid:Object.keys(errors).length===0,
        cleaned:{
          clienteId, fondoId, fecha, tipo,
          especieId: especieId==='__new__' ? null : especieId,
          especieNombre,
          nominal: parseInt(nominalNum, 10),
          tc: (tcInput.value==='' ? null : Number(tcInput.value)),
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
      updateAvailableUI();
    }

    function populateFormSelects(selectedSpeciesId){
      clienteSelect.innerHTML='';
      clients.forEach(c => clienteSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`));
      const noFunds = fondos.length === 0;
      fondoSelect.innerHTML = noFunds
        ? '<option value="">(Sin carteras para este cliente)</option>'
        : '<option value="">-- Seleccionar cartera --</option>';
      fondos.forEach(f => fondoSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`));
      fondoSelect.disabled = noFunds;
      populateSpeciesSelect(selectedSpeciesId);
    }
    
    function refreshFondoSelect() {
      const noFunds = fondos.length === 0;
      fondoSelect.innerHTML = noFunds
        ? '<option value="">(Sin carteras para este cliente)</option>'
        : '<option value="">-- Seleccionar cartera --</option>';
      fondos.forEach(f => fondoSelect.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`));
      fondoSelect.disabled = noFunds;
    }

    especieSelect.addEventListener('change', () => {
      if(especieSelect.value==='__new__'){
        newEspecieInput.classList.remove('d-none'); newEspecieInput.focus();
      } else {
        newEspecieInput.classList.add('d-none'); newEspecieInput.value='';
      }
      updateAvailableUI();
    });
    newEspecieInput.addEventListener('input', updateAvailableUI);
    tipoSelect.addEventListener('change', updateAvailableUI);
    fondoSelect.addEventListener('change', updateAvailableUI);

    // Al cambiar de cliente en el modal, cargar sus carteras
    clienteSelect.addEventListener('change', async () => {
      await ensureFundsForClient(clienteSelect.value || '');
      refreshFondoSelect();
      updateAvailableUI();
    });

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
        header.innerHTML=`<div class="client-left"><div class="avatar">${client.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><div><div class="client-title">${escapeHtml(client.name)}</div><div class="client-meta">${escapeHtml(client.perfil||'')}</div></div></div><div class="header-actions"><button class="btn" data-action="add" title="Agregar movimiento"><i class="fas fa-plus"></i></button><button class="btn" data-action="toggle" title="Abrir/Cerrar"><i class="fas fa-chevron-down"></i></button></div>`;
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
              const li = document.createElement('li');
              li.innerHTML = `
                <span class="especie-name">${escapeHtml(sp)}</span>
                <strong class="especie-qty">${fmtNumber(nominal)}</strong>
                <span class="especie-value"> - </span>
              `;
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
      fondos = fondos.map(f => ({ ...f, name: fundNamesById.get(f.id) || f.name }));
    }

    async function openNewMovement(clientId){
      if (!clients || clients.length === 0) {
        try { clients = await fetchClients(); } catch { clients = []; }
      }
      const fallbackSelected = (clienteSelect && clienteSelect.value) ? clienteSelect.value : (clients[0]?.id ?? '');
      const selectedId = clientId ?? fallbackSelected;

      currentModalClientId = String(selectedId || '');
      movementModalTitle.textContent='Agregar movimiento';
      movementIdInput.value='';

      await ensureFundsForClient(currentModalClientId);
      populateFormSelects();

      if (currentModalClientId) { clienteSelect.value = currentModalClientId; }
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
      updateAvailableUI();
      showModal(movementModal);
    }

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

        // Recargar datos y mantener nombres
        movements = await fetchMovements();
        allFunds = await fetchAllFunds();
        allFunds = allFunds.map(f => ({ ...f, name: fundNamesById.get(f.id) || f.name }));

        currentModalClientId = cleaned.clienteId || currentModalClientId || '';
        fondos = await fetchFundsForClient(currentModalClientId);

        renderClients(searchInput.value||'');
        renderLastMovements();
        // Reaplicar con precios ya cargados en memoria
        updateValuesFromMapping(pricesMap);
      } catch (e) {
        console.error(e);
        alert('Error guardando movimiento: ' + (e?.message || e));
      }
    });
    movementCancelBtn.addEventListener('click', () => hideModal(movementModal));

    searchInput?.addEventListener('input', () => { 
      renderClients(searchInput.value||''); 
      updateValuesFromMapping(pricesMap);
    });
    openAddBtn?.addEventListener('click', () => openNewMovement());
    clientsContainer?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const card = btn.closest('.client-card');
      if (!card) return;
      const action = btn.dataset.action;
      if (action === 'toggle') {
        const body = card.querySelector('.client-body');
        if (body) {
          const hidden = body.style.display === 'none' || getComputedStyle(body).display === 'none';
          body.style.display = hidden ? 'block' : 'none';
          if (!hidden) updateValuesFromMapping(pricesMap);
        }
      } else if (action === 'add') {
        const clientId = card.dataset.clientId || '';
        openNewMovement(clientId);
      }
    });
    
    lastMovementsTbody?.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!id) return;
      if (action === 'edit') {
        openEditMovement(id);
        return;
      }
      if (action === 'delete') {
        try {
          await showConfirm('¿Eliminar este movimiento?');
          await deleteMovement(id);
          movements = await fetchMovements();
          renderClients(searchInput?.value || '');
          renderLastMovements();
          updateValuesFromMapping(pricesMap);
        } catch (err) {
          if (err && err !== false) {
            console.error(err);
            alert('Error eliminando movimiento: ' + (err.message || err));
          }
        }
      }
    });    
    
    // ===== CSV =====
    function normalizeName(s){ if(!s) return ''; return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\.,_\-"'()\/\\]+/g,'').replace(/[^a-z0-9]/g,'').trim(); }
    function parseNumber(s){ if(s===null||s===undefined) return NaN; let t=String(s).trim(); if(t==='') return NaN; t=t.replace(/\u00A0/g,' ').replace(/\$/g,'').replace(/\s/g,''); const hasDot=t.indexOf('.')!==-1; const hasComma=t.indexOf(',')!==-1; if(hasDot && hasComma){ if(t.indexOf('.') < t.indexOf(',')) t=t.replace(/\./g,'').replace(',', '.'); else t=t.replace(/,/g,''); } else if(hasComma && !hasDot){ t=t.replace(',', '.'); } t=t.replace(/[^0-9\.\-]/g,''); const v=parseFloat(t); return isFinite(v)? v: NaN; }
    function detectDelimiter(text){ const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0).slice(0,8); let comma=0, semi=0, tab=0; lines.forEach(l=> { comma += (l.match(/,/g)||[]).length; semi += (l.match(/;/g)||[]).length; tab += (l.match(/\t/g)||[]).length; }); if(semi>comma && semi>=tab) return ';'; if(tab>comma && tab>=semi) return '\t'; return ','; }
    function splitCsvLine(line, delim){ const res=[]; let cur=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(ch==='"'){ if(inQ && i+1<line.length && line[i+1]==='"'){ cur+='"'; i++; } else { inQ=!inQ; } } else if(ch===delim && !inQ){ res.push(cur); cur=''; } else { cur+=ch; } } res.push(cur); return res.map(c=>c.trim()); }

    function parseLocaleInteger(s){
      if (s == null) return 0;
      const str = String(s);
      const sign = str.trim().startsWith('-') ? -1 : 1;
      const digits = str.replace(/[^\d]/g, ''); // quita , . espacios, NBSP, etc.
      if (!digits) return 0;
      const n = parseInt(digits, 10);
      return Number.isFinite(n) ? sign * n : 0;
    }

    function extractDateFromFilename(name) {
      if (!name) return new Date().toISOString().slice(0, 10);
      const m = name.match(/(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1];
      const m2 = name.match(/(\d{4}-\d{2}-\d{2})T/);
      if (m2) return m2[1];
      return new Date().toISOString().slice(0, 10);
    }

    // Cabeceras: Instrumento, Monto total, Cantidad[, Moneda]
    function parseTenenciasCSV(text){
      const delim=detectDelimiter(text);
      const rawLines=text.split(/\r?\n/).filter(l=>l.trim().length>0);
      if(rawLines.length===0) return [];
      const header=splitCsvLine(rawLines[0],delim).map(h=>h.trim().toLowerCase());

      const colInst = header.findIndex(h => h.includes('instrumento'));
      const colMonto = header.findIndex(h => h.includes('monto'));
      const colCant = header.findIndex(h => h.includes('cant'));
      const colMoneda = header.findIndex(h => h.includes('moneda')); // opcional

      if(colInst===-1 || colMonto===-1 || colCant===-1){
        throw new Error('Cabecera CSV inválida. Se espera: Instrumento, Monto total, Cantidad[, Moneda]');
      }

      const rows=[];
      for(let i=1;i<rawLines.length;i++){
        const cols=splitCsvLine(rawLines[i],delim);
        if(cols.length<=Math.max(colInst,colMonto,colCant)) continue;
        const instrumento=(cols[colInst]||'').trim();
        const monto=parseNumber(cols[colMonto]);
        const cantidad=parseNumber(cols[colCant]);
        const moneda = colMoneda===-1 ? '' : (cols[colMoneda]||'').trim().toUpperCase();
        if(!instrumento) continue;
        if(!isFinite(monto) || !isFinite(cantidad)) continue;
        rows.push({ instrumento, monto, cantidad, moneda });
      }
      return rows;
    }

    function aggregatePrices(rows){
      const byKey = new Map(); // key: instrumento
      const isCash = (inst) => ['ARS','USD','USDC','USD.C'].includes(String(inst).toUpperCase());
      for(const r of rows){
        const inst = String(r.instrumento||'').trim();
        if(!inst || isCash(inst)) continue;
        const qty = Number(r.cantidad)||0;
        const amt = Number(r.monto)||0;
        if(qty <= 0 || !isFinite(qty) || !isFinite(amt)) continue;
        const key = inst;
        const prev = byKey.get(key) || { totalMonto:0, totalCantidad:0 };
        prev.totalMonto += amt;
        prev.totalCantidad += qty;
        byKey.set(key, prev);
      }
      const items=[];
      for(const [instrumento,val] of byKey){
        if(val.totalCantidad<=0) continue;
        items.push({ instrumento, precio: val.totalMonto/val.totalCantidad });
      }
      return items.sort((a,b)=> a.instrumento.localeCompare(b.instrumento,'es'));
    }

    // Sanitiza items antes de enviar (precio > 0 y finito)
    function sanitizeItems(items){
      const cleaned = [];
      let dropped = 0;
      for(const it of items){
        const nombre = (it.instrumento||'').trim();
        const precio = Number(it.precio);
        if(!nombre || !Number.isFinite(precio) || precio <= 0){ dropped++; continue; }
        cleaned.push({ instrumento: nombre, precio });
      }
      return { cleaned, dropped };
    }

    // ===== Valorización desde DB =====
    const normalizeSimple = (s) => (s||'').toString().trim().toLowerCase().replace(/\s+/g,'').replace(/[^\w]/g,'');

    async function fetchServerPricesMapping(){
      try {
        const j = await apiJSON('/api/movimiento?action=latestPrecios');
        const arr = Array.isArray(j?.data) ? j.data : [];
        const map = {};
        for (const r of arr) {
          const name = (r?.nombre || '').trim();
          const price = Number(r?.precio);
          if (!name || !Number.isFinite(price) || price <= 0) continue;
          const k = normalizeSimple(name);
          map[k] = price;
          if (k && !k.endsWith('d')) map[`${k}d`] = price; // alias si aplica (AL30 -> AL30D)
        }
        return map;
      } catch (e) {
        console.error('Error obteniendo precios del servidor', e);
        return {};
      }
    }

    async function loadPricesFromDB(){
      try {
        if (csvStatusText) csvStatusText.textContent = 'Cargando precios desde la base...';
        pricesMap = await fetchServerPricesMapping();
        updateValuesFromMapping(pricesMap);
        if (csvStatusText) csvStatusText.textContent = 'Precios (DB) aplicados — ' + new Date().toLocaleString();
        if (clearCsvBtn) clearCsvBtn.style.display = 'none'; // no se usa más
      } catch (e) {
        if (csvStatusText) csvStatusText.textContent = 'No se pudieron cargar precios';
      }
    }

    function updateValuesFromMapping(mapping){
      if(!clientsContainer) return;
      const clientCards = clientsContainer.querySelectorAll('.client-card');
      let globalTotal = 0;

      clientCards.forEach(card => {
        let clientTotal = 0;

        // total por cliente en el header
        const header = card.querySelector('.client-header .client-left');
        if (header && !header.querySelector('.client-total')) {
          const div = document.createElement('div');
          div.className = 'client-total';
          div.textContent = '$ 0';
          header.appendChild(div);
        }

        // Soportar ambas estructuras: tabla (.fund-table) o lista (.fund-list)
        const rows = card.querySelectorAll('.fund-table tbody tr, .fund-list li');

        rows.forEach(row => {
          const isTr = row.tagName === 'TR';
          const nameEl = row.querySelector('.especie-name') || row.querySelector('span');
          const qtyEl  = row.querySelector('.especie-qty')  || row.querySelector('strong');
          let valueEl  = row.querySelector('.especie-value');

          if(!nameEl || !qtyEl) return;

          const displayName = (nameEl.textContent || '').trim();
          const nominal = parseLocaleInteger(qtyEl.textContent || '0');
          const normName = normalizeSimple(displayName);

          const price = mapping[normName] ?? mapping[displayName] ?? undefined;

          if (!valueEl) {
            if (isTr) {
              valueEl = document.createElement('td');
              valueEl.className = 'especie-value num';
              row.appendChild(valueEl);
            } else {
              valueEl = document.createElement('span');
              valueEl.className = 'especie-value';
              row.appendChild(valueEl);
            }
          }

          const value = (isNaN(price) || price === undefined)
            ? NaN
            : Number(nominal) * Number(price);

          if (isNaN(value)) {
            valueEl.textContent = ' - ';
          } else {
            valueEl.textContent = '$ ' + Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
            clientTotal += Number(value);
          }
        });

        const clientTotalEl = card.querySelector('.client-total');
        if (clientTotalEl) {
          clientTotalEl.textContent = '$ ' + Number(clientTotal).toLocaleString(undefined, { maximumFractionDigits: 2 });
        }
        globalTotal += clientTotal;
      });

      if (summaryNominalEl) {
        summaryNominalEl.textContent = '$ ' + Number(globalTotal).toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
    }

    // Reaplicar valores si cambia el DOM del contenedor (sin golpear la API)
    const mo = new MutationObserver(() => { updateValuesFromMapping(pricesMap); });
    if(clientsContainer) mo.observe(clientsContainer,{childList:true,subtree:true});

    window.__movementsApp = {
      async reload(){
        movements = await fetchMovements();
        allFunds = await fetchAllFunds();
        fondos = allFunds.slice();
        renderClients(searchInput?.value||''); 
        renderLastMovements(); 
        updateValuesFromMapping(pricesMap);
      }
    };

    (async () => {
      try { clients = await fetchClients(); } catch (e) { console.error('Error clientes', e); clients = []; }
      try { movements = await fetchMovements(); } catch (e) { console.error('Error movimientos', e); movements = []; }
      try { allFunds = await fetchAllFunds(); } catch (e) { console.error('Error fondos', e); allFunds = []; }

      allFunds = allFunds.map(f => ({ ...f, name: fundNamesById.get(f.id) || f.name }));
      fondos = allFunds.slice();

      clienteSelect && (clienteSelect.innerHTML='');
      clients.forEach(c => clienteSelect?.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`));
      const spSelected = species[0]?.id;
      populateFormSelects(spSelected);
      renderClients();
      renderLastMovements();
      updateAvailableUI();

      await loadPricesFromDB();
    })();

    if(csvUploadBtn && csvFileInput){
      csvUploadBtn.addEventListener('click', ()=> csvFileInput.click());
      // Clear no se usa más para precios
      if (clearCsvBtn) clearCsvBtn.style.display = 'none';

      csvFileInput.addEventListener('change', async (e)=> {
        const f=e.target.files&&e.target.files[0];
        if(!f) return;
        try {
          if (csvStatusText) csvStatusText.textContent = 'Procesando CSV...';
          const text = await f.text();
          const rawRows = parseTenenciasCSV(text);
          const items = aggregatePrices(rawRows); // [{instrumento, precio}]
          const { cleaned, dropped } = sanitizeItems(items);

          if(cleaned.length===0){
            alert('No se detectaron precios válidos en el CSV (precios deben ser > 0).');
            if (csvStatusText) csvStatusText.textContent = 'Sin precios válidos';
            return;
          }
          const fecha = extractDateFromFilename(f.name);

          await apiJSON('/api/movimiento', {
            method: 'POST',
            body: JSON.stringify({
              action: 'upsertPrecios',
              fecha,
              fuente: 'inviu_csv',
              items: cleaned, // solo válidos
            }),
          });

          if (csvStatusText) {
            const msg = `Precios guardados en DB (${cleaned.length}${dropped?`, descartados: ${dropped}`:''}) — ${fecha}`;
            csvStatusText.textContent = msg;
          }
          await loadPricesFromDB(); // vuelve a leer de DB y aplica
          alert('Precios guardados y aplicados desde la base.');
        } catch(err){
          console.error(err);
          alert('Error procesando/guardando el CSV: '+(err?.message||err));
          if (csvStatusText) csvStatusText.textContent = 'Error al guardar precios';
        } finally {
          csvFileInput.value='';
        }
      });
    }

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
            <small id="csvStatusText">Cargando precios desde la base...</small>
            <button id="clearCsvBtn" className="btn" title="Quitar precios cargados" style={{ display: 'none' }}>Limpiar</button>
          </div>
          <input id="searchInput" className="search-input" placeholder="Buscar por cliente, especie o cartera..." />
          <button id="openAddBtn" className="btn primary"><i className="fas fa-plus" /> Agregar Movimiento</button>
        </div>
      </header>

      <main className="content-area">
        <section id="clientsContainer" className="clients-container" aria-live="polite"></section>
        <section className="last-movements-section">
          <h2>Últimos movimientos</h2>
            <div className="table-wrap">
              <table id="lastMovementsTable" className="table">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Cliente</th><th>Cartera</th><th>Especie</th><th>Tipo</th><th>Nominal</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody id="lastMovementsTbody"></tbody>
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
                <select id="clienteSelect"></select>
                <div className="error-message" id="error-clienteSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="fondoSelect">Cartera <span className="required">*</span></label>
                <select id="fondoSelect"></select>
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
                  <select id="especieSelect"></select>
                  <input id="newEspecieInput" className="d-none" placeholder="Nombre nueva especie..." />
                </div>
                <div className="error-message" id="error-especieSelect" />
              </div>
              <div className="form-group">
                <label htmlFor="nominalInput">Nominal <span className="required">*</span></label>
                <input id="nominalInput" type="number" min="1" step="1" />
                <div className="error-message" id="error-nominalInput" />
                <small id="availableHint" className="available-hint small d-none" aria-live="polite"></small>
              </div>
              <div className="form-group">
                <label htmlFor="tcInput">Tipo de cambio (precio_usd)</label>
                <input id="tcInput" type="number" min="0" step="any" placeholder="1.00" />
                <div className="error-message" id="error-tcInput" />
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

      {/* Modal Confirm */}
      <div className="modal" id="confirmModal" aria-hidden="true">
        <div className="modal-dialog"><div className="modal-content">
          <div className="modal-header"><h3 id="confirmTitle">Confirmar</h3></div>
          <div className="modal-body"><p id="confirmMessage">¿Confirmar?</p></div>
          <div className="modal-footer"><button className="btn primary" id="confirmOkBtn">Confirmar</button><button className="btn" id="confirmCancelBtn">Cancelar</button></div>
          </div></div>
      </div>

      <style jsx global>{`
        /* Soporte tabla (si la usás en el futuro) */
        .fund-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .fund-table col.col-name { width: auto; }
        .fund-table col.col-qty { width: 12ch; }
        .fund-table col.col-value { width: 14ch; }
        .fund-table td { padding: 8px 12px; vertical-align: middle; }
        .fund-table .especie-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fund-table .num { text-align: right; white-space: nowrap; font-weight: 600; font-variant-numeric: tabular-nums; }

        /* Estilo de la lista actual (UL/LI) con columnas fijas y sin recortes */
        .fund-list { list-style: none; margin: 0; padding: 0; width: 100%; }
        .fund-list li {
          display: grid;
          grid-template-columns: minmax(0, 1fr) max-content max-content; /* nombre | qty | valor */
          column-gap: 12px;
          align-items: center;
          padding: 8px 12px;
          border-radius: 8px;
        }
        .fund-list li .especie-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fund-list li .especie-qty,
        .fund-list li .especie-value {
          justify-self: end;
          text-align: right;
          white-space: nowrap;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        /* Evitar que el total del header se achique o se recorte */
        .client-header .client-total {
          white-space: nowrap;
          flex: 0 0 auto;
        }
      `}</style>
    </div>
  );
}