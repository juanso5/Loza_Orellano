(function(){
  // ---------- Utils ----------
  const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
  const percentFmt = (n) => `${Number(n || 0).toFixed(2)}%`;
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const today = new Date();
  const toYMD = (d) => {
    if (!d) return '';
    const base = d instanceof Date ? d : new Date(d);
    const tzOff = base.getTimezoneOffset();
    const dLocal = new Date(base.getTime() - tzOff * 60000);
    return dLocal.toISOString().slice(0,10);
  };
  const parseDate = (str) => {
    if (!str) return new Date(NaN);
    const [y,m,dd] = str.split('-').map(Number);
    return new Date(y, m-1, dd);
  };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addMonths = (date, m) => {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setMonth(d.getMonth() + m);
    if (d.getDate() < day) d.setDate(0);
    return d;
  };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---------- Storage ----------
  const LS_PLANS = 'cobros_plans_v2';
  const LS_CHARGES = 'cobros_charges_v2';
  const storage = {
    getPlans() { return JSON.parse(localStorage.getItem(LS_PLANS) || '[]'); },
    setPlans(plans) { localStorage.setItem(LS_PLANS, JSON.stringify(plans)); },
    getCharges() { return JSON.parse(localStorage.getItem(LS_CHARGES) || '[]'); },
    setCharges(charges) { localStorage.setItem(LS_CHARGES, JSON.stringify(charges)); }
  };

  // ---------- Modelo ----------
  function periodToCuotasPerYear(plan){
    switch(plan.periodo){
      case 'mensual': return 12;
      case 'trimestral': return 4;
      case 'semestral': return 2;
      case 'anual': return 1;
      case 'personalizado': return Math.max(1, Number(plan.cuotasAnio || 1));
      default: return 12;
    }
  }
  function periodToMonthStep(plan){
    const cpy = periodToCuotasPerYear(plan);
    const step = 12 / cpy;
    if ([1,2,3,4,6,12].includes(cpy)) return Math.round(step);
    return Math.max(1, Math.round(step));
  }
  function cuotaCartera(plan, cartera){
    const arancel = Number(cartera.arancelPct ?? plan.arancelPct) / 100;
    const base = Number(cartera.baseMonto || 0);
    const cuotasAnio = periodToCuotasPerYear(plan);
    const monto = base * arancel / cuotasAnio;
    return round2(monto);
  }
  function cuotaPlanTotal(plan){
    return round2((plan.carteras || []).reduce((acc, c) => acc + cuotaCartera(plan, c), 0));
  }
  function generateChargesForPlan(plan, horizonMonths = 12){
    const charges = [];
    const step = periodToMonthStep(plan);
    const start = startOfDay(parseDate(plan.fechaInicio));
    const end = addMonths(startOfDay(today), horizonMonths);
    let current = new Date(start.getTime());
    const monto = cuotaPlanTotal(plan);
    let i = 0;
    while (current <= end){
      charges.push({
        id: uid(),
        planId: plan.id,
        fecha: toYMD(current),
        montoProgramado: monto,
        estado: estadoForDate(current),
      });
      current = addMonths(current, step);
      if (++i > 60) break;
    }
    return charges;
  }
  function estadoForDate(dateObj){
    const d = startOfDay(dateObj);
    const now = startOfDay(today);
    return d < now ? 'vencido' : 'pendiente';
  }
  function nextChargeForPlan(charges, planId){
    const list = charges
      .filter(c => c.planId === planId && c.estado !== 'pagado')
      .map(c => ({...c, _date: parseDate(c.fecha)}))
      .sort((a,b) => a._date - b._date);
    return list[0] || null;
  }

  // ---------- Estado UI ----------
  const state = {
    editingPlanId: null,
    editingPlanSnapshot: null,
    payingCharge: null
  };

  // ---------- Elementos ----------
  const el = {
    // Caja de "Próximos cobros por cliente" (independiente de filtros de abajo)
    rangeClientesProximos: qs('#rangeClientesProximos'),
    tableClientesCobro: qs('#tableClientesCobro tbody'),
    clientesTotalCobro: qs('#clientesTotalCobro'),

    // Filters (para otras secciones)
    filterAsesor: qs('#filterAsesor'),
    filterCliente: qs('#filterCliente'),
    filterPeriodo: qs('#filterPeriodo'),
    filterEstado: qs('#filterEstado'),
    btnClearFilters: qs('#btnClearFilters'),
    rangeCuotas: qs('#rangeCuotas'),

    // Resumen por cartera
    tableResumenBody: qs('#tableResumenCarteras tbody'),
    grandTotalResumen: qs('#grandTotalResumen'),

    // Planes
    btnAddPlan: qs('#btnAddPlan'),
    tablePlanesBody: qs('#tablePlanes tbody'),

    // Cuotas
    tableCuotasBody: qs('#tableCuotas tbody'),

    // Modales
    modalPlan: qs('#modalPlan'),
    modalPlanTitle: qs('#modalPlanTitle'),
    inpCliente: qs('#inpCliente'),
    inpAsesor: qs('#inpAsesor'),
    inpArancel: qs('#inpArancel'),
    inpPeriodo: qs('#inpPeriodo'),
    cellCuotasAnio: qs('#cellCuotasAnio'),
    inpCuotasAnio: qs('#inpCuotasAnio'),
    inpInicio: qs('#inpInicio'),
    inpNotas: qs('#inpNotas'),
    btnAddCartera: qs('#btnAddCartera'),
    carterasBody: qs('#carterasBody'),
    btnSavePlan: qs('#btnSavePlan'),
    modalCronograma: qs('#modalCronograma'),
    cronogramaHeader: qs('#cronogramaHeader'),
    cronogramaBody: qs('#cronogramaBody'),
    modalPago: qs('#modalPago'),
    inpFechaPago: qs('#inpFechaPago'),
    inpMontoPago: qs('#inpMontoPago'),
    inpObsPago: qs('#inpObsPago'),
    btnConfirmPago: qs('#btnConfirmPago'),
  };

  // ---------- Inicialización ----------
  function ensureSeed(){
    if (storage.getPlans().length > 0) return;
    const plan1 = {
      id: uid(),
      cliente: 'Cliente Demo S.A.',
      asesor: 'Asesor Córdoba',
      arancelPct: 2.5,
      periodo: 'mensual',
      fechaInicio: toYMD(new Date(today.getFullYear(), today.getMonth(), 5)),
      notas: 'Plan mensual con carteras',
      carteras: [
        { id: uid(), nombre: 'Cartera Conservadora', baseMonto: 8000000 },
        { id: uid(), nombre: 'Cartera Moderada', baseMonto: 7000000, arancelPct: 3.0 }
      ],
      createdAt: Date.now()
    };
    const plan2 = {
      id: uid(),
      cliente: 'García, María',
      asesor: 'Estudio Centro',
      arancelPct: 3.2,
      periodo: 'trimestral',
      fechaInicio: toYMD(new Date(today.getFullYear(), 0, 15)),
      notas: 'Plan trimestral',
      carteras: [
        { id: uid(), nombre: 'Cartera Acciones', baseMonto: 5000000 },
        { id: uid(), nombre: 'Cartera Bonos', baseMonto: 3500000 }
      ],
      createdAt: Date.now()
    };
    storage.setPlans([plan1, plan2]);
    let allCharges = [];
    [plan1, plan2].forEach(p => { allCharges = allCharges.concat(generateChargesForPlan(p, 12)); });
    storage.setCharges(allCharges);
  }

  function init(){
    ensureSeed();
    bindEvents();
    refreshUI();
  }

  // ---------- Eventos ----------
  function bindEvents(){
    el.btnAddPlan?.addEventListener('click', () => openPlanModal());

    el.inpPeriodo?.addEventListener('change', onPeriodoChange);
    el.btnAddCartera?.addEventListener('click', addCarteraRow);
    qsa('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => closeModal(e.currentTarget.getAttribute('data-close')));
    });
    el.btnSavePlan?.addEventListener('click', savePlan);

    // Select independiente para la caja de "Próximos cobros por cliente"
    el.rangeClientesProximos?.addEventListener('change', refreshClientesCobro);

    // Filtros globales (no afectan la caja superior)
    el.filterAsesor?.addEventListener('input', debounce(refreshAll, 200));
    el.filterCliente?.addEventListener('input', debounce(refreshAll, 200));
    el.filterPeriodo?.addEventListener('change', refreshAll);
    el.filterEstado?.addEventListener('change', refreshAll);
    el.btnClearFilters?.addEventListener('click', () => {
      el.filterAsesor.value = '';
      el.filterCliente.value = '';
      el.filterPeriodo.value = '';
      el.filterEstado.value = '';
      refreshAll();
    });

    el.rangeCuotas?.addEventListener('change', refreshCuotasTable);
    el.btnConfirmPago?.addEventListener('click', confirmPago);

    [el.modalPlan, el.modalCronograma, el.modalPago].forEach(m => {
      m?.addEventListener('mousedown', (ev) => { if (ev.target === m) closeModal('#' + m.id); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (el.modalPago?.getAttribute('aria-hidden') === 'false') return closeModal('#modalPago');
        if (el.modalCronograma?.getAttribute('aria-hidden') === 'false') return closeModal('#modalCronograma');
        if (el.modalPlan?.getAttribute('aria-hidden') === 'false') return closeModal('#modalPlan');
      }
    });
  }

  function onPeriodoChange(){
    const isPers = el.inpPeriodo.value === 'personalizado';
    el.cellCuotasAnio.style.display = isPers ? '' : 'none';
  }

  // ---------- UI Refresh ----------
  function refreshAll(){
    refreshClientesCobro();     // independiente de filtros
    refreshResumenCarteras();   // usa filtros
    refreshPlansTable();        // usa filtros
    refreshCuotasTable();       // usa filtros
  }
  function refreshUI(){ refreshAll(); }

  // ---------- Próximos cobros por cliente (independiente de filtros) ----------
  function refreshClientesCobro(){
    if (!el.tableClientesCobro) return;

    const rangeDays = Number(el.rangeClientesProximos?.value || 14);
    const start = startOfDay(today);
    const end = new Date(start.getTime()); end.setDate(end.getDate() + rangeDays);

    const plans = storage.getPlans();
    const plansIndex = indexById(plans);
    const charges = storage.getCharges();

    // Tomar TODAS las cuotas no pagadas dentro del rango
    const clientesMap = new Map();
    let totalProximo = 0;

    charges.forEach(c => {
      if (c.estado === 'pagado') return;
      const d = parseDate(c.fecha);
      if (isNaN(d) || d < start || d > end) return;
      const plan = plansIndex[c.planId];
      if (!plan) return;

      const key = plan.cliente || 'Sin nombre';
      const monto = Number(c.montoProgramado || 0);
      totalProximo += monto;

      if (!clientesMap.has(key)) {
        clientesMap.set(key, {
          cliente: key,
          asesores: new Set([plan.asesor || '']),
          periodos: new Set([plan.periodo]),
          fechaMin: c.fecha,
          monto
        });
      } else {
        const entry = clientesMap.get(key);
        entry.monto += monto;
        entry.asesores.add(plan.asesor || '');
        entry.periodos.add(plan.periodo);
        if (parseDate(c.fecha) < parseDate(entry.fechaMin)) entry.fechaMin = c.fecha;
      }
    });

    const clientesArray = Array.from(clientesMap.values())
      .sort((a, b) => parseDate(a.fechaMin) - parseDate(b.fechaMin) || (a.cliente || '').localeCompare(b.cliente || ''));

    el.tableClientesCobro.innerHTML = '';
    if (clientesArray.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="5" style="text-align:center;color:#6b7280;">No hay cobros en el rango seleccionado.</td>`;
      el.tableClientesCobro.appendChild(tr);
    } else {
      clientesArray.forEach((item, idx) => {
        const asesores = Array.from(item.asesores).filter(Boolean);
        const asesorStr = asesores.length <= 1 ? (asesores[0] || '') : 'Varios';
        const periodos = Array.from(item.periodos);
        const periodoStr = periodos.length === 1 ? labelPeriodo({ periodo: periodos[0] }) : 'Mixto';

        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'highlight-row' : '';
        tr.innerHTML = `
          <td><strong>${item.cliente}</strong></td>
          <td>${asesorStr}</td>
          <td>${formatDate(item.fechaMin)}</td>
          <td>${periodoStr}</td>
          <td class="text-right">${currency.format(round2(item.monto))}</td>
        `;
        el.tableClientesCobro.appendChild(tr);
      });
    }

    if (el.clientesTotalCobro) {
      el.clientesTotalCobro.textContent = currency.format(round2(totalProximo));
    }
  }

  // ---------- Resumen por cartera ----------
  function refreshResumenCarteras(){
    const plans = applyPlanFilters(storage.getPlans());
    const charges = storage.getCharges();
    if (!el.tableResumenBody) return;
    el.tableResumenBody.innerHTML = '';
    let grandTotal = 0;
    let groupCount = 0;

    plans
      .sort((a,b) => (a.cliente || '').localeCompare(b.cliente || ''))
      .forEach(plan => {
        const next = nextChargeForPlan(charges, plan.id);
        if (!next) return;
        const carteras = plan.carteras || [];
        if (carteras.length === 0) return;

        const groupTr = document.createElement('tr');
        groupTr.className = 'group-row';
        groupTr.innerHTML = `
          <td colspan="8">
            <span style="font-weight:800;">${plan.cliente || ''}</span>
            <span style="color:#6b7280;margin-left:6px;">${plan.asesor || ''}</span>
            <span class="cartera-tag" style="margin-left:10px;">${labelPeriodo(plan)}</span>
            <span style="color:#6b7280;margin-left:10px;">Próxima: ${formatDate(next.fecha)}</span>
          </td>
        `;
        el.tableResumenBody.appendChild(groupTr);
        groupCount++;

        let subtotal = 0;
        carteras.forEach(ct => {
          const cuota = cuotaCartera(plan, ct);
          subtotal += cuota;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${plan.cliente || ''}</td>
            <td>${plan.asesor || ''}</td>
            <td>${labelPeriodo(plan)}</td>
            <td>${formatDate(next.fecha)}</td>
            <td>${ct.nombre || ''}</td>
            <td>${currency.format(Number(ct.baseMonto || 0))}</td>
            <td>${percentFmt(Number(ct.arancelPct ?? plan.arancelPct))}</td>
            <td>${currency.format(cuota)}</td>
          `;
          el.tableResumenBody.appendChild(tr);
        });

        const subTr = document.createElement('tr');
        subTr.className = 'subtotal-row';
        subTr.innerHTML = `
          <td colspan="7" style="text-align:right;">Subtotal ${plan.cliente || ''}</td>
          <td>${currency.format(round2(subtotal))}</td>
        `;
        el.tableResumenBody.appendChild(subTr);

        grandTotal += subtotal;
      });

    if (groupCount === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="text-align:center;color:#6b7280;">No hay próximo cobro para los filtros aplicados.</td>`;
      el.tableResumenBody.appendChild(tr);
    }
    if (el.grandTotalResumen) el.grandTotalResumen.textContent = currency.format(round2(grandTotal));
  }

  // ---------- Planes ----------
  function refreshPlansTable(){
    if (!el.tablePlanesBody) return;
    const plans = applyPlanFilters(storage.getPlans());
    const charges = storage.getCharges();
    el.tablePlanesBody.innerHTML = '';

    plans.forEach(plan => {
      const next = nextChargeForPlan(charges, plan.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${plan.cliente || ''}</strong></td>
        <td>${plan.asesor || ''}</td>
        <td>${percentFmt(Number(plan.arancelPct || 0))}</td>
        <td><span class="badge neutral">${labelPeriodo(plan)}</span></td>
        <td>${formatDate(plan.fechaInicio)}</td>
        <td>${next ? formatDate(next.fecha) : '—'}</td>
        <td>${(plan.carteras || []).length}</td>
        <td>${currency.format(cuotaPlanTotal(plan))}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" title="Cronograma" data-action="cronograma" data-id="${plan.id}">📅</button>
            <button class="btn-icon" title="Editar" data-action="editar" data-id="${plan.id}">✏️</button>
            <button class="btn-icon" title="Eliminar" data-action="eliminar" data-id="${plan.id}">🗑️</button>
          </div>
        </td>
      `;
      el.tablePlanesBody.appendChild(tr);
    });

    el.tablePlanesBody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', onPlanActionClick);
    });
  }

  function onPlanActionClick(e){
    const action = e.currentTarget.getAttribute('data-action');
    const id = e.currentTarget.getAttribute('data-id');
    const plans = storage.getPlans();
    const plan = plans.find(p => p.id === id);
    if (!plan && action !== 'eliminar') return;

    if (action === 'editar'){
      openPlanModal(plan);
    } else if (action === 'eliminar'){
      if (confirm('¿Eliminar plan y sus cuotas no pagadas?')){
        const remainingPlans = plans.filter(p => p.id !== id);
        storage.setPlans(remainingPlans);
        const charges = storage.getCharges().filter(c => c.planId !== id || c.estado === 'pagado');
        storage.setCharges(charges);
        refreshAll();
      }
    } else if (action === 'cronograma'){
      openCronograma(plan);
    }
  }

  // ---------- Cuotas programadas ----------
  function refreshCuotasTable(){
    if (!el.tableCuotasBody) return;
    const charges = applyCuotasFilters(storage.getCharges());
    const plansIndex = indexById(storage.getPlans());
    el.tableCuotasBody.innerHTML = '';

    if (charges.length === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="text-align:center;color:#6b7280;">No hay cuotas para el filtro seleccionado.</td>`;
      el.tableCuotasBody.appendChild(tr);
      return;
    }

    charges
      .sort((a,b) => parseDate(a.fecha) - parseDate(b.fecha))
      .forEach(charge => {
        const plan = plansIndex[charge.planId];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${formatDate(charge.fecha)}</td>
          <td>${plan?.cliente || ''}</td>
          <td>${plan?.asesor || ''}</td>
          <td>${labelPeriodo(plan)}</td>
          <td>${currency.format(charge.montoProgramado)}</td>
          <td>${badgeEstado(charge.estado)}</td>
          <td>
            <div class="table-actions">
              ${charge.estado !== 'pagado' ? `<button class="btn-icon" title="Registrar pago" data-action="pagar" data-id="${charge.id}">💳</button>` : ''}
              ${charge.estado === 'pagado' ? `<button class="btn-icon" title="Deshacer pago" data-action="deshacer" data-id="${charge.id}">↩️</button>` : ''}
            </div>
          </td>
        `;
        el.tableCuotasBody.appendChild(tr);
      });

    el.tableCuotasBody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', onCuotaActionClick);
    });
  }

  function onCuotaActionClick(e){
    const action = e.currentTarget.getAttribute('data-action');
    const id = e.currentTarget.getAttribute('data-id');
    const charges = storage.getCharges();
    const charge = charges.find(c => c.id === id);
    if (!charge) return;

    if (action === 'pagar'){
      state.payingCharge = charge.id;
      el.inpFechaPago.value = toYMD(today);
      el.inpMontoPago.value = String(charge.montoProgramado);
      el.inpObsPago.value = '';
      openModal('#modalPago');
    } else if (action === 'deshacer'){
      if (confirm('¿Marcar esta cuota como no pagada?')){
        charge.estado = estadoForDate(parseDate(charge.fecha));
        charge.pagoFecha = undefined;
        charge.pagoMonto = undefined;
        charge.obs = undefined;
        storage.setCharges(charges);
        refreshAll();
      }
    }
  }

  // ---------- Filtros ----------
  function applyPlanFilters(plans){
    const asesor = el.filterAsesor?.value.trim().toLowerCase() || '';
    const cliente = el.filterCliente?.value.trim().toLowerCase() || '';
    const periodo = el.filterPeriodo?.value || '';

    return plans.filter(p => {
      const okAsesor = !asesor || (p.asesor || '').toLowerCase().includes(asesor);
      const okCliente = !cliente || (p.cliente || '').toLowerCase().includes(cliente);
      const okPeriodo = !periodo || p.periodo === periodo;
      return okAsesor && okCliente && okPeriodo;
    });
  }
  function applyCuotasFilters(allCharges){
    const estado = el.filterEstado?.value || '';
    const asesor = el.filterAsesor?.value.trim().toLowerCase() || '';
    const cliente = el.filterCliente?.value.trim().toLowerCase() || '';
    const periodo = el.filterPeriodo?.value || '';
    const range = el.rangeCuotas?.value;
    const plansIndex = indexById(storage.getPlans());

    const byRange = (c) => {
      if (!range || range === 'all') return true;
      const days = Number(range);
      const start = startOfDay(today);
      const end = new Date(start.getTime()); end.setDate(end.getDate() + days);
      const d = parseDate(c.fecha);
      return d >= start && d <= end;
    };

    return allCharges.filter(c => {
      const pl = plansIndex[c.planId];
      if (!pl) return false;
      const okEstado = !estado || c.estado === estado;
      const okAsesor = !asesor || (pl.asesor || '').toLowerCase().includes(asesor);
      const okCliente = !cliente || (pl.cliente || '').toLowerCase().includes(cliente);
      const okPeriodo = !periodo || pl.periodo === periodo;
      const okRango = byRange(c);
      return okEstado && okAsesor && okCliente && okPeriodo && okRango;
    });
  }

  // ---------- Modal Plan ----------
  function openPlanModal(plan){
    state.editingPlanId = plan?.id || null;
    state.editingPlanSnapshot = plan ? JSON.parse(JSON.stringify(plan)) : {
      id: undefined,
      cliente: '',
      asesor: '',
      arancelPct: '',
      periodo: 'mensual',
      cuotasAnio: '',
      fechaInicio: toYMD(today),
      notas: '',
      carteras: []
    };

    el.modalPlanTitle.textContent = plan ? 'Editar plan de cobro' : 'Nuevo plan de cobro';
    el.inpCliente.value = state.editingPlanSnapshot.cliente || '';
    el.inpAsesor.value = state.editingPlanSnapshot.asesor || '';
    el.inpArancel.value = state.editingPlanSnapshot.arancelPct ?? '';
    el.inpPeriodo.value = state.editingPlanSnapshot.periodo || 'mensual';
    el.inpCuotasAnio.value = state.editingPlanSnapshot.cuotasAnio ?? '';
    el.inpInicio.value = state.editingPlanSnapshot.fechaInicio ? toYMD(state.editingPlanSnapshot.fechaInicio) : toYMD(today);
    el.inpNotas.value = state.editingPlanSnapshot.notas || '';
    onPeriodoChange();

    refreshCarterasTable(state.editingPlanSnapshot.carteras || []);
    openModal('#modalPlan');
  }

  function refreshCarterasTable(carteras){
    if (!state.editingPlanSnapshot) state.editingPlanSnapshot = { carteras: [] };
    state.editingPlanSnapshot.carteras = Array.isArray(carteras) ? carteras.slice() : [];
    if (!el.carterasBody) return;
    el.carterasBody.innerHTML = '';

    state.editingPlanSnapshot.carteras.forEach(cartera => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${cartera.nombre || ''}</td>
        <td>${currency.format(Number(cartera.baseMonto || 0))}</td>
        <td>${cartera.arancelPct != null && cartera.arancelPct !== '' ? percentFmt(Number(cartera.arancelPct)) : '—'}</td>
        <td>
          <button class="btn-icon" title="Eliminar" data-action="eliminar" data-id="${cartera.id}">🗑️</button>
        </td>
      `;
      el.carterasBody.appendChild(tr);
    });

    el.carterasBody.querySelectorAll('button[data-action="eliminar"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const updated = (state.editingPlanSnapshot.carteras || []).filter(c => c.id !== id);
        refreshCarterasTable(updated);
      });
    });
  }

  function addCarteraRow(){
    const nombre = (prompt('Nombre de la cartera:') || '').trim();
    const baseMontoStr = (prompt('Monto base de la cartera:') || '').trim();
    const arancelPctStr = (prompt('Porcentaje de arancel (opcional):') || '').trim();
    if (!nombre || !baseMontoStr) return;

    const newCartera = {
      id: uid(),
      nombre,
      baseMonto: Number(baseMontoStr),
      arancelPct: arancelPctStr ? Number(arancelPctStr) : undefined
    };

    const current = state.editingPlanSnapshot?.carteras || [];
    const updated = current.concat(newCartera);
    refreshCarterasTable(updated);
  }

  function savePlan(){
    const cliente = el.inpCliente.value.trim();
    const asesor = el.inpAsesor.value.trim();
    const arancelPct = el.inpArancel.value !== '' ? Number(el.inpArancel.value) : undefined;
    const periodo = el.inpPeriodo.value;
    const cuotasAnio = el.inpCuotasAnio.value ? Number(el.inpCuotasAnio.value) : undefined;
    const fechaInicio = el.inpInicio.value;
    const notas = el.inpNotas.value.trim();

    if (!cliente || !asesor || !periodo || !fechaInicio) {
      alert('Por favor, complete Cliente, Asesor, Periodo e Inicio.');
      return;
    }

    const snap = state.editingPlanSnapshot || {};
    snap.cliente = cliente;
    snap.asesor = asesor;
    snap.arancelPct = arancelPct;
    snap.periodo = periodo;
    snap.cuotasAnio = periodo === 'personalizado' ? (cuotasAnio || 1) : undefined;
    snap.fechaInicio = fechaInicio;
    snap.notas = notas;
    snap.carteras = Array.isArray(snap.carteras) ? snap.carteras : [];

    const plans = storage.getPlans();

    if (state.editingPlanId) {
      snap.id = state.editingPlanId;
      const idx = plans.findIndex(p => p.id === state.editingPlanId);
      if (idx !== -1) plans[idx] = snap;
    } else {
      snap.id = uid();
      snap.createdAt = Date.now();
      plans.push(snap);
    }
    storage.setPlans(plans);

    const chargesKeep = storage.getCharges().filter(c => c.planId !== snap.id || c.estado === 'pagado');
    const newCharges = generateChargesForPlan(snap, 12);
    storage.setCharges([...chargesKeep, ...newCharges]);

    closeModal('#modalPlan');
    refreshAll();
  }

  // ---------- Modal Cronograma ----------
  function openCronograma(plan){
    el.cronogramaHeader.textContent = `Cronograma de cobros para ${plan.cliente || ''}`;
    const charges = storage.getCharges().filter(c => c.planId === plan.id);
    el.cronogramaBody.innerHTML = '';
    charges.forEach((charge, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${formatDate(charge.fecha)}</td>
        <td>${currency.format(charge.montoProgramado)}</td>
        <td>${badgeEstado(charge.estado)}</td>
      `;
      el.cronogramaBody.appendChild(tr);
    });
    openModal('#modalCronograma');
  }

  // ---------- Modal Pago ----------
  function confirmPago(){
    const chargeId = state.payingCharge;
    const charges = storage.getCharges();
    const charge = charges.find(c => c.id === chargeId);
    if (!charge) return;

    charge.estado = 'pagado';
    charge.pagoFecha = el.inpFechaPago.value;
    charge.pagoMonto = Number(el.inpMontoPago.value || 0);
    charge.obs = el.inpObsPago.value.trim();

    storage.setCharges(charges);
    closeModal('#modalPago');
    refreshAll();
  }

  // ---------- Helpers ----------
  function openModal(selector){
    const modal = qs(selector);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
  }
  function closeModal(selector){
    const modal = qs(selector);
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
  }
  function formatDate(dateStr){
    const date = parseDate(dateStr);
    return isNaN(date) ? '' : date.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function badgeEstado(estado){
    const classes = { pendiente: 'badge warning', vencido: 'badge danger', pagado: 'badge success' };
    return `<span class="${classes[estado] || 'badge neutral'}">${estado || ''}</span>`;
  }
  function labelPeriodo(plan){
    const labels = { mensual:'Mensual', trimestral:'Trimestral', semestral:'Semestral', anual:'Anual', personalizado:'Personalizado' };
    return labels[plan?.periodo] || '—';
  }
  function indexById(items){
    return items.reduce((acc, item) => { acc[item.id] = item; return acc; }, {});
  }
  function debounce(fn, delay){
    let timeout;
    return function(...args){
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ---------- Start ----------
  document.addEventListener('DOMContentLoaded', init);
})();