// =============================================================
// charts.js — Wrapper sobre Chart.js, instancia única por canvas
// =============================================================
import { money, num, monthLabel } from './utils.js';

const instances = {};

const palette = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
];

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0b1220',
      padding: 10,
      titleFont: { weight: '600' },
      cornerRadius: 8,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b' } },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: {
        color: '#64748b',
        callback: (v) => num(v),
      },
      beginAtZero: true,
    },
  },
};

function destroy(id) {
  if (instances[id]) { instances[id].destroy(); delete instances[id]; }
}

export function renderLineVentas(canvasId, serie) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, 'rgba(37,99,235,.25)');
  grad.addColorStop(1, 'rgba(37,99,235,0)');

  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: serie.map((p) => monthLabel(p.key)),
      datasets: [{
        label: 'Ventas',
        data: serie.map((p) => p.value),
        borderColor: '#2563eb',
        backgroundColor: grad,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: '#2563eb',
        pointHoverRadius: 5,
      }],
    },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        tooltip: {
          ...baseOpts.plugins.tooltip,
          callbacks: { label: (c) => ` ${money(c.parsed.y)}` },
        },
      },
      scales: {
        ...baseOpts.scales,
        y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: (v) => money(v) } },
      },
    },
  });
}

export function renderBarVendedor(canvasId, data) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  instances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map((d) => d.vendedor),
      datasets: [{
        data: data.map((d) => d.total),
        backgroundColor: palette,
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: { label: (c) => ` ${c.label}: ${money(c.parsed)}` },
          backgroundColor: '#0b1220', cornerRadius: 8,
        },
      },
      cutout: '62%',
    },
  });
}

export function renderBarProductos(canvasId, items, valueKey = 'unidades', label = 'Unidades') {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map((i) => truncate(i.producto, 22)),
      datasets: [{
        label,
        data: items.map((i) => i[valueKey]),
        backgroundColor: palette[0],
        borderRadius: 6,
        maxBarThickness: 28,
      }],
    },
    options: {
      ...baseOpts,
      indexAxis: 'y',
      plugins: {
        ...baseOpts.plugins,
        tooltip: {
          ...baseOpts.plugins.tooltip,
          callbacks: {
            label: (c) => ` ${valueKey === 'ingreso' ? money(c.parsed.x) : num(c.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            callback: (v) => valueKey === 'ingreso' ? money(v) : num(v),
          },
          beginAtZero: true,
        },
        y: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

export function renderVendedoresCompare(canvasId, metricas) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: metricas.map((m) => m.vendedor),
      datasets: [
        { label: 'Ventas',    data: metricas.map((m) => m.ventas),    backgroundColor: palette[0], borderRadius: 6 },
        { label: 'Pedidos',   data: metricas.map((m) => m.pedidos),   backgroundColor: palette[1], borderRadius: 6, yAxisID: 'y1' },
      ],
    },
    options: {
      ...baseOpts,
      plugins: {
        ...baseOpts.plugins,
        legend: { display: true, position: 'top', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          ...baseOpts.plugins.tooltip,
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${c.dataset.label === 'Ventas' ? money(c.parsed.y) : num(c.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
        y: {
          position: 'left',
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', callback: (v) => money(v) },
          beginAtZero: true,
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: { color: '#64748b', callback: (v) => num(v) },
          beginAtZero: true,
        },
      },
    },
  });
}

function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
