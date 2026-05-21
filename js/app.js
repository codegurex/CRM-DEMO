// app.js — entrada del CRM: estado, routing, realtime, render
import { CONFIG }                  from './config.js';
import { fetchPedidos, updateEstado, updatePedido, subscribePedidos } from './supabase-client.js';
import { getSession, mostrarLogin, ocultarLogin, signOut, onAuthChange } from './auth.js';
import {
  ventasPorMes, ventasPorVendedor, metricasPorVendedor,
  topProductos, topClientes,
  comparativaKPIs, serieDiariaVentas, proyeccionMes, ventasMesAnterior,
  topsDelMes, alertasInteligentes,
} from './analytics.js';
import { renderLineVentas, renderBarVendedor, renderBarProductos, renderVendedoresCompare } from './charts.js';
import { abrirFichaCliente, abrirFichaProducto } from './details.js';
import { abrirImportador } from './importer.js';
import {
  $, $$, money, num, pct, formatDate,
  rangeFor, debounce, toast, escapeHtml, sparklineSVG,
  etiquetaVendedor, tiendaDeVendedor,
} from './utils.js';

const state = {
  filters: { from: '', to: '', estado: '', vendedor: '', producto: '' },
  pedidos: [],     // dataset actual (ya filtrado en el server)
  view: 'dashboard',
  loading: false,
  search: '',
  editing: null,
};


boot();

async function boot() {
  if (!CONFIG.SUPABASE_URL.startsWith('https://') || CONFIG.SUPABASE_ANON.startsWith('TU-')) {
    showConfigBanner();
  }

  // Gate de autenticación — nada se muestra hasta tener sesión válida.
  const session = await getSession();
  if (!session) {
    mostrarLogin({ onSuccess: () => location.reload() });
    return;
  }
  ocultarLogin();
  document.body.classList.remove('locked');

  const userEmail = session.user?.email || '';
  const elEmail = document.getElementById('user-email');
  if (elEmail) elEmail.textContent = userEmail;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    if (confirm('¿Cerrar sesión?')) await signOut();
  });

  onAuthChange((event) => {
    if (event === 'SIGNED_OUT') location.reload();
  });

  bindFilters();
  bindNav();
  bindOrdersUI();
  bindModal();
  bindExport();
  bindMobileMenu();
  bindMetaYNotas();
  bindClickableNames();
  document.getElementById('btn-import')?.addEventListener('click', abrirImportador);

  setView(location.hash.replace('#', '') || 'dashboard');
  window.addEventListener('hashchange', () =>
    setView(location.hash.replace('#', '') || 'dashboard')
  );

  subscribePedidos({
    onChange: handleRealtimeChange,
    onStatus: setRealtimeStatus,
  });

  await refresh();
}

function populateVendedoresFromData() {
  const sel = $('#f-vendedor');
  const current = sel.value;
  const nombres = Array.from(
    new Set(state.pedidos.map((p) => p.vendedor).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  sel.innerHTML =
    `<option value="">Todos</option>` +
    `<option value="__sin__">Sin asignar</option>` +
    nombres.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');

  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function bindFilters() {
  const onChange = debounce(() => {
    state.filters = {
      from:     $('#f-date-from').value,
      to:       $('#f-date-to').value,
      estado:   $('#f-estado').value,
      vendedor: $('#f-vendedor').value,
      producto: $('#f-producto').value.trim(),
    };
    refresh();
  }, 250);

  ['#f-date-from', '#f-date-to', '#f-estado', '#f-vendedor'].forEach((s) =>
    $(s).addEventListener('change', onChange));
  $('#f-producto').addEventListener('input', onChange);

  $('#btn-clear-filters').addEventListener('click', () => {
    $('#f-date-from').value = '';
    $('#f-date-to').value = '';
    $('#f-estado').value = '';
    $('#f-vendedor').value = '';
    $('#f-producto').value = '';
    $$('#quick-ranges .chip').forEach((c) => c.classList.remove('active'));
    state.filters = { from: '', to: '', estado: '', vendedor: '', producto: '' };
    refresh();
  });

  $$('#quick-ranges .chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#quick-ranges .chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      const { from, to } = rangeFor(btn.dataset.range);
      $('#f-date-from').value = from;
      $('#f-date-to').value   = to;
      state.filters.from = from;
      state.filters.to   = to;
      refresh();
    });
  });
}

function bindNav() {
  $$('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setView(a.dataset.nav);
    });
  });
}

