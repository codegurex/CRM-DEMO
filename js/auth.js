// =============================================================
// auth.js — MOCK para el DEMO
//
// Solo acepta las credenciales demo definidas en config.js.
// La "sesión" vive en sessionStorage durante la visita.
// =============================================================
import { CONFIG } from './config.js';

const KEY = 'tahor_demo_session';

export async function getSession() {
  return sessionStorage.getItem(KEY) ? { user: { email: CONFIG.DEMO_USER } } : null;
}

async function signIn(email, password) {
  if (email.trim().toLowerCase() !== CONFIG.DEMO_USER.toLowerCase() || password !== CONFIG.DEMO_PASS) {
    const err = new Error('Invalid login credentials');
    throw err;
  }
  sessionStorage.setItem(KEY, '1');
  return { user: { email: CONFIG.DEMO_USER } };
}

export async function signOut() {
  sessionStorage.removeItem(KEY);
  location.reload();
}

export function onAuthChange() { /* no-op en demo */ return { data: { subscription: { unsubscribe() {} } } }; }

// =============================================================
// UI: pantalla de login con credenciales pre-rellenadas y visibles
// =============================================================
export function mostrarLogin({ onSuccess }) {
  document.body.classList.add('locked');
  let overlay = document.getElementById('login-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.innerHTML = `
      <div class="login-card">
        <div class="login-brand">
          <img src="img/logo.ico" alt="Tahor Clean" class="login-logo" />
          <span class="font-bold">Tahor Clean · CRM</span>
        </div>
        <h1 class="login-title">Versión Demo</h1>
        <p class="login-sub">Credenciales ya pre-cargadas — solo da click en Entrar</p>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:.5rem;padding:.7rem .9rem;margin-bottom:1rem;font-size:.8rem;color:#1e40af">
          <div style="font-weight:600;margin-bottom:.25rem">🔑 Credenciales del demo</div>
          <div>Usuario: <code style="background:#dbeafe;padding:.05rem .35rem;border-radius:.25rem">${CONFIG.DEMO_USER}</code></div>
          <div>Contraseña: <code style="background:#dbeafe;padding:.05rem .35rem;border-radius:.25rem">${CONFIG.DEMO_PASS}</code></div>
        </div>

        <form id="login-form" class="login-form" autocomplete="off" novalidate>
          <label class="filter-label">Correo</label>
          <input id="login-email" type="email" required class="filter-input" value="${CONFIG.DEMO_USER}" autocomplete="off" />
          <label class="filter-label">Contraseña</label>
          <input id="login-password" type="password" required class="filter-input" value="${CONFIG.DEMO_PASS}" autocomplete="off" />
          <div id="login-error" class="login-error hidden"></div>
          <button type="submit" id="login-submit">Entrar al demo</button>
          <p style="margin-top:1rem;font-size:.7rem;color:#94a3b8">
            🛈 Este es un entorno de demostración con datos ficticios.
            <br>Los cambios que hagas no se guardan al cerrar sesión.
          </p>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#login-email').value;
      const password = overlay.querySelector('#login-password').value;
      const btn = overlay.querySelector('#login-submit');
      const err = overlay.querySelector('#login-error');
      err.classList.add('hidden');
      btn.disabled = true;
      btn.textContent = 'Entrando…';
      try {
        await signIn(email, password);
        ocultarLogin();
        onSuccess?.();
      } catch (ex) {
        err.textContent = 'Correo o contraseña incorrectos. Usa los del recuadro azul.';
        err.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar al demo';
      }
    });
  }
  overlay.style.display = 'flex';
}

export function ocultarLogin() {
  document.body.classList.remove('locked');
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
}
