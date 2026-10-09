(function(){
/* ========== CONFIGURACIONES ========== */
var SCRIPT_URL = window.APP_CONFIG.SCRIPT_URL;

// Datos de la empresa para la plantilla
var E = {
  name: "ARENADO 24 HORAS S.A.C.",
  ruc: "20613569619",
  ofi: "Centro de Lima",
  sede: "Comas, Lima",
  telf: "922158392",
  consid: ["Validez de oferta 7 días.", "Precios sujetos a variación."],
  cuentas: ["CTA BBVA: 00110752380200509926", "CCI BBVA: 01175200020050992638"]
};

// Configuración de Tema
var currentTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", currentTheme);
function updateThemeBtn() { document.getElementById("theme-btn").textContent = currentTheme === "dark" ? "Modo Claro" : "Modo Oscuro"; }
updateThemeBtn();
document.getElementById("theme-btn").onclick = function() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);
  localStorage.setItem("theme", currentTheme);
  updateThemeBtn();
};

// CERRAR SESION
document.getElementById("current-user").onclick = function() {
  if(confirm("¿Deseas cerrar sesión?")){
    localStorage.removeItem("arenado_user");
    localStorage.removeItem("arenado_access");localStorage.removeItem("arenado_token");localStorage.removeItem("arenado_cache");
    location.reload();
  }
};

var COLS=[["pedido","1 · Pedidos"],["desarrollo","2 · Desarrollo"],["cumplimiento","3 · Cumplimiento"],["cobrado","4 · Cerrados"]];
var NEWF=[["name","Cliente (Sres.) *","text","",1],["ruc","RUC"],["atencion","Encargado (Auto)"],["tel","Telf."],["correo","Correo","email","",1]];
var DEVA=[["num","N° Presupuesto","text","Ej: 0001 - 26"],["elab","Elaborado por (Auto)"],["proyecto","Proyecto","text","",1]];
var DEVB=[["adelanto","Adelanto (S/)","number","0"],["terminos","Términos","text","",1]];

var items=[], ui=null, n=0, shown=0, busy=false, registeredUsers=[], loggedUser=null, loggedUserAccess="", clientesDb=[];
var $=function(s){return document.querySelector(s)};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function num(v){return Number(v).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})}
function money(v){return "S/. "+num(v||0)}
function calc(i){var s=(i.items||[]).reduce(function(a,t){return a+t.qty*t.pu},0),g=s*.18,t=s+g,a=Number(i.adelanto)||0;return{sub:s,igv:g,tot:t,adel:a,sal:Math.max(0,t-a)}}
function pending(){return items.filter(function(i){return i.status==="cumplimiento"&&i.done})}
function debt(){return pending().reduce(function(s,i){return s+calc(i).sal},0)}
function today(){var d=new Date(),p=function(x){return String(x).padStart(2,"0")};return p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" "+p(d.getHours())+":"+p(d.getMinutes())}

function tween(to){var from=shown,t0=performance.now(),d=$("#debt");d.classList.add("pop");setTimeout(function(){d.classList.remove("pop")},300);
(function f(t){var k=Math.min(1,(t-t0)/450);shown=from+(to-from)*k;d.textContent="Deuda: "+money(shown);if(k<1)requestAnimationFrame(f)})(t0)}

function render(enterId){
  var b=$("#board");b.textContent="";
  var acc = (loggedUserAccess || "").toUpperCase();
  var isReg = acc.indexOf("REGISTRO") > -1;
  var isDev = acc.indexOf("CUMPLIMIENTO") > -1 || acc.indexOf("DESARROLLO") > -1;
  var isTot = acc.indexOf("TOTALIDAD") > -1 || (!isReg && !isDev); 

  $("#add").style.display = (isTot || isReg) ? "flex" : "none";
  $("#sum").style.display = isTot ? "flex" : "none";
  $("#debt").style.display = isTot ? "block" : "none";
  
  var visibleCols = COLS.filter(function(c){
    if(isTot) return true; 
    if(isReg) return c[0] === "pedido"; 
    if(isDev) return c[0] === "desarrollo" || c[0] === "cumplimiento"; 
    return false;
  });

  visibleCols.forEach(function(c){
    var list=items.filter(function(i){return i.status===c[0]});
    var s=el("section","col"),h=el("h2");h.appendChild(el("span",null,c[1]));h.appendChild(el("span",null,String(list.length)));s.appendChild(h);
    if(!list.length)s.appendChild(el("div","empty","Sin tareas"));
    list.forEach(function(i){var k=card(i);if(i.id===enterId)k.classList.add("in");s.appendChild(k)});
    b.appendChild(s);
  });
  var dd=debt();if(Math.abs(dd-shown)>0.001)tween(dd);
}

