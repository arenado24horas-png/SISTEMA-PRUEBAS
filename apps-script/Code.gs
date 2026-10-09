/** ARENADO 24 HORAS · Backend (Google Apps Script) */
var SHEET_ID = '1NErpmcHQzekbfDgk1YwX7tVkxMd9V34MnAH_265LThA';
var CODIGO_ADMIN = ''; // <-- ESCRIBE AQUÍ tu código secreto para crear usuarios nuevos
var H = {cli:'BASE DE CLIENTES', usr:'USUARIOS (NO TOCAR)', act:'PEDIDOS ACTIVOS EN VIVO', his:'HISTORICO DE TRABAJOS'};
var ACCESOS = ['TOTALIDAD DE LA PAGINA','REGISTRO DE CLIENTES Y ENVIADO A DESARROLLO','SOLO DESARROLLO Y CUMPLIMIENTO'];
var FIRST = 4, TTL = 7*24*3600*1000, MAXC = 49000, _ss;

function configurar(){ secret_(); ss_(); } // ejecutar UNA vez para autorizar permisos
function doGet(){ return out_({ok:true, msg:'Arenado 24h API'}); }

function doPost(e){
  var b;
  try { b = JSON.parse(e.postData.contents); } catch(x){ return out_({ok:false,error:'Solicitud inválida'}); }
  try {
    if (b.tipo==='login') return out_(login_(b));
    if (b.tipo==='registro') return out_(registro_(b));
    if (!chk_(b.token)) return out_({ok:false,auth:true,error:'Sesión vencida'});
    if (b.tipo==='datos') return out_(datos_(b.since));
    return out_(escribir_(b));
  } catch(err){ return out_({ok:false,error:String(err)}); }
}

/* ---------- utilidades ---------- */
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_(){ return _ss || (_ss = SpreadsheetApp.openById(SHEET_ID)); }
function sheet_(n){ var s=ss_().getSheetByName(n); if(!s) throw new Error('No existe la hoja: '+n); return s; }
function rows_(sh,r,c,n){ var l=sh.getLastRow(); return l<r ? [] : sh.getRange(r,c,l-r+1,n).getValues(); }
function nextRow_(sh){ var v=rows_(sh,FIRST,2,1); for(var i=v.length-1;i>=0;i--) if(String(v[i][0]).trim()!=='') return FIRST+i+1; return FIRST; }
function ensure_(sh,r){ var m=sh.getMaxRows(); if(r>m) sh.insertRowsAfter(m, r-m+20); }
function clean_(v){ return (typeof v==='string' && /^[=+\-@]/.test(v)) ? "'"+v : v; }
function lock_(fn){ var l=LockService.getScriptLock(); try{ l.waitLock(20000); }catch(e){ return {ok:false,busy:true,error:'Servidor ocupado'}; } try{ return fn(); } finally { l.releaseLock(); } }

/* ---------- sesión (token firmado, sin enviar contraseñas al navegador) ---------- */
function secret_(){ var p=PropertiesService.getScriptProperties(), s=p.getProperty('SECRET'); if(!s){ s=Utilities.getUuid()+Utilities.getUuid(); p.setProperty('SECRET',s);} return s; }
function sign_(s){ return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())); }
function mk_(u,a){ var b=Utilities.base64EncodeWebSafe(JSON.stringify({u:u,a:a,e:Date.now()+TTL})); return b+'.'+sign_(b); }
function chk_(t){
  if(!t) return null; var p=String(t).split('.'); if(p.length!==2 || sign_(p[0])!==p[1]) return null;
  var o=JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p[0])).getDataAsString()); return o.e>Date.now()?o:null;
}
function hash_(p){ return 'sha256:'+Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,'arenado24h|'+p)); }
function usuarios_(){
  return rows_(sheet_(H.usr),FIRST,2,3).filter(function(r){return String(r[0]).trim()!=='';}).map(function(r){
    return {user:String(r[0]).trim().toUpperCase(), pass:String(r[1]).trim(), access:String(r[2]).trim()||'TOTALIDAD DE LA PAGINA'};
  });
}
function login_(b){
  var u=String(b.user||'').trim().toUpperCase(), p=String(b.pass||''), r=usuarios_();
  for(var i=0;i<r.length;i++) if(r[i].user===u && (r[i].pass===p || r[i].pass===hash_(p)))
    return {ok:true,user:u,access:r[i].access,token:mk_(u,r[i].access)};
  Utilities.sleep(800); return {ok:false,error:'Credenciales incorrectas.'};
}
function registro_(b){
  if(!CODIGO_ADMIN || String(b.code||'')!==CODIGO_ADMIN) return {ok:false,error:'Código de administrador incorrecto.'};
  var u=String(b.user||'').trim().toUpperCase(), p=String(b.pass||'').trim();
  if(!u || p.length<6) return {ok:false,error:'Usuario y contraseña (mínimo 6 caracteres) requeridos.'};
  var a = ACCESOS.indexOf(b.access)>-1 ? b.access : ACCESOS[2];
  return lock_(function(){
    if(usuarios_().some(function(x){return x.user===u;})) return {ok:false,error:'El usuario ya existe.'};
    var sh=sheet_(H.usr), r=nextRow_(sh); ensure_(sh,r);
    sh.getRange(r,2,1,3).setNumberFormat('@').setValues([[u,hash_(p),a]]);
    return {ok:true,user:u,access:a,token:mk_(u,a)};
  });
}

