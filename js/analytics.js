// =============================================================
// analytics.js — Cálculos derivados (KPIs, agregaciones, top)
//
// Se hace todo en cliente sobre el dataset filtrado: simple,
// reactivo (los filtros cambian → todo recalcula), y suficiente
// para volúmenes < ~50k pedidos. Si el volumen crece, mover
// estas funciones a vistas SQL en Supabase (ver sql/views.sql).
// =============================================================
import { lastMonths, monthKey } from './utils.js';

const SIN_ASIGNAR = 'Sin asignar';

export function computeKPIs(pedidos) {
  const total      = pedidos.length;
  const vendidos   = pedidos.filter((p) => p.estado === 'vendido');
  const ventas     = vendidos.reduce((s, p) => s + p.total, 0);
  const conversion = total ? (vendidos.length / total) * 100 : 0;
  const ticket     = vendidos.length ? ventas / vendidos.length : 0;
  return { total, vendidos: vendidos.length, ventas, conversion, ticket };
}

// Serie mensual de ventas (solo pedidos vendidos), últimos 12 meses
// si no hay rango aplicado, o todo el rango si se aplicó.
export function ventasPorMes(pedidos) {
  const map = new Map();
  for (const p of pedidos) {
    if (p.estado !== 'vendido') continue;
    const k = monthKey(p.fecha);
    map.set(k, (map.get(k) || 0) + p.total);
  }
  const keys = map.size <= 12 ? lastMonths(12) : Array.from(map.keys()).sort();
  return keys.map((k) => ({ key: k, value: map.get(k) || 0 }));
}

export function ventasPorVendedor(pedidos) {
  const map = new Map();
  for (const p of pedidos) {
    if (p.estado !== 'vendido') continue;
    const k = p.vendedor || SIN_ASIGNAR;
    map.set(k, (map.get(k) || 0) + p.total);
  }
  return Array.from(map, ([vendedor, total]) => ({ vendedor, total }))
              .sort((a, b) => b.total - a.total);
}

// Métricas por vendedor (para vista de comparación).
export function metricasPorVendedor(pedidos) {
  const buckets = new Map();
  for (const p of pedidos) {
    const v = p.vendedor || SIN_ASIGNAR;
    if (!buckets.has(v)) {
      buckets.set(v, { vendedor: v, pedidos: 0, vendidos: 0, ventas: 0 });
    }
    const b = buckets.get(v);
    b.pedidos++;
    if (p.estado === 'vendido') {
      b.vendidos++;
      b.ventas += p.total;
    }
  }
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    conversion: b.pedidos ? (b.vendidos / b.pedidos) * 100 : 0,
    ticket: b.vendidos ? b.ventas / b.vendidos : 0,
  })).sort((a, b) => b.ventas - a.ventas);
}

// Top productos por unidades e ingreso, considerando solo pedidos vendidos.
export function topProductos(pedidos, { limit = 10, soloVendidos = true } = {}) {
  const map = new Map();
  for (const p of pedidos) {
    if (soloVendidos && p.estado !== 'vendido') continue;
    for (const d of p.detalle) {
      const k = d.producto || '—';
      if (!map.has(k)) map.set(k, { producto: k, unidades: 0, ingreso: 0, pedidos: new Set() });
      const b = map.get(k);
      b.unidades += d.cantidad;
      b.ingreso  += d.subtotal;
      b.pedidos.add(p.id);
    }
  }
  const arr = Array.from(map.values()).map((b) => ({
    producto: b.producto,
    unidades: b.unidades,
    ingreso:  b.ingreso,
    pedidos:  b.pedidos.size,
  }));
  return {
    porUnidades: [...arr].sort((a, b) => b.unidades - a.unidades).slice(0, limit),
    porIngreso:  [...arr].sort((a, b) => b.ingreso  - a.ingreso ).slice(0, limit),
    todos:       arr.sort((a, b) => b.ingreso - a.ingreso),
  };
}