function go(i,patch,cls){
  if(busy)return;busy=true;
  var e=document.querySelector('[data-id="'+i.id+'"]');if(e)e.classList.add(cls||"out");
  setTimeout(function(){
    if(patch===null){
      items=items.filter(function(x){return x!==i});
      gsDeleteTarjeta(i.id); 
    }else{
      Object.assign(i,patch);
      if(patch.status==="cobrado"){
        gsSaveHistorico(i);
      }
      if(patch.status==="cobrado"){
         gsDeleteTarjeta(i.id); 
      } else {
         gsSyncTarjeta(i); 
      }
    }
    ui=null;busy=false;render(patch===null?null:i.id);
  },300);
}
function setUi(i,m){ui={id:i.id,mode:m};render()}

// AUTOCOMPLETADO INTELIGENTE
function form(d,defs,v){
  var g=el("div","g2"),r={};
  defs.forEach(function(f){
    var w=el("label","fl"+(f[4]?" wide":""));
    w.appendChild(el("span",null,f[1]));
    var x=el("input");
    x.type=f[2]||"text";
    if(f[2]==="number"){x.step="any";x.min="0"}
    x.placeholder=f[3]||"";
    
    var val=v&&v[f[0]]!=null?v[f[0]]:"";
    if(f[0]==="elab" || f[0]==="atencion"){
      val = val || loggedUser || "";
      x.readOnly = true;
    }
    x.value=val;
    
    if(f[0]==="name") {
      x.setAttribute("list", "clients-list");
      x.addEventListener("change", function() {
        var match = clientesDb.find(function(c) { return c.name.toUpperCase() === x.value.toUpperCase(); });
        if(match) {
          if(r.ruc && !r.ruc.value) r.ruc.value = match.ruc;
          if(r.tel && !r.tel.value) r.tel.value = match.tel;
          if(r.correo && !r.correo.value) r.correo.value = match.correo;
        }
      });
    }

    w.appendChild(x); g.appendChild(w); r[f[0]]=x
  });
  d.appendChild(g);
  return r;
}

function itemsEd(d){
  var box=el("div","its"),rows=[],tot=el("div","tt"),add=el("button",null,"Añadir Ítem");
  box.appendChild(el("div","m","Detalle de servicios:"));
  function upd(){var s=rows.reduce(function(a,o){return a+(parseFloat(o.q.value)||0)*(parseFloat(o.p.value)||0)},0);tot.textContent="Subtotal "+money(s)+" · IGV "+money(s*.18)+" · Total "+money(s*1.18)}
  function addRow(){
    var r=el("div","ir"),o={r:r};
    function mk(ph,type,cls,val){var x=el("input",cls);x.placeholder=ph;x.type=type;if(type==="number"){x.step="any";x.min="0"}if(val)x.value=val;r.appendChild(x);return x}
    o.w=mk("Descripción del trabajo","text","w");o.w.setAttribute("list","sug");
    o.q=mk("Cant.","number");o.u=mk("Und.","text",null,"UND");o.p=mk("P.U. S/","number");
    var x=el("button","d","X");x.onclick=function(){if(rows.length<2)return;rows.splice(rows.indexOf(o),1);r.remove();upd()};r.appendChild(x);
    rows.push(o);box.insertBefore(r,add);upd();
    setTimeout(function(){o.w.focus()},50);
    return o;
  }
  add.onclick=addRow;
  box.appendChild(add);box.appendChild(tot);box.oninput=upd;addRow();d.appendChild(box);
  return{get:function(){
    var out=[];
    for(var k=0;k<rows.length;k++){var o=rows[k],q=parseFloat(o.q.value),p=parseFloat(o.p.value);
      if(!o.w.value.trim()){o.w.focus();return null}if(!(q>0)){o.q.focus();return null}if(isNaN(p)||p<0){o.p.focus();return null}
      out.push({work:o.w.value.trim(),qty:q,und:o.u.value.trim()||"UND",pu:p})}
    return out}};
}

