// =============================================================
// mock-data.js — Dataset sintético para el DEMO
//
// Genera ~80 pedidos en los últimos 90 días con datos realistas:
// 5 vendedores en 5 tiendas, ~20 clientes (mix de empresas y
// personas), 8 productos típicos de limpieza.
//
// Generación determinística (mismo PRNG con semilla fija) →
// el demo se ve siempre igual.
// =============================================================

const VENDEDORES = ['CINTHIA', 'MERCEDES', 'SILVIA', 'GENESIS', 'MERLY'];

// PRNG determinístico (mulberry32) — semilla fija para que el demo no cambie
function makeRng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(2026);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + rng() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));

const PRODUCTOS = [
  { producto: 'Cloro Industrial 5L',       codigo: 'TC-CLO-5L',   precio: 8.50  },
  { producto: 'Detergente Líquido 4L',     codigo: 'TC-DET-4L',   precio: 12.00 },
  { producto: 'Jabón Antibacterial 1L',    codigo: 'TC-JAB-1L',   precio: 4.50  },
  { producto: 'Desinfectante Multiusos 1L',codigo: 'TC-DES-1L',   precio: 5.25  },
  { producto: 'Quita Sarro 1L',            codigo: 'TC-QSR-1L',   precio: 6.00  },
  { producto: 'Cera Líquida 5L',           codigo: 'TC-CER-5L',   precio: 15.50 },
  { producto: 'Limpia Vidrios 1L',         codigo: 'TC-LVD-1L',   precio: 3.75  },
  { producto: 'Desengrasante 1L',          codigo: 'TC-DSG-1L',   precio: 7.25  },
];

// 20 clientes con perfil realista
const CLIENTES = [
  // 5 empresas mayoristas — tickets grandes, compras frecuentes
  { id: 1,  nombre: 'EMPACADORA MADEZA S.A',                  cedula: '1391765770001', telefono: '052381839',  perfil: 'mayorista' },
  { id: 2,  nombre: 'PRODUCTOS PERECIBLES PROPEMAR',           cedula: '1391730845001', telefono: '0993868872', perfil: 'mayorista' },
  { id: 3,  nombre: 'DEXICON S.A.',                            cedula: '1391926499001', telefono: '052623145',  perfil: 'mayorista' },
  { id: 4,  nombre: 'PUERTOMAR S.A',                           cedula: '1391799101001', telefono: '052625900',  perfil: 'mayorista' },
  { id: 5,  nombre: 'HOTEL SAIL PLAZA',                        cedula: '0992855592001', telefono: '052622222',  perfil: 'mayorista' },
  // 8 negocios medianos
  { id: 6,  nombre: 'LOPEZ RUIZ CARLOS',                       cedula: '1303534505001', telefono: '0996359732', perfil: 'mediano' },
  { id: 7,  nombre: 'FLORES TUMBACO CESAR',                    cedula: '1311360505001', telefono: '0985220528', perfil: 'mediano' },
  { id: 8,  nombre: 'PANCHANA ALFREDO',                        cedula: '1312284878001', telefono: '0995467229', perfil: 'mediano' },
  { id: 9,  nombre: 'CEVALLOS GARCIA LETTY',                   cedula: '1311334229001', telefono: '0994123456', perfil: 'mediano' },
  { id: 10, nombre: 'VILLALVA QUIROZ GEOVANNY',                cedula: '1306668680001', telefono: '0996782345', perfil: 'mediano' },
  { id: 11, nombre: 'MENDOZA VELEZ ROCIO',                     cedula: '1303696643001', telefono: '0998765432', perfil: 'mediano' },
  { id: 12, nombre: 'BAVARIA GROUP',                           cedula: '1391936870001', telefono: '0993321456', perfil: 'mediano' },
  { id: 13, nombre: 'KINTSUGI GROUP S.A.S.',                   cedula: '1793195930001', telefono: '022456789',  perfil: 'mediano' },
  // 5 personas naturales — tickets pequeños
  { id: 14, nombre: 'BARCIA DIEGO',                            cedula: '1311546111',    telefono: '0987654321', perfil: 'persona' },
  { id: 15, nombre: 'FLORES EDWIN',                            cedula: '1308854908',    telefono: '0986543210', perfil: 'persona' },
  { id: 16, nombre: 'FRANCO DELGADO EDGAR',                    cedula: '1311512808',    telefono: '0985432109', perfil: 'persona' },
  { id: 17, nombre: 'CEDEÑO HOLGUIN FERNANDO',                 cedula: '1311461782',    telefono: '0984321098', perfil: 'persona' },
  { id: 18, nombre: 'TAMBACO INA',                             cedula: '0800305559',    telefono: '0983210987', perfil: 'persona' },
  // 2 CONSUMIDOR FINAL
  { id: 19, nombre: 'CONSUMIDOR FINAL',                        cedula: '9999999999',    telefono: null,         perfil: 'consumidor' },
  { id: 20, nombre: 'ALCIVAR JOSE',                            cedula: '1306966027',    telefono: '0996123987', perfil: 'persona' },
];

