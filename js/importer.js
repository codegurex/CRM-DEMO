// =============================================================
// importer.js — STUB del DEMO
//
// En la versión completa permite subir Excel de Picking.
// Aquí mostramos un mensaje amable explicando que no aplica
// en el demo.
// =============================================================
import { escapeHtml } from './utils.js';

export function abrirImportador() {
  let overlay = document.getElementById('detail-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'detail-overlay';
    overlay.className = 'detail-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target.id === 'detail-overlay' || e.target.dataset.close === '1') {
        overlay.classList.remove('show');
        setTimeout(() => { overlay.innerHTML = ''; }, 200);
        document.body.style.overflow = '';
      }
    });
  }
  overlay.innerHTML = `
    <div class="detail-modal" style="max-width: 560px;">
      <div class="detail-head">
        <div>
          <div class="detail-eyebrow">Importar</div>
          <h2>No disponible en el demo</h2>
        </div>
        <button class="detail-close" data-close="1">×</button>
      </div>
      <div class="detail-body">
        <div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:.5rem;padding:1rem;margin-bottom:1rem">
          <strong>Esta función está limitada en el entorno de demostración.</strong>
        </div>
        <p class="text-sm text-ink-500" style="line-height:1.55">
          En la versión completa de Tahor Clean CRM puedes:
        </p>
        <ul style="margin-top:.75rem;padding-left:1.25rem;color:#475569;font-size:.875rem;line-height:1.7">
          <li>📊 Subir Excel de ventas por vendedor (un archivo por local)</li>
          <li>👥 Importar el catálogo completo de clientes con teléfono y correo</li>
          <li>🔁 Deduplicar automáticamente facturas ya cargadas</li>
          <li>📅 Conservar las fechas reales de las facturas</li>
          <li>📈 Ver KPIs actualizados al instante</li>
        </ul>
        <div style="margin-top:1.5rem;text-align:right">
          <button class="detail-btn" data-close="1">Entendido</button>
        </div>
      </div>
    </div>
  `;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}