function card(i){
  var d=el("div","card");d.dataset.id=i.id;
  var mode=ui&&ui.id===i.id?ui.mode:null,a=el("div","act");
  function btn(t,cls,fn){var x=el("button",cls,t);x.onclick=fn;a.appendChild(x)}
  function ask(txt,fn){d.appendChild(el("div","ask",txt));btn("Confirmar","p",fn);btn("Cancelar",null,function(){ui=null;render()})}
  
  if(mode==="name"){
    var f=form(d,NEWF,i); setTimeout(function(){f.name.focus()},100);
    btn("Guardar Cliente","p",function(){
      if(!f.name.value.trim()){f.name.focus();return}
      Object.keys(f).forEach(function(k){i[k]=f[k].value.trim()});
      ui=null; render(); gsSaveCliente(i); gsSyncTarjeta(i);
    });
    btn("Cancelar",null,function(){if(!i.name)items=items.filter(function(x){return x!==i});ui=null;render()});
    d.appendChild(a);return d;
  }
  
  d.appendChild(el("b",null,i.name));
  if(i.ruc)d.appendChild(el("div","m","RUC: "+i.ruc));
  if(i.atencion)d.appendChild(el("div","m","Encargado: "+i.atencion));
  
  var statusBox = el("div","m");
  statusBox.innerHTML = i.gs==="ok"?'<span class="gs-status ok">Sincronizado</span>':i.gs==="wait"?'<span class="gs-status wait">Guardando...</span>':'';
  d.appendChild(statusBox);

  if(i.items)i.items.forEach(function(t){d.appendChild(el("div","m","• "+t.qty+" "+t.und+" - "+t.work))});
  var c=i.status!=="pedido"?calc(i):null;
  if(c)d.appendChild(el("div","pr","Total: "+money(c.tot)+(c.adel?" (Saldo: "+money(c.sal)+")":"")));
  
  if(mode==="dev"){
    var w1=form(d,DEVA),ed=itemsEd(d),w2=form(d,DEVB,{terminos:"50% Adelanto y 50% Contra entrega"});
    btn("Guardar y Enviar","p",function(){
      var it=ed.get();if(!it)return;
      var o={status:"desarrollo",items:it,work:it.map(function(t){return t.work}).join(" / "),adelanto:parseFloat(w2.adelanto.value)||0};
      ["num","elab","proyecto"].forEach(function(k){o[k]=w1[k].value.trim()});o.terminos=w2.terminos.value.trim();go(i,o);
    });btn("Cancelar",null,function(){ui=null;render()});
    
  }else if(mode==="del"){ask("¿Deseas eliminar permanentemente?",function(){go(i,null,"gone")});
  }else if(mode==="cum"){ask("¿Iniciar cumplimiento del trabajo?",function(){go(i,{status:"cumplimiento",done:false})});
  }else if(mode==="done"){ask("¿Marcar trabajo como FINALIZADO?",function(){go(i,{done:true},"gone")});
  }else if(mode==="paid"){ask("¿Confirmas que el pago fue recibido?",function(){go(i,{status:"cobrado"})});
  
  }else if(i.status==="pedido"){
    btn("A Desarrollo","p",function(){setUi(i,"dev")}); btn("Eliminar","d",function(){setUi(i,"del")});
  }else if(i.status==="desarrollo"){
    btn("A Cumplimiento","p",function(){setUi(i,"cum")}); btn("Atrás",null,function(){go(i,{status:"pedido"},"back")}); btn("Eliminar","d",function(){setUi(i,"del")});
  }else if(i.status==="cumplimiento"){
    if(!i.done){
      d.appendChild(el("span","tag","En ejecución"));
      btn("Finalizar Trabajo","p",function(){setUi(i,"done")}); btn("Atrás",null,function(){go(i,{status:"desarrollo"},"back")});
    }else{
      d.appendChild(el("span","tag debt2","Pago Pendiente"));
      btn("Cobrar y Cerrar","p",function(){setUi(i,"paid")});
    }
  }else{
    d.appendChild(el("span","tag","Cerrado")); btn("Eliminar","d",function(){setUi(i,"del")});
  }
  
  if(a.children.length)d.appendChild(a);
  return d;
}