// =============================================================
// Helpers de fechas y comparativos
// =============================================================
const DAY = 1000 * 60 * 60 * 24;
const _now = () => new Date();

export function rangoMesActual() {
  const n = _now();
  const ini = new Date(n.getFullYear(), n.getMonth(), 1);
  return { ini, fin: n };
}

export function pedidosEntre(pedidos, ini, fin) {
  return pedidos.filter((p) => {
    const d = new Date(p.fecha);
    return d >= ini && d <= fin;
  });
}

// Comparativo de KPIs: últimos N días vs N días anteriores.
// Devuelve cada KPI con su delta % para mostrar ▲▼.
export function comparativaKPIs(pedidos, dias = 30) {
  const fin = _now();
  const inicioActual    = new Date(fin.getTime() - dias * DAY);
  const inicioAnterior  = new Date(fin.getTime() - dias * 2 * DAY);

  const actual    = pedidosEntre(pedidos, inicioActual, fin);
  const anterior  = pedidosEntre(pedidos, inicioAnterior, inicioActual);

  const k = computeKPIs(actual);
  const p = computeKPIs(anterior);

  const delta = (a, b) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

  return {
    dias,
    ventas:     { valor: k.ventas,     anterior: p.ventas,     delta: delta(k.ventas, p.ventas) },
    pedidos:    { valor: k.total,      anterior: p.total,      delta: delta(k.total, p.total) },
    conversion: { valor: k.conversion, anterior: p.conversion, delta: k.conversion - p.conversion },
    ticket:     { valor: k.ticket,     anterior: p.ticket,     delta: delta(k.ticket, p.ticket) },
  };
}

// Serie diaria de ventas (totales por día) de los últimos N días.
// Útil para sparklines en cada KPI.
export function serieDiariaVentas(pedidos, dias = 30) {
  const fin = _now();
  const arr = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(fin.getTime() - i * DAY);
    d.setHours(0, 0, 0, 0);
    arr.push({ fecha: d, total: 0, pedidos: 0 });
  }
  for (const p of pedidos) {
    const f = new Date(p.fecha);
    f.setHours(0, 0, 0, 0);
    const idx = arr.findIndex((b) => b.fecha.getTime() === f.getTime());
    if (idx >= 0) {
      arr[idx].pedidos++;
      if (p.estado === 'vendido') arr[idx].total += p.total;
    }
  }
  return arr;
}

// Proyección lineal: ventas estimadas a fin de mes con el ritmo actual.
export function proyeccionMes(pedidos) {
  const { ini, fin } = rangoMesActual();
  const enMes = pedidosEntre(pedidos, ini, fin).filter((p) => p.estado === 'vendido');
  const ventasMes  = enMes.reduce((s, p) => s + p.total, 0);
  const finMes     = new Date(fin.getFullYear(), fin.getMonth() + 1, 0);
  const diasMes    = finMes.getDate();
  const diasPasados = fin.getDate();
  const proyeccion = diasPasados > 0 ? (ventasMes / diasPasados) * diasMes : 0;
  return { ventasMes, proyeccion, diasMes, diasPasados, pedidosMes: enMes.length };
}

// Mes anterior — para comparar el actual contra él
export function ventasMesAnterior(pedidos) {
  const n = _now();
  const ini = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const fin = new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59);
  return pedidosEntre(pedidos, ini, fin)
    .filter((p) => p.estado === 'vendido')
    .reduce((s, p) => s + p.total, 0);
}

