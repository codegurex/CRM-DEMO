// =============================================================
// details.js — Fichas 360° de cliente y producto
//
// Renderiza un modal grande con TODA la info de un cliente o
// producto. Se abre al hacer click en cualquier nombre del CRM.
// Las notas privadas viven en localStorage (solo el dueño las ve).
// =============================================================
import {
  $, money, num, formatDate, escapeHtml,
  monthKey, debounce, sparklineSVG, lastMonths,
  etiquetaVendedor,
} from './utils.js';

// =============================================================
// Helpers comunes
// =============================================================
const NOTAS_KEY_PREFIX = 'tahor_notas_';

function getNota(key)        { return localStorage.getItem(NOTAS_KEY_PREFIX + key) || ''; }
function setNota(key, value) { localStorage.setItem(NOTAS_KEY_PREFIX + key, value); }

function abrirModal(html) {
  let overlay = document.getElementById('detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'detail-overlay';
    overlay.className = 'detail-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'detail-overlay' || e.target.dataset.close === '1') cerrarModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrarModal();
    });
  }
  overlay.innerHTML = html;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  const overlay = document.getElementById('detail-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  setTimeout(() => { overlay.innerHTML = ''; }, 200);
  document.body.style.overflow = '';
}

// =============================================================
// FICHA CLIENTE
// =============================================================
export function abrirFichaCliente(pedidos, clienteIdentifier) {
  // Filtrar todos los pedidos de este cliente
  const delCliente = pedidos.filter((p) => {
    if (clienteIdentifier.id != null && p.cliente_id != null) {
      return String(p.cliente_id) === String(clienteIdentifier.id);
    }
    return p.cliente_telefono === clienteIdentifier.telefono;
  });

  if (!delCliente.length) {
    abrirModal(`
      <div class="detail-modal">
        <div class="detail-head">
          <h2>Cliente no encontrado</h2>
          <button class="detail-close" data-close="1">×</button>
        </div>
        <div class="detail-body"><p class="text-ink-500">No hay pedidos asociados.</p></div>
      </div>
    `);
    return;
  }

  // Datos básicos (toma del pedido más reciente)
  delCliente.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const ultimo = delCliente[0];
  const nombre = ultimo.cliente_nombre || 'Sin nombre';
  const telefono = ultimo.cliente_telefono || '';
  const cliId = ultimo.cliente_id ?? telefono;
  const notaKey = `cliente_${cliId}`;

  // Métricas
  const vendidos = delCliente.filter((p) => p.estado === 'vendido');
  const totalGastado = vendidos.reduce((s, p) => s + p.total, 0);
  const ticketProm = vendidos.length ? totalGastado / vendidos.length : 0;
  const fechas = vendidos.map((p) => new Date(p.fecha)).sort((a, b) => a - b);
  let intervaloProm = 0;
  if (fechas.length >= 2) {
    let tot = 0;
    for (let i = 1; i < fechas.length; i++) tot += (fechas[i] - fechas[i - 1]) / 86400000;
    intervaloProm = tot / (fechas.length - 1);
  }
  const diasDesdeUltimo = vendidos.length
    ? Math.floor((Date.now() - fechas[fechas.length - 1]) / 86400000)
    : null;

  // Productos favoritos
  const productos = new Map();
  for (const p of vendidos) {
    for (const d of p.detalle) {
      const k = d.producto || '—';
      if (!productos.has(k)) productos.set(k, { unidades: 0, ingreso: 0, veces: 0 });
      const b = productos.get(k);
      b.unidades += d.cantidad;
      b.ingreso  += d.subtotal;
      b.veces++;
    }
  }
  const productosOrden = [...productos.entries()].sort((a, b) => b[1].ingreso - a[1].ingreso).slice(0, 5);

  // Serie mensual de gastos
  const meses = lastMonths(12);
  const seriePorMes = new Map(meses.map((m) => [m, 0]));
  for (const p of vendidos) {
    const k = monthKey(p.fecha);
    if (seriePorMes.has(k)) seriePorMes.set(k, seriePorMes.get(k) + p.total);
  }
  const sparkData = [...seriePorMes.values()];

  // Estado del cliente
  let estadoCliente = '🟢 Activo';
  let estadoColor = 'emerald';
  if (intervaloProm > 0 && diasDesdeUltimo > intervaloProm * 2) {
    estadoCliente = '🔴 En riesgo de pérdida';
    estadoColor = 'rose';
  } else if (intervaloProm > 0 && diasDesdeUltimo > intervaloProm * 1.5) {
    estadoCliente = '🟡 Atrasado en compra';
    estadoColor = 'amber';
  } else if (vendidos.length === 0) {
    estadoCliente = '⚪ Sin compras concretadas';
    estadoColor = 'slate';
  }

  // Mensaje pre-armado para WhatsApp
  const wpMsg = encodeURIComponent(`Hola ${nombre}, le saluda Tahor Clean. ¿Cómo está? Quería saber si necesita reabastecer alguno de sus productos.`);
  const telLimpio = (telefono || '').replace(/\D/g, '');
  const wpLink = telLimpio ? `https://wa.me/${telLimpio.startsWith('593') ? telLimpio : '593' + telLimpio.replace(/^0/, '')}?text=${wpMsg}` : '';

  // ----- Render -----
  const html = `
    <div class="detail-modal">
      <div class="detail-head">
        <div>
          <div class="detail-eyebrow">Cliente</div>
          <h2>${escapeHtml(nombre)}</h2>
          <div class="detail-sub">
            ${escapeHtml(telefono || 'Sin teléfono')}
            <span class="badge badge-${estadoColor === 'rose' ? 'no_vendido' : estadoColor === 'amber' ? 'en_espera' : estadoColor === 'emerald' ? 'vendido' : 'en_espera'}" style="margin-left:.5rem">${estadoCliente}</span>
          </div>
        </div>
        <button class="detail-close" data-close="1" aria-label="Cerrar">×</button>
      </div>

      <div class="detail-body">

        <!-- KPIs -->
        <div class="detail-kpis">
          <div><div class="kpi-label">Total comprado</div><div class="text-xl font-bold">${money(totalGastado)}</div></div>
          <div><div class="kpi-label">Pedidos vendidos</div><div class="text-xl font-bold">${num(vendidos.length)}</div></div>
          <div><div class="kpi-label">Ticket promedio</div><div class="text-xl font-bold">${money(ticketProm)}</div></div>
          <div><div class="kpi-label">Compra cada</div><div class="text-xl font-bold">${intervaloProm > 0 ? num(Math.round(intervaloProm)) + ' d.' : '—'}</div></div>
          <div><div class="kpi-label">Última compra</div><div class="text-xl font-bold">${diasDesdeUltimo != null ? 'hace ' + num(diasDesdeUltimo) + ' d.' : '—'}</div></div>
        </div>

        <!-- Acciones -->
        <div class="detail-actions">
          ${wpLink ? `<a href="${wpLink}" target="_blank" rel="noopener" class="detail-btn detail-btn-success">📱 WhatsApp</a>` : ''}
          ${telefono ? `<a href="tel:${escapeHtml(telefono)}" class="detail-btn">📞 Llamar</a>` : ''}
        </div>

        <!-- Sparkline -->
        ${sparkData.some((v) => v > 0) ? `
        <div class="detail-section">
          <h3>Gastos últimos 12 meses</h3>
          <div style="margin-top:.5rem">${sparklineSVG(sparkData, { width: 600, height: 60, color: '#2563eb' })}</div>
        </div>
        ` : ''}

        <!-- Productos favoritos -->
        ${productosOrden.length ? `
        <div class="detail-section">
          <h3>Productos favoritos</h3>
          <table class="detail-table">
            <thead><tr><th>Producto</th><th class="text-right">Unidades</th><th class="text-right">Ingreso</th></tr></thead>
            <tbody>
              ${productosOrden.map(([k, v]) => `
                <tr>
                  <td>${escapeHtml(k)}</td>
                  <td class="text-right">${num(v.unidades)}</td>
                  <td class="text-right font-semibold">${money(v.ingreso)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Historial de pedidos -->
        <div class="detail-section">
          <h3>Historial de pedidos (${num(delCliente.length)})</h3>
          <table class="detail-table">
            <thead><tr><th>Fecha</th><th>Estado</th><th class="text-right">Total</th><th>Vendedor</th></tr></thead>
            <tbody>
              ${delCliente.slice(0, 50).map((p) => `
                <tr>
                  <td>${formatDate(p.fecha)}</td>
                  <td><span class="badge badge-${p.estado}">${p.estado}</span></td>
                  <td class="text-right font-semibold">${money(p.total)}</td>
                  <td>${escapeHtml(etiquetaVendedor(p.vendedor))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${delCliente.length > 50 ? `<p class="text-xs text-ink-500 mt-2">Mostrando los 50 más recientes de ${num(delCliente.length)} totales.</p>` : ''}
        </div>

        <!-- Notas privadas -->
        <div class="detail-section">
          <h3>📝 Notas privadas (solo tú las ves)</h3>
          <textarea id="detail-notas" rows="3"
            class="filter-input mt-2"
            placeholder="Ej: prefiere productos sin fragancia · llamarlo en marzo · sensible al precio">${escapeHtml(getNota(notaKey))}</textarea>
        </div>

      </div>
    </div>
  `;
  abrirModal(html);

  // Autosave de notas
  const notasEl = document.getElementById('detail-notas');
  if (notasEl) {
    notasEl.addEventListener('input', debounce(() => {
      setNota(notaKey, notasEl.value);
    }, 400));
  }
}

// =============================================================
// FICHA PRODUCTO
// =============================================================
export function abrirFichaProducto(pedidos, productoNombre) {
  // Pedidos que contienen el producto
  const conProducto = pedidos.filter((p) =>
    p.detalle.some((d) => d.producto === productoNombre)
  );

  if (!conProducto.length) {
    abrirModal(`
      <div class="detail-modal">
        <div class="detail-head">
          <h2>${escapeHtml(productoNombre)}</h2>
          <button class="detail-close" data-close="1">×</button>
        </div>
        <div class="detail-body"><p class="text-ink-500">Sin datos para este producto.</p></div>
      </div>
    `);
    return;
  }

  const vendidos = conProducto.filter((p) => p.estado === 'vendido');

  // Métricas
  let unidadesVendidas = 0, ingresoTotal = 0;
  const clientesQueLoCompran = new Map();
  for (const p of vendidos) {
    for (const d of p.detalle) {
      if (d.producto !== productoNombre) continue;
      unidadesVendidas += d.cantidad;
      ingresoTotal += d.subtotal;
      const k = p.cliente_id ?? p.cliente_telefono;
      if (!clientesQueLoCompran.has(k)) {
        clientesQueLoCompran.set(k, {
          id: p.cliente_id, nombre: p.cliente_nombre, telefono: p.cliente_telefono,
          unidades: 0, ingreso: 0, vecesPedido: 0,
        });
      }
      const c = clientesQueLoCompran.get(k);
      c.unidades += d.cantidad;
      c.ingreso  += d.subtotal;
      c.vecesPedido++;
    }
  }

  const topClientes = [...clientesQueLoCompran.values()].sort((a, b) => b.ingreso - a.ingreso).slice(0, 10);
  const ventasPromUnidad = unidadesVendidas ? ingresoTotal / unidadesVendidas : 0;

  // Serie mensual
  const meses = lastMonths(12);
  const seriePorMes = new Map(meses.map((m) => [m, 0]));
  for (const p of vendidos) {
    const k = monthKey(p.fecha);
    if (!seriePorMes.has(k)) continue;
    for (const d of p.detalle) {
      if (d.producto === productoNombre) {
        seriePorMes.set(k, seriePorMes.get(k) + d.subtotal);
      }
    }
  }
  const sparkData = [...seriePorMes.values()];

  // Vendedores
  const porVendedor = new Map();
  for (const p of vendidos) {
    if (!p.detalle.some((d) => d.producto === productoNombre)) continue;
    const v = p.vendedor || 'Sin asignar';
    porVendedor.set(v, (porVendedor.get(v) || 0) + 1);
  }
  const vendedoresOrden = [...porVendedor.entries()].sort((a, b) => b[1] - a[1]);

  // Cross-sell: productos que se compran junto con éste
  const coCompra = new Map();
  for (const p of vendidos) {
    if (!p.detalle.some((d) => d.producto === productoNombre)) continue;
    for (const d of p.detalle) {
      if (d.producto && d.producto !== productoNombre) {
        coCompra.set(d.producto, (coCompra.get(d.producto) || 0) + 1);
      }
    }
  }
  const coCompraOrden = [...coCompra.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Notas privadas
  const notaKey = `producto_${productoNombre}`;

  const html = `
    <div class="detail-modal">
      <div class="detail-head">
        <div>
          <div class="detail-eyebrow">Producto</div>
          <h2>${escapeHtml(productoNombre)}</h2>
          <div class="detail-sub">${num(clientesQueLoCompran.size)} clientes lo compran · ${num(vendidos.length)} pedidos vendidos</div>
        </div>
        <button class="detail-close" data-close="1" aria-label="Cerrar">×</button>
      </div>

      <div class="detail-body">

        <!-- KPIs -->
        <div class="detail-kpis">
          <div><div class="kpi-label">Ingreso total</div><div class="text-xl font-bold">${money(ingresoTotal)}</div></div>
          <div><div class="kpi-label">Unidades vendidas</div><div class="text-xl font-bold">${num(unidadesVendidas)}</div></div>
          <div><div class="kpi-label">Precio promedio</div><div class="text-xl font-bold">${money(ventasPromUnidad)}</div></div>
          <div><div class="kpi-label">Clientes únicos</div><div class="text-xl font-bold">${num(clientesQueLoCompran.size)}</div></div>
        </div>

        ${sparkData.some((v) => v > 0) ? `
        <div class="detail-section">
          <h3>Ingreso últimos 12 meses</h3>
          <div style="margin-top:.5rem">${sparklineSVG(sparkData, { width: 600, height: 60, color: '#16a34a', fill: 'rgba(22,163,74,.12)' })}</div>
        </div>
        ` : ''}

        ${topClientes.length ? `
        <div class="detail-section">
          <h3>Top clientes que lo compran</h3>
          <table class="detail-table">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th class="text-right">Unidades</th><th class="text-right">Ingreso</th></tr></thead>
            <tbody>
              ${topClientes.map((c) => `
                <tr>
                  <td>${escapeHtml(c.nombre || '—')}</td>
                  <td class="text-ink-500">${escapeHtml(c.telefono || '')}</td>
                  <td class="text-right">${num(c.unidades)}</td>
                  <td class="text-right font-semibold">${money(c.ingreso)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${coCompraOrden.length ? `
        <div class="detail-section">
          <h3>Productos que se compran junto con éste</h3>
          <table class="detail-table">
            <thead><tr><th>Producto</th><th class="text-right">Veces juntos</th></tr></thead>
            <tbody>
              ${coCompraOrden.map(([k, n]) => `
                <tr><td>${escapeHtml(k)}</td><td class="text-right">${num(n)}</td></tr>
              `).join('')}
            </tbody>
          </table>
          <p class="text-xs text-ink-500 mt-2">💡 Idea: ofrece estos como combo o sugerencia.</p>
        </div>
        ` : ''}

        ${vendedoresOrden.length ? `
        <div class="detail-section">
          <h3>Vendedores que más lo venden</h3>
          <table class="detail-table">
            <thead><tr><th>Vendedor</th><th class="text-right">Pedidos</th></tr></thead>
            <tbody>
              ${vendedoresOrden.map(([v, n]) => `
                <tr><td>${escapeHtml(etiquetaVendedor(v))}</td><td class="text-right">${num(n)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Notas privadas -->
        <div class="detail-section">
          <h3>📝 Notas privadas (solo tú las ves)</h3>
          <textarea id="detail-notas" rows="3"
            class="filter-input mt-2"
            placeholder="Ej: subir precio en julio · revisar margen · proveedor alternativo">${escapeHtml(getNota(notaKey))}</textarea>
        </div>

      </div>
    </div>
  `;
  abrirModal(html);

  const notasEl = document.getElementById('detail-notas');
  if (notasEl) {
    notasEl.addEventListener('input', debounce(() => {
      setNota(notaKey, notasEl.value);
    }, 400));
  }
}

// Exportar el cerrador para uso global
export { cerrarModal };