/* ---------- RED, SESIÓN Y COLA OFFLINE ---------- */
var token=localStorage.getItem("arenado_token"), ver="", isRegisterMode=false, queue=[], flushP=null;
try{queue=JSON.parse(localStorage.getItem("arenado_q")||"[]")}catch(e){}
function setGs(t,type){var e=$("#gs");e.textContent=t;e.className="gs-status "+(type||"")}
function saveQ(){localStorage.setItem("arenado_q",JSON.stringify(queue))}
function api(body){
  body.token=token;
  return fetch(SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)})
    .then(function(r){return r.json()})
    .then(function(r){if(r.auth){localStorage.removeItem("arenado_token");location.reload();throw new Error("auth")}return r});
}
function send(body){
  body.rid=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  if(body.tipo==="sync_tarjeta")queue=queue.filter(function(q,k){return (k===0&&flushP)||!(q.tipo===body.tipo&&q.tarjeta.id===body.tarjeta.id)});
  queue.push(body);saveQ();return flush();
}
function flush(){
  if(flushP||!token)return flushP||Promise.resolve();
  flushP=(function next(){
    if(!queue.length)return Promise.resolve();
    return api(JSON.parse(JSON.stringify(queue[0]))).then(function(r){
      if(r.busy)throw new Error("busy");
      queue.shift();saveQ();return next();
    });
  })().catch(function(){}).then(function(){
    flushP=null;setGs(queue.length?"Pendiente de enviar: "+queue.length:"Sincronizado",queue.length?"err":"ok");
  });
  return flushP;
}
function processData(r){
  ver=r.v;items=r.activos||[];clientesDb=r.clientes||[];
  var dl=$("#clients-list");dl.textContent="";
  clientesDb.forEach(function(c){var o=el("option");o.value=c.name;dl.appendChild(o)});
}
function pull(manual){
  if(!token||queue.length||busy||(ui&&!manual))return Promise.resolve();
  return api({tipo:"datos",since:manual?"":ver}).then(function(r){
    if(!r.ok)throw new Error(r.error);
    if(!r.same){processData(r);localStorage.setItem("arenado_cache",JSON.stringify(r));render()}
    setGs("Conectado","ok");
  }).catch(function(e){if(e.message!=="auth")setGs("Sin conexión","err")});
}
$("#sync-btn").onclick=function(){
  var b=$("#sync-btn");b.classList.add("spin");setGs("Sincronizando...","wait");
  flush().then(function(){return pull(true)}).then(function(){b.classList.remove("spin")});
};
function enter(u,a,t){
  loggedUser=u;loggedUserAccess=a;token=t;
  localStorage.setItem("arenado_user",u);localStorage.setItem("arenado_access",a);localStorage.setItem("arenado_token",t);
  $("#current-user").textContent="Usuario: "+u+" ("+a.split(" ")[0]+")";
  $("#login-overlay").style.display="none";render();pull(true);
}
function gsInit(){
  var u=localStorage.getItem("arenado_user"),a=localStorage.getItem("arenado_access"),lb=$("#l-btn");
  lb.textContent="Iniciar Sesión";lb.disabled=false;
  if(token&&u&&a){
    try{processData(JSON.parse(localStorage.getItem("arenado_cache")))}catch(e){}
    loggedUser=u;loggedUserAccess=a;$("#current-user").textContent="Usuario: "+u+" ("+a.split(" ")[0]+")";
    $("#login-overlay").style.display="none";render();setGs("Sincronizando...","wait");
    flush().then(function(){return pull(true)});
  }else setGs("Listo","ok");
  setInterval(function(){if(!document.hidden)flush().then(function(){return pull()})},15000);
  window.addEventListener("online",function(){flush()});
}
function gsRow(i){var c=calc(i);return [today(),i.num||"S/N",i.elab||loggedUser,i.proyecto||i.work||"Servicio general",(i.items||[]).reduce(function(a,t){return a+t.qty},0),(i.items||[]).map(function(t){return t.qty+" "+t.und+" de "+t.work}).join(", "),c.tot,c.adel]}
function gsSaveCliente(i){send({tipo:"cliente",row:[i.name,i.ruc||"",i.atencion||"",i.tel||"",i.correo||""]})}
function gsSaveHistorico(i){send({tipo:"historico",row:gsRow(i)})}
function gsSyncTarjeta(i){
  i.gs="wait";render();
  var t=JSON.parse(JSON.stringify(i));delete t.gs;
  send({tipo:"sync_tarjeta",tarjeta:t}).then(function(){i.gs=queue.length?"err":"ok";if(!ui)render()});
}
function gsDeleteTarjeta(id){send({tipo:"borrar_tarjeta",id:id})}

