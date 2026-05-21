// =============================================================
// utils.js — Helpers de formato, fechas y DOM
// =============================================================
import { CONFIG } from './config.js';

const fmtMoney = new Intl.NumberFormat(CONFIG.LOCALE, {
  style: 'currency',
  currency: CONFIG.CURRENCY,
  maximumFractionDigits: 2,
});
const fmtNum = new Intl.NumberFormat(CONFIG.LOCALE);

export const money = (n) => fmtMoney.format(Number(n) || 0);
export const num   = (n) => fmtNum.format(Number(n) || 0);
export const pct   = (n, d = 1) => `${(Number(n) || 0).toFixed(d)}%`;

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(CONFIG.LOCALE, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(CONFIG.LOCALE, {
    day: '2-digit', month: 'short',
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Devuelve { from, to } como YYYY-MM-DD para un rango predefinido.
export function rangeFor(key) {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const iso = (dt) => dt.toISOString().slice(0, 10);

  switch (key) {
    case 'today':
      return { from: iso(new Date(y, m, d)), to: iso(today) };
    case '7d':
      return { from: iso(new Date(y, m, d - 6)), to: iso(today) };
    case '30d':
      return { from: iso(new Date(y, m, d - 29)), to: iso(today) };
    case 'month':
      return { from: iso(new Date(y, m, 1)), to: iso(today) };
    case 'ytd':
      return { from: iso(new Date(y, 0, 1)), to: iso(today) };
    case 'all':
    default:
      return { from: '', to: '' };
  }
}

// Convierte 'YYYY-MM-DD' del input a límites ISO para query (UTC-friendly).
export function isoStartOfDay(s) { return s ? `${s}T00:00:00` : null; }
export function isoEndOfDay(s)   { return s ? `${s}T23:59:59.999` : null; }

// Agrupa una lista por una clave.
export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// Selecciona DOM corto.
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Simple debounce.
export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Toast simple.
export function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), ms);
}

// Escape básico para insertar texto en HTML.
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Devuelve la clave YYYY-MM de una fecha ISO.
export const monthKey = (iso) => (iso ? iso.slice(0, 7) : '');

// Genera los últimos N meses como ['YYYY-MM', ...] cronológicamente.
export function lastMonths(n = 12) {
  const arr = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    arr.push(dt.toISOString().slice(0, 7));
  }
  return arr;
}

// Sparkline mini-chart como SVG inline. Devuelve string HTML.
// values: array de números. opciones: { width, height, color, fill }.
export function sparklineSVG(values, opts = {}) {
  const w = opts.width  || 120;
  const h = opts.height || 32;
  const color = opts.color || '#2563eb';
  const fill  = opts.fill  || 'rgba(37,99,235,.12)';

  const vals = values.length ? values : [0, 0];
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const stepX = vals.length > 1 ? w / (vals.length - 1) : 0;

  const points = vals.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;

  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <path d="${area}" fill="${fill}" stroke="none"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(CONFIG.LOCALE, {
    month: 'short', year: '2-digit',
  });
}

// -----------------------------------------------------------
// Vendedor + Tienda
// -----------------------------------------------------------
// tiendaDeVendedor('Juan') → 'Norte' (o '' si no está en el mapeo)
export function tiendaDeVendedor(vendedor) {
  if (!vendedor) return '';
  return CONFIG.VENDEDOR_TIENDA?.[vendedor] || '';
}

// etiquetaVendedor('Juan') → 'Juan · Norte'  (o 'Juan' si no tiene tienda)
// etiquetaVendedor(null)   → 'Sin asignar'
export function etiquetaVendedor(vendedor) {
  if (!vendedor) return 'Sin asignar';
  const tienda = tiendaDeVendedor(vendedor);
  return tienda ? `${vendedor} · ${tienda}` : vendedor;
}