const ESTADOS = ['vendido', 'vendido', 'vendido', 'vendido', 'vendido', 'vendido', 'vendido', 'en_espera', 'en_espera', 'no_vendido'];

// Genera N pedidos en los últimos 90 días
function generarPedidos(n) {
  const pedidos = [];
  const ahora = new Date();
  let nextId = 1000;
  let nextFactura = 5000;

  for (let i = 0; i < n; i++) {
    const cliente = pick(CLIENTES);
    const vendedor = pick(VENDEDORES);
    const diasAtras = intBetween(0, 90);
    const fecha = new Date(ahora.getTime() - diasAtras * 86400000);
    // Variación horaria
    fecha.setHours(intBetween(8, 19), intBetween(0, 59), 0, 0);

    // Estado base: el mix de ESTADOS. Para mayoristas, más probabilidad de vendido.
    let estado = pick(ESTADOS);
    if (cliente.perfil === 'mayorista' && estado === 'no_vendido') estado = 'vendido';

    // Generar 1-4 ítems de productos
    const nItems = cliente.perfil === 'mayorista' ? intBetween(3, 6)
                : cliente.perfil === 'mediano'    ? intBetween(2, 4)
                :                                    intBetween(1, 2);
    const productosUsados = new Set();
    const detalle = [];
    let totalCalc = 0;
    for (let j = 0; j < nItems; j++) {
      let prod = pick(PRODUCTOS);
      // Evitar duplicar productos en el mismo pedido
      let attempts = 0;
      while (productosUsados.has(prod.codigo) && attempts < 5) {
        prod = pick(PRODUCTOS);
        attempts++;
      }
      productosUsados.add(prod.codigo);

      const cantidad = cliente.perfil === 'mayorista' ? intBetween(6, 24)
                    : cliente.perfil === 'mediano'    ? intBetween(2, 8)
                    :                                    intBetween(1, 3);
      const precio = prod.precio;
      const subtotal = +(cantidad * precio).toFixed(2);
      totalCalc += subtotal;
      detalle.push({
        id: pedidos.length * 10 + j,
        producto: prod.producto,
        codigo: prod.codigo,
        variante: '',
        cantidad,
        precio_unitario: precio,
        iva_rate: 0.12,
        subtotal,
      });
    }

    pedidos.push({
      id: nextId++,
      fecha: fecha.toISOString(),
      estado,
      total: +totalCalc.toFixed(2),
      vendedor,
      numero_factura: `${cliente.perfil === 'mayorista' ? '001' : '004'}-024-${String(nextFactura++).padStart(9, '0')}`,
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      cliente_telefono: cliente.telefono || '',
      detalle,
    });
  }
  // Orden descendente por fecha (como vendría de Supabase)
  pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return pedidos;
}

export const MOCK_PEDIDOS = generarPedidos(85);
export const MOCK_CLIENTES = CLIENTES;