// Tops del mes (vendedor, producto, cliente)
export function topsDelMes(pedidos) {
  const { ini, fin } = rangoMesActual();
  const enMes = pedidosEntre(pedidos, ini, fin);

  // Vendedor
  const mv = new Map();
  for (const p of enMes) {
    if (p.estado !== 'vendido') continue;
    const k = p.vendedor || 'Sin asignar';
    mv.set(k, (mv.get(k) || 0) + p.total);
  }
  const topVendedor = [...mv].sort((a, b) => b[1] - a[1])[0];

  // Producto (por ingreso)
  const mp = new Map();
  for (const p of enMes) {
    if (p.estado !== 'vendido') continue;
    for (const d of p.detalle) {
      mp.set(d.producto || '—', (mp.get(d.producto || '—') || 0) + d.subtotal);
    }
  }
  const topProducto = [...mp].sort((a, b) => b[1] - a[1])[0];

  // Cliente (por total)
  const mc = new Map();
  for (const p of enMes) {
    if (p.estado !== 'vendido') continue;
    const k = p.cliente_id ?? p.cliente_nombre;
    if (!mc.has(k)) {
      mc.set(k, { nombre: p.cliente_nombre, telefono: p.cliente_telefono, total: 0, pedidos: 0 });
    }
    const b = mc.get(k);
    b.total += p.total;
    b.pedidos++;
  }
  const topCliente = [...mc.values()].sort((a, b) => b.total - a.total)[0];

  return {
    vendedor: topVendedor ? { nombre: topVendedor[0], total: topVendedor[1] } : null,
    producto: topProducto ? { nombre: topProducto[0], total: topProducto[1] } : null,
    cliente:  topCliente  || null,
  };
}

