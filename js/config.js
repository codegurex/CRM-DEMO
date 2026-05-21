// =============================================================
// CONFIG del DEMO — NO conecta a Supabase real.
// Todo viene de mock-data.js
// =============================================================

export const CONFIG = {
  // Valores ficticios para pasar el banner de configuración
  SUPABASE_URL:  'https://demo.local',
  SUPABASE_ANON: 'demo-key',

  ESTADOS: ['en_espera', 'vendido', 'no_vendido'],
  CURRENCY: 'USD',
  LOCALE:   'es-EC',
  DATE_COLUMN: 'created_at',
  TABLES: { clientes: 'clientes', pedidos: 'pedidos', detalle: 'detalle_pedido' },

  VENDEDOR_TIENDA: {
    CINTHIA:  'ALTAGRACIA',
    MERCEDES: 'MATRIZ',
    SILVIA:   'PORTOVIEJO',
    GENESIS:  'MONTECRISTI',
    MERLY:    'JARAMIJO',
  },

  // Flag de demo (usado por auth.js y otros)
  DEMO: true,
  DEMO_USER:    'demo@tahorclean.com',
  DEMO_PASS:    'demo1234',
};