/* Modal de Login */
$("#l-toggle").onclick=function(){
  isRegisterMode=!isRegisterMode;
  $("#l-title").textContent=isRegisterMode?"Crear Cuenta":"Iniciar Sesión";
  $("#l-desc").textContent=isRegisterMode?"Añadir miembro al equipo":"Acceso al sistema centralizado";
  $("#l-btn").textContent=isRegisterMode?"Crear y Entrar":"Iniciar Sesión";
  $("#register-fields").style.display=isRegisterMode?"block":"none";
  $("#l-toggle").textContent=isRegisterMode?"Ya tengo cuenta. Iniciar sesión.":"Crear nueva cuenta";
  $("#l-err").textContent="";
};
$("#l-pass").addEventListener("keydown",function(e){if(e.key==="Enter")$("#l-btn").click()});
$("#l-btn").onclick=function(){
  var u=$("#l-user").value.trim().toUpperCase(),p=$("#l-pass").value.trim(),b=$("#l-btn"),er=$("#l-err");
  if(!u||!p){er.textContent="Ingresa usuario y contraseña.";return}
  b.disabled=true;er.textContent="";
  var body=isRegisterMode?{tipo:"registro",user:u,pass:p,access:$("#l-access").value,code:$("#l-code").value.trim()}:{tipo:"login",user:u,pass:p};
  api(body).then(function(r){
    if(!r.ok){er.textContent=r.error||"Error";b.disabled=false;return}
    enter(r.user,r.access,r.token);
  }).catch(function(){er.textContent="Error de conexión. Verifica tu internet y la URL en js/config.js.";b.disabled=false});
};