const VIEW_TITLES = {
  dashboard:  'Dashboard',
  orders:     'Pedidos',
  vendedores: 'Vendedores',
  customers:  'Top Clientes',
  products:   'Productos',
};

function setView(name) {
  if (!VIEW_TITLES[name]) name = 'dashboard';
  state.view = name;
  history.replaceState(null, '', `#${name}`);

  $$('[data-view]').forEach((s) => s.classList.toggle('hidden', s.dataset.view !== name));
  $$('[data-nav]') .forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  $('#page-title').textContent = VIEW_TITLES[name];

  render();
}

// -------------------------------------------------------------
// Refetch + render
// -------------------------------------------------------------
async function refresh() {
  state.loading = true;
  try {
    // El filtro "Sin asignar" se traduce a un IS NULL en la query.
    const filtersForServer = { ...state.filters };
    if (filtersForServer.vendedor === '__sin__') filtersForServer.vendedor = null;

    state.pedidos = await fetchPedidos(filtersForServer);
    populateVendedoresFromData();
    $('#last-update').textContent = `Actualizado: ${new Date().toLocaleTimeString(CONFIG.LOCALE)}`;
    render();
  } catch (err) {
    console.error(err);
    toast('Error cargando datos: ' + (err.message || err));
  } finally {
    state.loading = false;
  }
}

function render() {
  switch (state.view) {
    case 'dashboard': renderDashboard(); break;
    case 'orders':     renderOrders();     break;
    case 'vendedores': renderVendedores(); break;
    case 'customers':  renderCustomers();  break;
    case 'products':   renderProducts();   break;
  }
}

// -------------------------------------------------------------
// Vista: Dashboard ejecutivo
// -------------------------------------------------------------
const META_KEY = 'tahor_meta_mensual';
const NOTAS_KEY = 'tahor_notas_dueno';

function getMeta()   { return Number(localStorage.getItem(META_KEY)) || 0; }
function setMeta(v)  { localStorage.setItem(META_KEY, String(v)); }
function getNotas()  { return localStorage.getItem(NOTAS_KEY) || ''; }
function setNotas(s) { localStorage.setItem(NOTAS_KEY, s); }

function renderDashboard() {
  // ---- 1. Alertas inteligentes
  renderAlertas();

  // ---- 2. KPIs comparativos con sparkline (últimos 30d vs 30d previos)
  const cmp = comparativaKPIs(state.pedidos, 30);
  setKPI('ventas',     money(cmp.ventas.valor),     cmp.ventas.delta,     `vs ${money(cmp.ventas.anterior)} previos`);
  setKPI('pedidos',    num(cmp.pedidos.valor),      cmp.pedidos.delta,    `vs ${num(cmp.pedidos.anterior)} previos`);
  setKPI('conversion', pct(cmp.conversion.valor),   cmp.conversion.delta, `${cmp.conversion.delta >= 0 ? '+' : ''}${cmp.conversion.delta.toFixed(1)} pts vs prev.`, true);
  setKPI('ticket',     money(cmp.ticket.valor),     cmp.ticket.delta,     `vs ${money(cmp.ticket.anterior)} previos`);

  // Sparklines para ventas y pedidos
  const serie = serieDiariaVentas(state.pedidos, 30);
  $('#kpi-ventas-sparkline').innerHTML  = sparklineSVG(serie.map((d) => d.total),    { color: '#2563eb' });
  $('#kpi-pedidos-sparkline').innerHTML = sparklineSVG(serie.map((d) => d.pedidos),  { color: '#16a34a', fill: 'rgba(22,163,74,.12)' });

  // ---- 3. Proyección del mes + meta
  renderProyeccion();

  // ---- 4. Tops del mes
  renderTopsMes();

  // ---- 5. Charts (los que ya tenías)
  renderLineVentas('chart-line', ventasPorMes(state.pedidos));
  renderBarVendedor('chart-vendedor', ventasPorVendedor(state.pedidos));
  const tops = topProductos(state.pedidos, { limit: 8 });
  renderBarProductos('chart-products',         tops.porUnidades, 'unidades', 'Unidades');
  renderBarProductos('chart-products-revenue', tops.porIngreso,  'ingreso',  'Ingreso');
}

