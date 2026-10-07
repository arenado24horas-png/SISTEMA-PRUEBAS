// Pega este código en: Google Sheets > Extensiones > Apps Script
const CLAVE  = 'CAMBIA-ESTA-CLAVE';   // la misma que pondrás en index.html (TOKEN)
const HOJA   = 'Hoja 1';
const PRIMERA_FILA = 7;               // primera fila libre para datos (B:F)

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function ultimaFila_(sh) {
  const v = sh.getRange(1, 2, sh.getMaxRows(), 5).getValues();
  let last = 0;
  v.forEach((r, i) => { if (r.some(c => String(c).trim() !== '')) last = i + 1; });
  return last;
}

// Guardar un cliente nuevo (B:F = Cliente, RUC, Atención, Telf, Correo)
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const d = JSON.parse(e.postData.contents);
    if (d.token !== CLAVE) return respuesta_({ ok: false, error: 'clave incorrecta' });
    const sh = SpreadsheetApp.getActive().getSheetByName(HOJA);
    const fila = Math.max(ultimaFila_(sh) + 1, PRIMERA_FILA);
    const r = sh.getRange(fila, 2, 1, 5);
    r.setNumberFormat('@');                       // texto: conserva ceros de RUC y teléfonos
    r.setValues([d.row.slice(0, 5).map(String)]);
    return respuesta_({ ok: true, fila: fila });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Probar conexión y traer los nombres de "Atención" ya usados
function doGet(e) {
  if (e.parameter.token !== CLAVE) return respuesta_({ ok: false, error: 'clave incorrecta' });
  const sh = SpreadsheetApp.getActive().getSheetByName(HOJA);
  const n = Math.max(ultimaFila_(sh) - PRIMERA_FILA + 1, 0);
  const aten = n ? sh.getRange(PRIMERA_FILA, 4, n, 1).getValues().flat().filter(String) : [];
  return respuesta_({ ok: true, atencion: [...new Set(aten)] });
}