// Alertas inteligentes ordenadas por urgencia.
// Devuelve hasta `limit` items con { nivel, icono, titulo, detalle }.
export function alertasInteligentes(pedidos, { limit = 4 } = {}) {
  const alertas = [];

  // 1) Caída de ventas vs mes anterior
  const proj = proyeccionMes(pedidos);
  const previo = ventasMesAnterior(pedidos);
  if (previo > 0 && proj.proyeccion < previo * 0.7 && proj.diasPasados >= 7) {
    alertas.push({
      nivel: 'rojo',
      icono: '📉',
      titulo: 'Caída fuerte de ventas',
      detalle: `Proyección de mes ($${proj.proyeccion.toFixed(0)}) está ${(((previo - proj.proyeccion) / previo) * 100).toFixed(0)}% por debajo del mes anterior ($${previo.toFixed(0)}).`,
    });
  } else if (previo > 0 && proj.proyeccion > previo * 1.3 && proj.diasPasados >= 7) {
    alertas.push({
      nivel: 'verde',
      icono: '🚀',
      titulo: 'Mes con buen ritmo',
      detalle: `Proyección ${(((proj.proyeccion - previo) / previo) * 100).toFixed(0)}% mayor al mes anterior. Mantener acciones.`,
    });
  }

  // 2) Días sin pedidos nuevos
  const ahora = _now();
  const ultimo = pedidos
    .map((p) => new Date(p.fecha))
    .filter((d) => !isNaN(d))
    .sort((a, b) => b - a)[0];
  if (ultimo) {
    const diasSinPedidos = Math.floor((ahora - ultimo) / DAY);
    if (diasSinPedidos >= 7) {
      alertas.push({
        nivel: 'rojo',
        icono: '🚨',
        titulo: `${diasSinPedidos} días sin pedidos nuevos`,
        detalle: 'Revisar el formulario de la web y campañas activas.',
      });
    } else if (diasSinPedidos >= 3) {
      alertas.push({
        nivel: 'amarillo',
        icono: '⏳',
        titulo: `${diasSinPedidos} días sin pedidos`,
        detalle: 'Volumen reducido. Considera enviar promo a clientes habituales.',
      });
    }
  }

  // 3) Cliente VIP en riesgo (top histórico, sin compra reciente)
  const porCliente = new Map();
  for (const p of pedidos) {
    if (p.estado !== 'vendido') continue;
    const k = p.cliente_id ?? p.cliente_nombre;
    if (!porCliente.has(k)) {
      porCliente.set(k, {
        nombre: p.cliente_nombre, fechas: [], total: 0,
      });
    }
    const b = porCliente.get(k);
    b.fechas.push(new Date(p.fecha));
    b.total += p.total;
  }
  const vipsEnRiesgo = [];
  for (const c of porCliente.values()) {
    if (c.fechas.length < 2) continue;
    c.fechas.sort((a, b) => a - b);
    const ints = [];
    for (let i = 1; i < c.fechas.length; i++) ints.push((c.fechas[i] - c.fechas[i - 1]) / DAY);
    const prom = ints.reduce((s, x) => s + x, 0) / ints.length;
    const dias = (ahora - c.fechas[c.fechas.length - 1]) / DAY;
    if (dias > prom * 1.5 && dias >= 30) {
      vipsEnRiesgo.push({ ...c, dias: Math.round(dias), prom: Math.round(prom) });
    }
  }
  vipsEnRiesgo.sort((a, b) => b.total - a.total);
  if (vipsEnRiesgo[0]) {
    const v = vipsEnRiesgo[0];
    alertas.push({
      nivel: 'amarillo',
      icono: '👤',
      titulo: `Cliente VIP en riesgo: ${v.nombre}`,
      detalle: `Compraba cada ~${v.prom} días. Lleva ${v.dias} sin pedir. Total histórico: $${v.total.toFixed(0)}.`,
    });
  }

  // 4) Producto con caída fuerte (era top y bajó)
  const fin = _now();
  const ini30 = new Date(fin.getTime() - 30 * DAY);
  const ini60 = new Date(fin.getTime() - 60 * DAY);
  const acum = (arr) => {
    const m = new Map();
    for (const p of arr) {
      if (p.estado !== 'vendido') continue;
      for (const d of p.detalle) {
        m.set(d.producto || '—', (m.get(d.producto || '—') || 0) + d.subtotal);
      }
    }
    return m;
  };
  const A = acum(pedidosEntre(pedidos, ini30, fin));
  const B = acum(pedidosEntre(pedidos, ini60, ini30));
  const productoBajada = [];
  for (const [k, vB] of B) {
    if (vB < 50) continue;
    const vA = A.get(k) || 0;
    if (vA < vB * 0.6) {
      productoBajada.push({ producto: k, antes: vB, ahora: vA, baja: ((vB - vA) / vB) * 100 });
    }
  }
  productoBajada.sort((a, b) => b.antes - a.antes);
  if (productoBajada[0]) {
    const p = productoBajada[0];
    alertas.push({
      nivel: 'amarillo',
      icono: '📦',
      titulo: `Producto en caída: ${p.producto}`,
      detalle: `Cayó ${p.baja.toFixed(0)}% (de $${p.antes.toFixed(0)} a $${p.ahora.toFixed(0)} en 30 días).`,
    });
  }

  // Si todo está bien, mensaje positivo
  if (alertas.length === 0) {
    alertas.push({
      nivel: 'verde',
      icono: '✅',
      titulo: 'Todo bajo control',
      detalle: 'Sin alertas críticas. Buen momento para revisar oportunidades.',
    });
  }

  // Ordenar por nivel: rojo > amarillo > verde
  const orden = { rojo: 0, amarillo: 1, verde: 2 };
  alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
  return alertas.slice(0, limit);
}

// Top clientes (solo pedidos vendidos, suma de totales).
export function topClientes(pedidos, limit = 10) {
  const map = new Map();
  for (const p of pedidos) {
    if (p.estado !== 'vendido') continue;
    const k = p.cliente_id ?? p.cliente_nombre;
    if (!map.has(k)) {
      map.set(k, {
        cliente_id: p.cliente_id,
        nombre: p.cliente_nombre,
        telefono: p.cliente_telefono,
        pedidos: 0,
        total: 0,
      });
    }
    const b = map.get(k);
    b.pedidos++;
    b.total += p.total;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, limit);
}
