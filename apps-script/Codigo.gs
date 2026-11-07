/**
 * @OnlyCurrentDoc
 * Mi Lana · puente entre la app y esta hoja.
 * La línea de arriba hace que Google le dé permiso SOLO a esta hoja.
 */

// 1) Cambia esta clave por una tuya, larga y difícil (la misma que pondrás en la app).
const CLAVE = 'CAMBIA-ESTA-CLAVE-por-una-larga-2026';

const HOJAS = {
  movs:   { nombre: 'Movimientos', cols: ['id', 'fecha', 'tipo', 'categoria', 'monto', 'nota', 'pago_de', 'pago_id'] },
  fijos:  { nombre: 'Fijos',       cols: ['id', 'nombre', 'monto', 'dia', 'meses_pagados'] },
  deudas: { nombre: 'Deudas',      cols: ['id', 'nombre', 'cuota', 'total_pagos', 'pagados_antes', 'dia', 'meses_pagados'] },
  perfil: { nombre: 'Perfil',      cols: ['clave', 'valor'] }
};

/* Corre esta función una vez desde el editor para crear las pestañas. */
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
      if (p.action === 'load') r = { ok: true, data: cargar_() };
      else if (p.action === 'put') { guardar_(p.col, p.id, p.obj); r = { ok: true }; }
      else if (p.action === 'del') { borrar_(p.col, p.id); r = { ok: true }; }
      else if (p.action === 'perfil') { guardarPerfil_(p.obj); r = { ok: true }; }
      else r = { ok: false, error: 'accion' };
    } finally { lock.releaseLock(); }
  } catch (err) {
    r = { ok: false, error: String(err) };
  }
  return json_(r);
}

function doGet() { return json_({ ok: true, app: 'Mi Lana' }); }

/* ---------- internos ---------- */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function hoja_(k) {
  const def = HOJAS[k];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.nombre);
  if (!sh) {
    sh = ss.insertSheet(def.nombre);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold').setBackground('#FFE0F0');
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

function aObj_(k, f) {
  const tz = Session.getScriptTimeZone();
  const fecha = v => (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v);
  const mapa = v => { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };
  if (k === 'movs') return {
    fecha: fecha(f[1]), tipo: String(f[2]), categoria: String(f[3]), monto: Number(f[4]) || 0, nota: String(f[5] || ''),
    ref: f[6] ? { col: String(f[6]), id: String(f[7]) } : null
  };
  if (k === 'fijos') return { nombre: String(f[1]), monto: Number(f[2]) || 0, dia: Number(f[3]) || 1, pagados: mapa(f[4]) };
  if (k === 'deudas') return {
    nombre: String(f[1]), cuota: Number(f[2]) || 0, totalPagos: Number(f[3]) || 0,
    pagadosAntes: Number(f[4]) || 0, dia: Number(f[5]) || 1, historial: mapa(f[6])
  };
}

function aFila_(k, id, o) {
  if (k === 'movs') return [id, o.fecha, o.tipo, o.categoria, Number(o.monto) || 0, o.nota || '', o.ref ? o.ref.col : '', o.ref ? o.ref.id : ''];
  if (k === 'fijos') return [id, o.nombre, Number(o.monto) || 0, Number(o.dia) || 1, JSON.stringify(o.pagados || {})];
  if (k === 'deudas') return [id, o.nombre, Number(o.cuota) || 0, Number(o.totalPagos) || 0, Number(o.pagadosAntes) || 0, Number(o.dia) || 1, JSON.stringify(o.historial || {})];
}

function cargar_() {
  const out = { movs: {}, fijos: {}, deudas: {}, perfil: {} };
  ['movs', 'fijos', 'deudas'].forEach(function (k) {
    filas_(k).forEach(function (f) { if (f[0] !== '') out[k][String(f[0])] = aObj_(k, f); });
  });
  filas_('perfil').forEach(function (f) {
    if (f[0] === '') return;
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

function guardar_(k, id, obj) {
  if (!HOJAS[k] || k === 'perfil') throw new Error('colección');
  const sh = hoja_(k), fila = aFila_(k, id, obj), r = buscar_(k, id);
  if (k === 'movs') sh.getRange(r > 0 ? r : sh.getLastRow() + 1, 2).setNumberFormat('@');
  if (r > 0) sh.getRange(r, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function borrar_(k, id) {
  const r = buscar_(k, id);
  if (r > 0) hoja_(k).deleteRow(r);
}

function guardarPerfil_(obj) {
  const sh = hoja_('perfil');
  const actuales = filas_('perfil').map(function (f) { return String(f[0]); });
  Object.keys(obj || {}).forEach(function (c) {
    const v = JSON.stringify(obj[c]);
    const i = actuales.indexOf(c);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(v);
    else { sh.appendRow([c, v]); actuales.push(c); }
  });
}