function setKPI(slug, valor, delta, sub, esPuntos = false) {
  $(`#kpi-${slug}`).textContent = valor;
  $(`#kpi-${slug}-sub`).textContent = sub || '';
  const elDelta = $(`#kpi-${slug}-delta`);
  if (delta === undefined || delta === null || !isFinite(delta)) {
    elDelta.innerHTML = '';
    return;
  }
  const positivo = delta >= 0;
  const color = positivo ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  const arrow = positivo ? '▲' : '▼';
  const txt = esPuntos
    ? `${positivo ? '+' : ''}${delta.toFixed(1)} pts`
    : `${arrow} ${pct(Math.abs(delta), 0)}`;
  elDelta.innerHTML = `<span class="${color} px-2 py-0.5 rounded-full">${txt}</span>`;
}

function renderProyeccion() {
  const proj = proyeccionMes(state.pedidos);
  const previo = ventasMesAnterior(state.pedidos);
  const meta = getMeta();

  $('#proj-ventas').textContent  = money(proj.ventasMes);
  $('#proj-dias').textContent    = `${proj.diasPasados} de ${proj.diasMes} días · ${proj.pedidosMes} pedidos`;
  $('#proj-estimado').textContent = money(proj.proyeccion);

  if (previo > 0) {
    const d = ((proj.proyeccion - previo) / previo) * 100;
    const arrow = d >= 0 ? '▲' : '▼';
    const cls = d >= 0 ? 'text-emerald-600' : 'text-rose-600';
    $('#proj-vs-prev').innerHTML = `mes anterior: ${money(previo)} <span class="${cls}">${arrow} ${pct(Math.abs(d), 0)}</span>`;
  } else {
    $('#proj-vs-prev').textContent = 'sin histórico de mes anterior';
  }

  // Barra de meta
  if (meta > 0) {
    $('#proj-meta').textContent = money(meta);
    const pctMeta = Math.min(100, (proj.ventasMes / meta) * 100);
    $('#proj-bar').style.width = `${pctMeta}%`;
    const sufMeta = proj.proyeccion >= meta
      ? '✅ proyección supera la meta'
      : `⚠️ proyección queda en ${money(proj.proyeccion)} (faltarían ${money(meta - proj.proyeccion)})`;
    $('#proj-meta-sub').textContent = sufMeta;
    $('#proj-bar-label').textContent = `${pct(pctMeta, 0)} de la meta cumplido`;
    // Color de barra
    $('#proj-bar').className = `h-full transition-all ${pctMeta >= 100 ? 'bg-emerald-500' : pctMeta >= 70 ? 'bg-brand-500' : 'bg-amber-500'}`;
  } else {
    $('#proj-meta').textContent = 'Sin definir';
    $('#proj-meta-sub').textContent = 'Click en "Editar meta"';
    $('#proj-bar').style.width = '0%';
    $('#proj-bar-label').textContent = '—';
  }
}

function renderTopsMes() {
  const t = topsDelMes(state.pedidos);
  if (t.vendedor) {
    $('#top-vendedor-name').textContent  = etiquetaVendedor(t.vendedor.nombre);
    $('#top-vendedor-total').textContent = money(t.vendedor.total);
  } else {
    $('#top-vendedor-name').textContent  = 'Sin asignar';
    $('#top-vendedor-total').textContent = 'Aún no hay ventas del mes';
  }
  if (t.producto) {
    $('#top-producto-name').textContent  = t.producto.nombre;
    $('#top-producto-total').textContent = money(t.producto.total);
  } else {
    $('#top-producto-name').textContent  = '—';
    $('#top-producto-total').textContent = 'Sin pedidos vendidos';
  }
  if (t.cliente) {
    $('#top-cliente-name').textContent  = t.cliente.nombre;
    $('#top-cliente-total').textContent = `${money(t.cliente.total)} · ${t.cliente.pedidos} pedidos`;
  } else {
    $('#top-cliente-name').textContent  = '—';
    $('#top-cliente-total').textContent = '';
  }
}

