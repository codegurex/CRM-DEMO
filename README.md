# Tahor Clean CRM — Demo

Versión de demostración pública con datos sintéticos. No conecta a Supabase, todo corre en el navegador.

## Credenciales

- Usuario: `demo@tahorclean.com`
- Contraseña: `demo1234`

Aparecen pre-rellenadas en el login.

## Probar localmente

```bash
cd demo
python -m http.server 8000
# luego abre http://localhost:8000
```

## Desplegar a Vercel (gratis)

### Opción A — Vercel CLI (rápido)

1. Instala la CLI una vez: `npm i -g vercel`
2. Desde la carpeta `demo/`:
   ```bash
   cd demo
   vercel
   ```
3. Responde las preguntas:
   - "Set up and deploy?" → **Y**
   - "Which scope?" → tu cuenta personal o el team
   - "Link to existing project?" → **N**
   - "Project name?" → `tahor-crm-demo`
   - "In which directory?" → **./** (Enter)
4. Vercel desplegará y te dará una URL pública tipo `https://tahor-crm-demo.vercel.app`

Para futuros despliegues: `vercel --prod` desde `demo/`.

### Opción B — Vercel Dashboard (sin CLI)

1. Sube tu repo a GitHub si no está
2. Entra a [vercel.com/new](https://vercel.com/new) → conecta GitHub → importa el repo
3. En **Root Directory** pon `demo`
4. Framework Preset: **Other**
5. Deploy

Vercel re-desplegará automáticamente cada vez que hagas push.

### Dominio personalizado (opcional)

Si quieres `demo.tahorclean.com` en lugar del `.vercel.app`:
- Vercel → Project → Settings → Domains → Add → escribe `demo.tahorclean.com`
- Te dará un CNAME que apuntar desde tu proveedor de DNS

## Compartir con clientes

Una vez desplegado, comparte solo el link. Las credenciales ya están a la vista, el cliente solo da click en "Entrar al demo".

## Mantenimiento

Si quieres más/menos pedidos o cambiar los datos de ejemplo, edita `js/mock-data.js`:
- `generarPedidos(85)` — cambia el número total
- `PRODUCTOS` — agrega/quita productos
- `CLIENTES` — modifica los clientes ficticios
- `makeRng(2026)` — cambia la semilla para regenerar datos distintos