/* ---------- lectura (rápida: versión en caché, sin contraseñas) ---------- */
function datos_(since){
  var c=CacheService.getScriptCache(), v=c.get('v');
  if(!v){ v=String(Date.now()); c.put('v',v,60); }
  if(since && since===v) return {ok:true,same:true,v:v};
  var cli=[], act=[];
  rows_(sheet_(H.cli),FIRST,2,5).forEach(function(r){ var n=String(r[0]).trim();
    if(n) cli.push({name:n,ruc:String(r[1]).trim(),atencion:String(r[2]).trim(),tel:String(r[3]).trim(),correo:String(r[4]).trim()}); });
  rows_(sheet_(H.act),1,1,2).forEach(function(r){ if(r[0]!=='' && r[1]!==''){ try{ act.push(JSON.parse(r[1])); }catch(e){} } });
  return {ok:true,v:v,clientes:cli,activos:act};
}

/* ---------- escritura (con bloqueo y anti-duplicados) ---------- */
function escribir_(b){
  var c=CacheService.getScriptCache();
  if(b.rid && c.get('r'+b.rid)) return {ok:true,dup:true};
  var res = lock_(function(){
    switch(b.tipo){
      case 'sync_tarjeta': return sync_(b.tarjeta);
      case 'borrar_tarjeta': return borrar_(b.id);
      case 'historico': return fila_(H.his,b.row,false);
      case 'cliente': return fila_(H.cli,b.row,true);
    }
    return {ok:false,error:'Tipo no reconocido: '+b.tipo};
  });
  if(res.ok){ if(b.rid) c.put('r'+b.rid,'1',21600); c.put('v',String(Date.now()),60); }
  return res;
}
function sync_(t){
  if(!t || !t.id) return {ok:false,error:'Tarjeta sin id'};
  var txt=JSON.stringify(t); if(txt.length>MAXC) return {ok:false,error:'Tarjeta demasiado grande'};
  var sh=sheet_(H.act), ids=rows_(sh,1,1,1), id=String(t.id), f=-1, i;
  for(i=0;i<ids.length;i++) if(String(ids[i][0])===id){ f=i+1; break; }
  if(f<0){ f=1; for(i=ids.length-1;i>=0;i--) if(String(ids[i][0])!==''){ f=i+2; break; } }
  ensure_(sh,f); sh.getRange(f,1,1,2).setNumberFormat('@').setValues([[id,txt]]);
  return {ok:true};
}
function borrar_(id){
  var sh=sheet_(H.act), ids=rows_(sh,1,1,1);
  for(var i=ids.length-1;i>=0;i--) if(String(ids[i][0])===String(id)){ sh.deleteRow(i+1); break; }
  return {ok:true};
}
function fila_(name,row,dedupe){
  if(!Array.isArray(row) || !row.length) return {ok:false,error:'Fila inválida'};
  var sh=sheet_(name);
  if(dedupe){ var n=String(row[0]).trim().toUpperCase();
    if(rows_(sh,FIRST,2,1).some(function(r){return String(r[0]).trim().toUpperCase()===n;})) return {ok:true,dup:true}; }
  var r=nextRow_(sh); ensure_(sh,r);
  var rg=sh.getRange(r,2,1,row.length);
  if(name===H.cli) rg.setNumberFormat('@');                      // conserva ceros en RUC/teléfono
  else { sh.getRange(r,3).setNumberFormat('@'); sh.getRange(r,8,1,2).setNumberFormat('"S/."#,##0.00'); }
  rg.setValues([row.map(clean_)]);
  return {ok:true};
}
