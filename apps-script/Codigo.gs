/**
 * @OnlyCurrentDoc
 * Mi Lana · puente entre la app y esta hoja.
 * La línea de arriba hace que Google le dé permiso SOLO a esta hoja.
 */

// Clave de la app: la comparten las personas de confianza que la usan (se pone una vez por teléfono).
const CLAVE = 'CAMBIA-ESTA-CLAVE-por-una-larga-2026';

const HOJAS = {
  perfiles: { nombre: 'Perfiles',      cols: ['id', 'nombre', 'pin_hash', 'creado'] },
  movs:     { nombre: 'Movimientos',   cols: ['id', 'fecha', 'tipo', 'categoria', 'monto', 'nota', 'pago_de', 'pago_id', 'perfil'] },
  ingresos: { nombre: 'Ingresos fijos', cols: ['id', 'nombre', 'monto', 'dia', 'meses_recibidos', 'perfil'] },
  fijos:    { nombre: 'Fijos',         cols: ['id', 'nombre', 'monto', 'dia', 'meses_pagados', 'perfil'] },
  deudas:   { nombre: 'Deudas',        cols: ['id', 'nombre', 'cuota', 'total_pagos', 'pagados_antes', 'dia', 'meses_pagados', 'perfil'] },
  ajustes:  { nombre: 'Ajustes',       cols: ['clave', 'valor', 'perfil'] }
};
const DATOS = ['movs', 'ingresos', 'fijos', 'deudas'];

/* Corre esta función desde el editor cada vez que actualices este código. */
function prepararHoja() {
  Object.keys(HOJAS).forEach(function (k) { hoja_(k); });
}

function doPost(e) {
  let r;
  try {
    const p = JSON.parse(e.postData.contents);
    if (p.key !== CLAVE) return json_({ ok: false, error: 'clave' });
    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try {
      if (p.action === 'perfiles') r = { ok: true, perfiles: listaPerfiles_() };
      else if (p.action === 'crearPerfil') r = { ok: true, perfil: crearPerfil_(p.nombre, p.pin) };
      else {
        const yo = validar_(p.perfil, p.pin);
        if (!yo) r = { ok: false, error: 'pin' };
        else if (p.action === 'load') r = { ok: true, data: cargar_(yo) };
        else if (p.action === 'put') { guardar_(p.col, p.id, p.obj, yo); r = { ok: true }; }
        else if (p.action === 'del') { borrar_(p.col, p.id, yo); r = { ok: true }; }
        else if (p.action === 'perfil') { guardarAjustes_(p.obj, yo); r = { ok: true }; }
        else r = { ok: false, error: 'accion' };
      }
    } finally { lock.releaseLock(); }
  } catch (err) {
    r = { ok: false, error: String(err.message || err) };
  }
  return json_(r);
}

function doGet() { return json_({ ok: true, app: 'Mi Lana' }); }

/* ---------- perfiles ---------- */
function hash_(pin, id) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin) + '|' + id, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function listaPerfiles_() {
  return filas_('perfiles').filter(function (f) { return f[0] !== ''; })
    .map(function (f) { return { id: String(f[0]), nombre: String(f[1]) }; });
}

function crearPerfil_(nombre, pin) {
  nombre = String(nombre || '').trim();
  if (!nombre) throw new Error('nombre');
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw new Error('pin_formato');
  const existentes = listaPerfiles_();
  if (existentes.some(function (x) { return x.nombre.toLowerCase() === nombre.toLowerCase(); })) throw new Error('nombre_repetido');
  const id = 'p' + Date.now().toString(36);
  hoja_('perfiles').appendRow([id, nombre, hash_(pin, id), new Date()]);
  // El primer perfil se queda con todo lo que ya estaba registrado antes de los perfiles.
  if (!existentes.length) adoptarHuerfanos_(id);
  return { id: id, nombre: nombre };
}

function validar_(id, pin) {
  if (!id) return null;
  const f = filas_('perfiles').filter(function (x) { return String(x[0]) === String(id); })[0];
  return f && String(f[2]) === hash_(pin, id) ? String(id) : null;
}

function adoptarHuerfanos_(id) {
  Object.keys(HOJAS).forEach(function (k) {
    if (k === 'perfiles') return;
    const sh = hoja_(k), c = HOJAS[k].cols.length, n = sh.getLastRow() - 1;
    if (n < 1) return;
    const r = sh.getRange(2, c, n, 1), v = r.getValues();
    let cambio = false;
    v.forEach(function (x, i) { if (x[0] === '' && sh.getRange(i + 2, 1).getValue() !== '') { x[0] = id; cambio = true; } });
    if (cambio) r.setValues(v);
  });
}