/* Plantilla Cobranza */
function fillSel(){
  var s=$("#sel"),p=pending(),old=s.value;s.textContent="";
  if(p.length>1){var o=el("option",null,"Todos los pendientes ("+p.length+")");o.value="all";s.appendChild(o)}
  p.forEach(function(i){var o=el("option",null,i.name+" — "+i.work);o.value=i.id;s.appendChild(o)});
  if([].some.call(s.options,function(o){return o.value===old}))s.value=old;
  showDoc();
}
function sel(){var p=pending(),v=$("#sel").value;return v==="all"||!v?p:p.filter(function(i){return i.id===v})}
function showDoc(){var b=$("#docbox");b.textContent="";var l=sel();if(!l.length){b.appendChild(el("div","empty","No hay deudas pendientes."));return}b.appendChild(buildDoc(l))}
function T(tag,cls,txt,kids){var e=el(tag,cls,txt);(kids||[]).forEach(function(k){e.appendChild(k)});return e}
function buildDoc(l){
  var one=l.length===1,x=l[0],S={sub:0,igv:0,tot:0,adel:0,sal:0};
  l.forEach(function(i){var c=calc(i);for(var k in S)S[k]+=c[k]});
  var d=el("div","doc");
  d.appendChild(T("div","dh",null,[T("div","bdg",null,[T("b",null,"ARENADO"),T("small",null,"24 HORAS")]),
    T("div","c",null,[T("b",null,E.name),T("div",null,"RUC :"+E.ruc),T("div",null,"Oficina Principal: "+E.ofi),T("div",null,"Sede 1: "+E.sede)])]));
  d.appendChild(el("div","pn","Presupuesto "+(one&&x.num?x.num:"—")+"  ·  ESTADO DE CUENTA / COBRANZA"));
  function P(a,b){return T("p",null,null,[T("span",null,a),document.createTextNode(b||"")])}
  d.appendChild(T("div","inf",null,[
    T("div","r",null,[P("Sres:",one?x.name:"Varios"),P("RUC:",one?x.ruc:""),P("Encargado:",one?x.atencion:""),P("Telf.",one?x.tel:""),P("Correo:",one?x.correo:""),P("Proyecto:",one?(x.proyecto||x.work):"Varios")]),
    T("div","r",null,[P("Fecha",today().split(" ")[0]),P("Términos",one?x.terminos:""),P("Elaborado",one?x.elab:""),P("Telf",E.telf)])]));
  var t=el("table"),th=el("tr");["Item","Descripción","Cantidad","Und.","P. U.","P.P"].forEach(function(h){th.appendChild(el("th",null,h))});t.appendChild(th);
  l.forEach(function(i,k){
    var tb=el("tr","tb"),c=calc(i);tb.appendChild(el("td",null,String(k+1)));var tt=el("td",null,(one?"":i.name+" · ")+(i.proyecto||i.items[0].work));tt.colSpan=5;tb.appendChild(tt);t.appendChild(tb);
    i.items.forEach(function(it){var r=el("tr");r.appendChild(el("td"));r.appendChild(el("td",null,it.work));
      [num(it.qty),it.und,"S/ "+num(it.pu),"S/ "+num(it.qty*it.pu)].forEach(function(v){r.appendChild(el("td","n",v))});t.appendChild(r)});
  });
  [["SUBTOTAL",S.sub],["IGV",S.igv],["TOTAL",S.tot],["ADELANTO RECIBIDO",S.adel],["SALDO A PAGAR",S.sal]].forEach(function(r,j){
    var tr=el("tr","tot"+(j>2?" s":"")),a=el("td","l",r[0]);a.colSpan=5;tr.appendChild(a);tr.appendChild(el("td","v",money(r[1])));t.appendChild(tr)});
  d.appendChild(t);
  var cs=el("div","cons");cs.appendChild(T("u",null,"Consideraciones de la oferta:"));
  E.consid.forEach(function(c,j){cs.appendChild(el("p",null,String.fromCharCode(97+j)+") "+c))});d.appendChild(cs);
  d.appendChild(el("div","cu","CUENTAS DE DEPOSITO"));
  d.appendChild(T("div","ac",null,[T("div","r",null,E.cuentas.map(function(c){return el("p",null,c)})),el("i",null,"Dpto. Costos y presupuestos")]));
  d.appendChild(el("div","cf","¡CONFIA EN LOS EXPERTOS!"));
  return d;
}
$("#sum").onclick=function(){fillSel();$("#panel").classList.add("open");setTimeout(function(){$("#panel").scrollIntoView({behavior:"smooth",block:"start"})},200)};
$("#sel").onchange=showDoc;
$("#hide").onclick=function(){$("#panel").classList.remove("open")};
$("#print").onclick=function(){try{window.print()}catch(e){}};
$("#copy").onclick=function(){
  var b=$("#copy"),l=sel();if(!l.length)return;var t=l.map(function(i){var c=calc(i);return i.name+" - "+(i.proyecto||i.work)+" | Total "+money(c.tot)+" | Saldo "+money(c.sal)}).join("\n")+"\nTOTAL A COBRAR: "+money(l.reduce(function(s,i){return s+calc(i).sal},0)),ok=function(){b.textContent="¡Copiado!";setTimeout(function(){b.textContent="Copiar Texto"},1500)};
  var a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();try{document.execCommand("copy")}catch(e){}a.remove();ok();
};

$("#add").onclick=function(){
  if(busy)return;
  var i={id:"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:"",status:"pedido"};
  items.unshift(i);
  ui={id:i.id,mode:"name"};
  render(i.id);
  setTimeout(function(){ document.querySelector('.card.in input').focus(); }, 300);
};

gsInit();
})();
