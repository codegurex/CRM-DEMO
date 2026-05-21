// =============================================================
// supabase-client.js — MOCK para el DEMO
//
// Reemplaza al cliente real de Supabase. Devuelve datos sintéticos
// de mock-data.js. Soporta las mismas funciones que el original
// para que el resto del CRM no se entere de que es un demo.
// =============================================================

import { MOCK_PEDIDOS } from './mock-data.js';

// API "estilo Supabase" muy reducida (solo lo que usa el CRM)
// — no necesitamos cliente real; pasamos un objeto vacío.
export const sb = {
  auth: {}, // los hooks de auth los manejamos en auth.js mock
  channel: () => ({
    on() { return this; },
    subscribe(cb) { cb?.('SUBSCRIBED'); return this; },
  }),
  removeChannel: () => {},
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: [], error: null }),
    upsert: () => Promise.resolve({ data: [], error: null }),
  }),
};

// Pequeño delay para que se sienta como una request real (UX)
const fakeDelay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

// Estado mutable en memoria — permite que cambios de estado
// (vendido/no_vendido) durante la demo se reflejen
let pedidosMem = JSON.parse(JSON.stringify(MOCK_PEDIDOS));

function aplicarFiltros(rows, filters) {
  let r = rows;
  if (filters.from) {
    const from = new Date(filters.from + 'T00:00:00');
    r = r.filter((p) => new Date(p.fecha) >= from);
  }
  if (filters.to) {
    const to = new Date(filters.to + 'T23:59:59');
    r = r.filter((p) => new Date(p.fecha) <= to);
  }
  if (filters.estado)   r = r.filter((p) => p.estado === filters.estado);
  if (filters.vendedor === null)  r = r.filter((p) => !p.vendedor);
  else if (filters.vendedor)      r = r.filter((p) => p.vendedor === filters.vendedor);
  if (filters.producto) {
    const needle = filters.producto.toLowerCase();
    r = r.filter((p) => p.detalle.some((d) => (d.producto || '').toLowerCase().includes(needle)));
  }
  return r;
}

export async function fetchPedidos(filters = {}) {
  await fakeDelay();
  return aplicarFiltros(pedidosMem, filters);
}

export async function updateEstado(pedidoId, nuevoEstado) {
  await fakeDelay(120);
  const p = pedidosMem.find((x) => String(x.id) === String(pedidoId));
  if (p) p.estado = nuevoEstado;
}

export async function updatePedido(pedidoId, patch) {
  await fakeDelay(120);
  const p = pedidosMem.find((x) => String(x.id) === String(pedidoId));
  if (p) Object.assign(p, patch);
}

// Realtime: nunca llega nada en el demo, pero "Conectado" para que se vea bien
export function subscribePedidos({ onStatus }) {
  setTimeout(() => onStatus?.('SUBSCRIBED'), 200);
  return () => {};
}