function renderAlertas() {
  const wrap = $('#alerts-strip');
  const alertas = alertasInteligentes(state.pedidos, { limit: 4 });
  const colorMap = {
    rojo:     'border-rose-200    bg-rose-50    text-rose-900',
    amarillo: 'border-amber-200   bg-amber-50   text-amber-900',
    verde:    'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  wrap.innerHTML = alertas.map((a) => `
    <div class="border ${colorMap[a.nivel] || colorMap.amarillo} rounded-xl p-3">
      <div class="flex items-start gap-2">
        <span class="text-xl">${a.icono}</span>
        <div class="flex-1">
          <div class="font-semibold text-sm">${escapeHtml(a.titulo)}</div>
          <div class="text-xs opacity-80 mt-0.5">${escapeHtml(a.detalle)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------------
// Vista: Pedidos (tabla con búsqueda + acciones)
// -------------------------------------------------------------
function bindOrdersUI() {
  $('#orders-search').addEventListener('input', debounce((e) => {
    state.search = e.target.value.toLowerCase();
    if (state.view === 'orders') renderOrders();
  }, 150));
}

function renderOrders() {
  const tbody = $('#orders-tbody');
  const empty = $('#orders-empty');

  let rows = state.pedidos;
  if (state.search) {
    rows = rows.filter((p) =>
      (p.cliente_nombre || '').toLowerCase().includes(state.search) ||
      (p.cliente_telefono || '').toLowerCase().includes(state.search) ||
      p.detalle.some((d) => (d.producto || '').toLowerCase().includes(state.search))
    );
  }

  $('#orders-count').textContent = `${rows.length} pedido${rows.length === 1 ? '' : 's'}`;

  if (!rows.length) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = rows.map((p) => {
    const productos = p.detalle.map((d) =>
      `${escapeHtml(d.producto)} <span class="text-ink-500">×${num(d.cantidad)}</span>`
    ).join('<br>');

    const states = ['en_espera', 'vendido', 'no_vendido'];
    const labels = { en_espera: 'En espera', vendido: 'Vendido', no_vendido: 'No vendido' };

    const stateBtns = states.map((s) =>
      `<button class="btn-state ${p.estado === s ? `is-active ${s}` : ''}"
        data-action="state" data-id="${p.id}" data-state="${s}"
        title="Marcar como ${labels[s]}">${labels[s]}</button>`
    ).join(' ');

    const facturaPill = p.numero_factura
      ? `<div class="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 inline-block mt-1 font-mono">📄 ${escapeHtml(p.numero_factura)}</div>`
      : '';
    return `
      <tr data-id="${p.id}">
        <td class="td whitespace-nowrap text-ink-500">${formatDate(p.fecha)}</td>
        <td class="td font-medium">
          <span class="clickable" data-customer-id="${p.cliente_id ?? ''}" data-customer-tel="${escapeHtml(p.cliente_telefono || '')}">${escapeHtml(p.cliente_nombre)}</span>
          ${facturaPill}
        </td>
        <td class="td text-ink-500">${escapeHtml(p.cliente_telefono)}</td>
        <td class="td">${productos || '<span class="text-ink-300">—</span>'}</td>
        <td class="td text-right font-semibold">${money(p.total)}</td>
        <td class="td">${escapeHtml(etiquetaVendedor(p.vendedor))}</td>
        <td class="td"><span class="badge badge-${p.estado}">${labels[p.estado] || p.estado}</span></td>
        <td class="td text-right whitespace-nowrap">
          <div class="inline-flex flex-wrap gap-1 justify-end">${stateBtns}
            <button class="btn-state" data-action="edit" data-id="${p.id}" title="Editar">✎</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Event delegation
  tbody.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'state') {
      try {
        await updateEstado(id, btn.dataset.state);
        toast('Estado actualizado');
        await refresh();
      } catch (err) { toast('Error: ' + err.message); }
    } else if (btn.dataset.action === 'edit') {
      openModal(id);
    }
  };
}

// -------------------------------------------------------------
// Vista: Vendedores (cards + comparativa)
// -------------------------------------------------------------
function renderVendedores() {
  const metricas = metricasPorVendedor(state.pedidos);
  const wrap = $('#vendedores-cards');
  wrap.innerHTML = metricas.map((m) => `
    <div class="card">
      <div class="text-sm font-semibold text-ink-700">${escapeHtml(etiquetaVendedor(m.vendedor))}</div>
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div>
          <div class="kpi-label">Ventas</div>
          <div class="text-xl font-bold">${money(m.ventas)}</div>
        </div>
        <div>
          <div class="kpi-label">Pedidos</div>
          <div class="text-xl font-bold">${num(m.pedidos)}</div>
        </div>
        <div>
          <div class="kpi-label">Conversión</div>
          <div class="text-xl font-bold">${pct(m.conversion)}</div>
        </div>
        <div>
          <div class="kpi-label">Ticket prom.</div>
          <div class="text-xl font-bold">${money(m.ticket)}</div>
        </div>
      </div>
    </div>
  `).join('') || `<div class="text-ink-500">Sin datos para mostrar.</div>`;

  renderVendedoresCompare('chart-vendedores-compare', metricas);
}

// -------------------------------------------------------------
// Vista: Top Clientes
// -------------------------------------------------------------
function renderCustomers() {
  const top = topClientes(state.pedidos, 10);
  const tbody = $('#customers-tbody');
  if (!top.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="td text-center text-ink-500">Sin datos.</td></tr>`;
    return;
  }
  tbody.innerHTML = top.map((c, i) => `
    <tr>
      <td class="td text-ink-500">${i + 1}</td>
      <td class="td font-medium"><span class="clickable" data-customer-id="${c.cliente_id ?? ''}" data-customer-tel="${escapeHtml(c.telefono || '')}">${escapeHtml(c.nombre)}</span></td>
      <td class="td text-ink-500">${escapeHtml(c.telefono)}</td>
      <td class="td text-right">${num(c.pedidos)}</td>
      <td class="td text-right font-semibold">${money(c.total)}</td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// Vista: Productos
// -------------------------------------------------------------
function renderProducts() {
  const { todos } = topProductos(state.pedidos, { limit: 9999 });
  const tbody = $('#products-tbody');
  if (!todos.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="td text-center text-ink-500">Sin datos.</td></tr>`;
    return;
  }
  tbody.innerHTML = todos.map((p) => `
    <tr>
      <td class="td font-medium"><span class="clickable" data-product="${escapeHtml(p.producto)}">${escapeHtml(p.producto)}</span></td>
      <td class="td text-right">${num(p.unidades)}</td>
      <td class="td text-right font-semibold">${money(p.ingreso)}</td>
      <td class="td text-right">${num(p.pedidos)}</td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// Modal de edición
// -------------------------------------------------------------
function bindModal() {
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-cancel').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  $('#modal-save').addEventListener('click', saveModal);
}

function openModal(id) {
  const p = state.pedidos.find((x) => String(x.id) === String(id));
  if (!p) return;
  state.editing = p;
  $('#modal-pedido-id').textContent = `#${p.id}`;
  $('#m-estado').value   = p.estado;
  $('#m-vendedor').value = etiquetaVendedor(p.vendedor);
  $('#m-vendedor').placeholder = p.vendedor ? '' : 'Sin asignar';
  $('#m-total').value    = p.total;
  $('#m-cliente').value = p.cliente_nombre;
  $('#m-detalle').innerHTML = p.detalle.map((d) => `
    <div class="flex items-center justify-between p-3">
      <div>
        <div class="font-medium">${escapeHtml(d.producto)}</div>
        <div class="text-xs text-ink-500">${num(d.cantidad)} × ${money(d.precio_unitario)}</div>
      </div>
      <div class="font-semibold">${money(d.subtotal)}</div>
    </div>
  `).join('') || '<div class="p-3 text-ink-500">Sin detalle.</div>';
  $('#modal').classList.remove('hidden');
}

function closeModal() {
  $('#modal').classList.add('hidden');
  state.editing = null;
}

async function saveModal() {
  if (!state.editing) return;
  // Nota: 'vendedor' NO se edita aquí — viene de la factura emitida en
  // Picking cuando la integración esté conectada.
  const patch = {
    estado: $('#m-estado').value,
    total:  Number($('#m-total').value) || 0,
  };
  try {
    await updatePedido(state.editing.id, patch);
    toast('Pedido actualizado');
    closeModal();
    await refresh();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// -------------------------------------------------------------
// Realtime
// -------------------------------------------------------------
function setRealtimeStatus(status) {
  const el = $('#rt-status');
  const dot = el.querySelector('span');
  const txt = el.querySelector('span:last-child');
  dot.className = 'w-2 h-2 rounded-full ';
  if (status === 'SUBSCRIBED') {
    dot.classList.add('live'); txt.textContent = 'En vivo';
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    dot.classList.add('err'); txt.textContent = 'Sin conexión RT';
  } else {
    dot.classList.add('pending'); txt.textContent = 'Conectando…';
  }
}

let rtDebounce;
function handleRealtimeChange(payload) {
  // Mensaje sutil
  const labels = { INSERT: 'Nuevo pedido', UPDATE: 'Pedido actualizado', DELETE: 'Pedido eliminado' };
  toast(labels[payload.eventType] || 'Cambio detectado');

  // Hacemos refetch debounced (no actualizamos a mano para mantener
  // consistencia con joins y filtros del servidor).
  clearTimeout(rtDebounce);
  rtDebounce = setTimeout(() => refresh(), 350);
}

// -------------------------------------------------------------
// Exportar a Excel (todo el dataset filtrado actual)
// -------------------------------------------------------------
function bindExport() {
  $('#btn-export').addEventListener('click', () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: pedidos plano
    const pedidosFlat = state.pedidos.map((p) => ({
      ID: p.id,
      Fecha: p.fecha,
      NumeroFactura: p.numero_factura || '',
      Cliente: p.cliente_nombre,
      Telefono: p.cliente_telefono,
      Vendedor: p.vendedor,
      Tienda:   tiendaDeVendedor(p.vendedor),
      Estado: p.estado,
      Total: p.total,
      Items: p.detalle.length,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedidosFlat), 'Pedidos');

    // Hoja 2: detalle
    const detalle = state.pedidos.flatMap((p) =>
      p.detalle.map((d) => ({
        PedidoID: p.id,
        Fecha: p.fecha,
        NumeroFactura: p.numero_factura || '',
        Cliente: p.cliente_nombre,
        Vendedor: p.vendedor,
        Tienda:   tiendaDeVendedor(p.vendedor),
        Producto: d.producto,
        Cantidad: d.cantidad,
        PrecioUnitario: d.precio_unitario,
        Subtotal: d.subtotal,
      }))
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle');

    // Hoja 3: KPIs por vendedor
    XLSX.utils.book_append_sheet(wb,
      XLSX.utils.json_to_sheet(metricasPorVendedor(state.pedidos)),
      'PorVendedor');

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `tahor-clean-${stamp}.xlsx`);
  });
}

// -------------------------------------------------------------
// Sidebar móvil
// -------------------------------------------------------------
function bindMetaYNotas() {
  // Editar meta del mes (prompt simple)
  const btn = $('#btn-edit-meta');
  if (btn) {
    btn.addEventListener('click', () => {
      const actual = getMeta();
      const v = prompt('Meta de ventas del mes (USD). Deja vacío para borrar:', actual || '');
      if (v === null) return;
      const num = Number(String(v).replace(/[^\d.]/g, ''));
      setMeta(isFinite(num) && num > 0 ? num : 0);
      renderProyeccion();
      toast(num > 0 ? `Meta del mes: ${money(num)}` : 'Meta eliminada');
    });
  }

  // Notas privadas (autosave en localStorage)
  const ta = $('#notas-dueno');
  if (ta) {
    ta.value = getNotas();
    ta.addEventListener('input', debounce(() => setNotas(ta.value), 400));
  }
}

// Delegación global: clic en cualquier nombre de cliente/producto abre la ficha.
function bindClickableNames() {
  document.body.addEventListener('click', (e) => {
    const el = e.target.closest('.clickable');
    if (!el) return;
    if (el.dataset.product !== undefined) {
      abrirFichaProducto(state.pedidos, el.dataset.product);
    } else if (el.dataset.customerId !== undefined || el.dataset.customerTel !== undefined) {
      abrirFichaCliente(state.pedidos, {
        id: el.dataset.customerId || null,
        telefono: el.dataset.customerTel || null,
      });
    }
  });
}

function bindMobileMenu() {
  const btn      = $('#btn-menu');
  const backdrop = $('#sidebar-backdrop');
  if (!btn) return;

  const openMenu  = () => document.body.classList.add('menu-open');
  const closeMenu = () => document.body.classList.remove('menu-open');
  const toggleMenu = () => document.body.classList.toggle('menu-open');

  // Botón hamburguesa → toggle
  btn.addEventListener('click', toggleMenu);

  // Tap fuera (backdrop) → cerrar
  backdrop?.addEventListener('click', closeMenu);

  // Click en cualquier nav item → cerrar (para que se vea la vista que abrió)
  $$('[data-nav]').forEach((a) => a.addEventListener('click', closeMenu));

  // ESC → cerrar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });

  // Si el usuario rota o agranda la pantalla a desktop, cerrar el modo móvil
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', (e) => { if (e.matches) closeMenu(); });
}

// -------------------------------------------------------------
// Banner si Supabase no está configurado
// -------------------------------------------------------------
function showConfigBanner() {
  const div = document.createElement('div');
  div.className = 'bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2';
  div.innerHTML =
    `⚠️ Configura tu proyecto Supabase en <code class="font-mono">js/config.js</code> ` +
    `(<code>SUPABASE_URL</code> y <code>SUPABASE_ANON</code>) para cargar datos reales.`;
  document.body.prepend(div);
}