/* ---------- hojas ---------- */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function hoja_(k) {
  const def = HOJAS[k];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.nombre);
  if (!sh && k === 'ajustes') { sh = ss.getSheetByName('Perfil'); if (sh) sh.setName(def.nombre); } // nombre viejo
  if (!sh) sh = ss.insertSheet(def.nombre);
  const head = sh.getRange(1, 1, 1, def.cols.length);
  if (head.getValues()[0].join('|') !== def.cols.join('|')) {
    head.setValues([def.cols]).setFontWeight('bold').setBackground('#FBE3EE');
    sh.setFrozenRows(1);
  }
  return sh;
}

function filas_(k) {
  const sh = hoja_(k);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HOJAS[k].cols.length).getValues();
}

const ultima_ = k => HOJAS[k].cols.length - 1; // columna perfil

function aObj_(k, f) {
  const tz = Session.getScriptTimeZone();
  const fecha = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v);
  const mapa = v => { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };
  if (k === 'movs') return {
    fecha: fecha(f[1]), tipo: String(f[2]), categoria: String(f[3]), monto: Number(f[4]) || 0, nota: String(f[5] || ''),
    ref: f[6] ? { col: String(f[6]), id: String(f[7]) } : null
  };
  if (k === 'ingresos') return { nombre: String(f[1]), monto: Number(f[2]) || 0, dia: Number(f[3]) || 1, recibidos: mapa(f[4]) };
  if (k === 'fijos') return { nombre: String(f[1]), monto: Number(f[2]) || 0, dia: Number(f[3]) || 1, pagados: mapa(f[4]) };
  if (k === 'deudas') return {
    nombre: String(f[1]), cuota: Number(f[2]) || 0, totalPagos: Number(f[3]) || 0,
    pagadosAntes: Number(f[4]) || 0, dia: Number(f[5]) || 1, historial: mapa(f[6])
  };
}

function aFila_(k, id, o, yo) {
  if (k === 'movs') return [id, o.fecha, o.tipo, o.categoria, Number(o.monto) || 0, o.nota || '', o.ref ? o.ref.col : '', o.ref ? o.ref.id : '', yo];
  if (k === 'ingresos') return [id, o.nombre, Number(o.monto) || 0, Number(o.dia) || 1, JSON.stringify(o.recibidos || {}), yo];
  if (k === 'fijos') return [id, o.nombre, Number(o.monto) || 0, Number(o.dia) || 1, JSON.stringify(o.pagados || {}), yo];
  if (k === 'deudas') return [id, o.nombre, Number(o.cuota) || 0, Number(o.totalPagos) || 0, Number(o.pagadosAntes) || 0, Number(o.dia) || 1, JSON.stringify(o.historial || {}), yo];
}

function cargar_(yo) {
  const out = { movs: {}, ingresos: {}, fijos: {}, deudas: {}, perfil: {} };
  DATOS.forEach(function (k) {
    const u = ultima_(k);
    filas_(k).forEach(function (f) { if (f[0] !== '' && String(f[u]) === yo) out[k][String(f[0])] = aObj_(k, f); });
  });
  filas_('ajustes').forEach(function (f) {
    if (f[0] === '' || String(f[2]) !== yo) return;
    let v = f[1];
    try { v = JSON.parse(f[1]); } catch (e) {}
    out.perfil[String(f[0])] = v;
  });
  return out;
}

function buscar_(k, id) {
  const ids = filas_(k).map(function (f) { return String(f[0]); });
  const i = ids.indexOf(String(id));
  return i < 0 ? -1 : i + 2;
}

function dueno_(k, r) { return String(hoja_(k).getRange(r, ultima_(k) + 1).getValue()); }

function guardar_(k, id, obj, yo) {
  if (DATOS.indexOf(k) < 0) throw new Error('colección');
  const sh = hoja_(k), fila = aFila_(k, id, obj, yo), r = buscar_(k, id);
  if (r > 0 && dueno_(k, r) !== yo) throw new Error('ajeno');
  const destino = r > 0 ? r : sh.getLastRow() + 1;
  if (k === 'movs') sh.getRange(destino, 2).setNumberFormat('@');
  sh.getRange(destino, 1, 1, fila.length).setValues([fila]);
}

function borrar_(k, id, yo) {
  if (DATOS.indexOf(k) < 0) throw new Error('colección');
  const r = buscar_(k, id);
  if (r > 0 && dueno_(k, r) === yo) hoja_(k).deleteRow(r);
}

function guardarAjustes_(obj, yo) {
  const sh = hoja_('ajustes');
  const f = filas_('ajustes');
  Object.keys(obj || {}).forEach(function (c) {
    const v = JSON.stringify(obj[c]);
    let i = -1;
    f.forEach(function (x, j) { if (String(x[0]) === c && String(x[2]) === yo) i = j; });
    if (i >= 0) sh.getRange(i + 2, 2).setValue(v);
    else { sh.appendRow([c, v, yo]); f.push([c, v, yo]); }
  });
}
