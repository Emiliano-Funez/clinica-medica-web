require('dotenv').config();
const express=require('express'),mysql=require('mysql2/promise'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),path=require('path');
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const db=mysql.createPool({host:process.env.DB_HOST||'localhost',port:+process.env.DB_PORT||3306,user:process.env.DB_USER||'root',password:process.env.DB_PASS||'',database:process.env.DB_NAME||'clinicamed',dateStrings:true});
const SECRET=process.env.JWT_SECRET||'cambiar-esto';
const wrap=f=>(q,s,n)=>f(q,s,n).catch(e=>{console.error(e);s.status(500).json({error:'Error del servidor'})});
const fail=(s,c,m)=>s.status(c).json({error:m});
const USER_SQL=`SELECT p.id_persona id,p.nombre,p.apellido,p.dni,p.email,p.contrasena,r.nombre rol,e.id_especialidad esp
 FROM persona p JOIN persona_rol pr ON pr.id_persona=p.id_persona JOIN rol r ON r.id_rol=pr.id_rol
 LEFT JOIN especialista e ON e.id_persona_rol=pr.id_persona_rol`;
const out=({contrasena,...u})=>u;
const token=u=>jwt.sign({id:u.id,rol:u.rol},SECRET,{expiresIn:'8h'});
const auth=(...roles)=>(q,s,n)=>{try{q.u=jwt.verify((q.headers.authorization||'').slice(7),SECRET)}catch{return fail(s,401,'Sesión vencida. Ingresá de nuevo.')}
  if(roles.length&&!roles.includes(q.u.rol))return fail(s,403,'No tenés permiso para esta acción.');n()};
const prId=async(id,rol)=>{const[r]=await db.query('SELECT pr.id_persona_rol i FROM persona_rol pr JOIN rol ro ON ro.id_rol=pr.id_rol WHERE pr.id_persona=? AND ro.nombre=?',[id,rol]);return r[0]&&r[0].i};
async function crearPersona(b,rol,pass){
  const[d]=await db.query('SELECT 1 FROM persona WHERE email=? OR dni=?',[b.email,b.dni]);if(d.length)return null;
  const[r]=await db.query('INSERT INTO persona(nombre,apellido,dni,fecha_nacimiento,email,contrasena,num_celular) VALUES(?,?,?,?,?,?,?)',
    [b.nombre,b.apellido,b.dni,b.fecha_nacimiento||null,b.email,await bcrypt.hash(pass,10),b.telefono||null]);
  await db.query('INSERT INTO persona_rol(id_persona,id_rol) SELECT ?,id_rol FROM rol WHERE nombre=?',[r.insertId,rol]);return r.insertId}

app.post('/api/login',wrap(async(q,s)=>{const[r]=await db.query(USER_SQL+' WHERE p.email=?',[(q.body.email||'').trim()]);const u=r[0];
  if(!u||!await bcrypt.compare(q.body.password||'',u.contrasena))return fail(s,401,'Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.');
  s.json({token:token(u),user:out(u)})}));
app.post('/api/registro',wrap(async(q,s)=>{const b=q.body;
  if(!b.nombre||!b.apellido||!b.dni||!b.email||(b.password||'').length<8)return fail(s,400,'Completá todos los campos. La contraseña necesita al menos 8 caracteres.');
  const id=await crearPersona(b,'paciente',b.password);if(!id)return fail(s,409,'Ese email o DNI ya está registrado. Ingresá a tu cuenta.');
  const[r]=await db.query(USER_SQL+' WHERE p.id_persona=?',[id]);s.json({token:token(r[0]),user:out(r[0])})}));
app.get('/api/yo',auth(),wrap(async(q,s)=>{const[r]=await db.query(USER_SQL+' WHERE p.id_persona=?',[q.u.id]);r[0]?s.json({user:out(r[0])}):fail(s,401,'Sesión inválida.')}));

// Datos visibles según el rol (el paciente nunca recibe datos de otros pacientes)
app.get('/api/datos',auth(),wrap(async(q,s)=>{const{id,rol}=q.u;
  const T=`SELECT t.id_turno id,prp.id_persona pac,pre.id_persona esp,t.fecha,LEFT(t.horario,5) hora,t.estado FROM turno t
   JOIN persona_rol prp ON prp.id_persona_rol=t.id_paciente JOIN persona_rol pre ON pre.id_persona_rol=t.id_especialista`;
  let turno;
  if(rol=='paciente'){const[a]=await db.query(T+' WHERE prp.id_persona=?',[id]);
    const[o]=await db.query(T+" WHERE prp.id_persona<>? AND t.estado<>'cancelado'",[id]);
    turno=a.concat(o.map(t=>({id:-t.id,pac:0,esp:t.esp,fecha:t.fecha,hora:t.hora,estado:'ocupado'})))}
  else if(rol=='especialista'){[turno]=await db.query(T+` WHERE prp.id_persona IN (SELECT prp2.id_persona FROM turno t2
    JOIN persona_rol prp2 ON prp2.id_persona_rol=t2.id_paciente JOIN persona_rol pre2 ON pre2.id_persona_rol=t2.id_especialista WHERE pre2.id_persona=?)`,[id])}
  else[turno]=await db.query(T);
  const ids=[...new Set(turno.map(t=>t.pac).filter(Boolean).concat(id))];
  const[persona]=await db.query(USER_SQL.replace('p.email,p.contrasena','p.email')+(rol=='recepcion'?'':' WHERE r.nombre=\'especialista\' OR p.id_persona IN (?)'),rol=='recepcion'?[]:[ids]);
  let historial=[];
  if(rol!='recepcion'){const pids=turno.map(t=>t.pac).filter(Boolean);
    if(pids.length)[historial]=await db.query(`SELECT h.id_turno turno,h.motivo,h.resultado FROM historial_clinico h WHERE h.id_turno IN (?)`,[turno.map(t=>t.id).filter(x=>x>0)])}
  const[especialidad]=await db.query('SELECT id_especialidad id,nombre FROM especialidad');
  const extra=rol=='recepcion'?{notif:await notificador.resumen(),canales:notificador.disponibles()}:{};
  s.json({especialidad,persona,turno,historial,...extra})}));

app.post('/api/turnos',auth('paciente','recepcion'),wrap(async(q,s)=>{const b=q.body,rol=q.u.rol;
  const pac=rol=='paciente'?q.u.id:+b.pac;if(!pac||!b.esp||!/^\d{4}-\d\d-\d\d$/.test(b.fecha||'')||!/^\d\d:\d\d$/.test(b.hora||''))return fail(s,400,'Faltan datos del turno.');
  const[ip,ie,ic]=await Promise.all([prId(pac,'paciente'),prId(b.esp,'especialista'),prId(q.u.id,rol)]);
  if(!ip||!ie)return fail(s,400,'Paciente o especialista inválido.');
  try{const[ins]=await db.query('INSERT INTO turno(id_paciente,id_especialista,id_creador,fecha,horario,estado) VALUES(?,?,?,?,?,?)',[ip,ie,ic,b.fecha,b.hora,rol=='paciente'?'pendiente':'confirmado']);if(rol=='recepcion'){const avisos=await conTimeout(avisar(ins.insertId,'confirmacion',{canal:CANALES_VALIDOS.includes(b.canal)?b.canal:undefined}),8000);s.json({ok:true,avisos})}
    else{s.json({ok:true});avisar(ins.insertId,'confirmacion')}}
  catch(e){if(e.code=='ER_DUP_ENTRY')return fail(s,409,'Ese horario acaba de ocuparse. Elegí otro.');throw e}}));

app.patch('/api/turnos/:id',auth('paciente','recepcion'),wrap(async(q,s)=>{const e=q.body.estado;
  const[r]=await db.query('SELECT prp.id_persona pac,t.estado FROM turno t JOIN persona_rol prp ON prp.id_persona_rol=t.id_paciente WHERE t.id_turno=?',[q.params.id]);const t=r[0];
  if(!t)return fail(s,404,'Turno inexistente.');
  if(q.u.rol=='paciente'&&(t.pac!=q.u.id||e!='cancelado'))return fail(s,403,'Solo podés cancelar tus propios turnos.');
  if(!['confirmado','cancelado'].includes(e)||['atendido','cancelado'].includes(t.estado))return fail(s,400,'Cambio de estado no permitido.');
  await db.query('UPDATE turno SET estado=? WHERE id_turno=?',[e,q.params.id]);s.json({ok:true});avisar(+q.params.id,e=='cancelado'?'cancelacion':'confirmado')}));

app.post('/api/historial',auth('especialista'),wrap(async(q,s)=>{const b=q.body;
  if(!(b.motivo||'').trim()||!(b.resultado||'').trim())return fail(s,400,'Faltan campos obligatorios: motivo y resultado.');
  const ie=await prId(q.u.id,'especialista');const[r]=await db.query('SELECT estado FROM turno WHERE id_turno=? AND id_especialista=?',[b.turno,ie]);
  if(!r[0])return fail(s,404,'Ese turno no está en tu agenda.');if(r[0].estado=='atendido')return fail(s,409,'Ese turno ya tiene historial cargado.');
  await db.query('INSERT INTO historial_clinico(id_turno,id_persona_rol,motivo,resultado) VALUES(?,?,?,?)',[b.turno,ie,b.motivo.trim(),b.resultado.trim()]);
  await db.query("UPDATE turno SET estado='atendido' WHERE id_turno=?",[b.turno]);s.json({ok:true})}));

app.post('/api/pacientes',auth('recepcion'),wrap(async(q,s)=>{const b=q.body;
  if(!b.nombre||!b.apellido||!b.dni||!b.email||!b.telefono)return fail(s,400,'Completá los campos obligatorios.');
  const id=await crearPersona(b,'paciente',require('crypto').randomBytes(12).toString('hex'));
  id?s.json({id}):fail(s,409,'El paciente ya está registrado.')}));

// ---- Sede (Google Maps) ----
// Datos de la clínica desde .env. Esta ruta es pública: la API key de Maps JavaScript
// viaja al navegador por diseño, por eso se restringe por dominio en Google Cloud.
const originsPermitidos=(process.env.FRONTEND_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
function corsSede(q,s,next){
  const origin=q.get('Origin');
  let hostLocal=false;
  try{hostLocal=['localhost','127.0.0.1'].includes(new URL(origin).hostname)}catch{}
  if(origin&&(hostLocal||originsPermitidos.includes(origin))){s.set('Access-Control-Allow-Origin',origin);s.vary('Origin')}
  next();
}
app.get('/api/sede',corsSede,(q,s)=>{const lat=parseFloat(process.env.SEDE_LAT),lng=parseFloat(process.env.SEDE_LNG);
  s.json({nombre:process.env.SEDE_NOMBRE||'ClinicaMed',direccion:process.env.SEDE_DIRECCION||'',
    lat:Number.isFinite(lat)?lat:null,lng:Number.isFinite(lng)?lng:null,mapsKey:process.env.GOOGLE_MAPS_API_KEY||'',
    mapId:process.env.SEDE_MAP_ID||'DEMO_MAP_ID'})});

// ---- Notificaciones: Gmail API, SMS Masivos y (a futuro) WhatsApp Cloud API ----
// Los avisos solo llevan datos del turno, nunca información clínica. Siempre se envían DESPUÉS de guardar el turno
// y un fallo de envío nunca deshace ni rompe la operación que lo originó.
const cron=require('node-cron');
const{crearNotificador,canalesPorDefecto,CANALES_VALIDOS}=require('./services/notificaciones');
const{crearRepoMysql}=require('./services/notificacionesRepo');
const lista=(v,d)=>(v||d).split(',').map(x=>x.trim()).filter(Boolean);
const notificador=crearNotificador({repo:crearRepoMysql(db),canales:canalesPorDefecto(process.env),
  config:{canalPredeterminado:CANALES_VALIDOS.includes(process.env.NOTIF_CANAL_PREDETERMINADO)?process.env.NOTIF_CANAL_PREDETERMINADO:'auto',
    canalesAuto:lista(process.env.NOTIF_CANALES_AUTO,'email,sms'),
    sede:{nombre:process.env.SEDE_NOMBRE||'ClínicaMed',direccion:process.env.SEDE_DIRECCION||''}}});
const conTimeout=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
const avisar=(id,tipo,o={})=>notificador.notificar({idTurno:id,tipo,...o}).catch(e=>{console.error('[notificaciones]',e.message);return[]});

// Historial de avisos de un turno (para que recepción vea si salieron bien).
app.get('/api/turnos/:id/notificaciones',auth('recepcion'),wrap(async(q,s)=>s.json({notificaciones:await notificador.historial(+q.params.id)})));
// Reenvío manual del último aviso del turno, eligiendo el canal (auto | email | sms | whatsapp).
app.post('/api/turnos/:id/notificar',auth('recepcion'),wrap(async(q,s)=>{
  const canal=CANALES_VALIDOS.includes(q.body.canal)?q.body.canal:'auto';
  const[r]=await db.query('SELECT estado FROM turno WHERE id_turno=?',[q.params.id]);if(!r[0])return fail(s,404,'Turno inexistente.');
  const tipo=r[0].estado=='cancelado'?'cancelacion':r[0].estado=='confirmado'?'confirmado':'confirmacion';
  s.json({avisos:await avisar(+q.params.id,tipo,{canal,forzar:true})})}));
// Reprogramación: cambia fecha y hora y avisa al paciente. (Todavía no hay botón en la pantalla.)
app.patch('/api/turnos/:id/reprogramar',auth('recepcion'),wrap(async(q,s)=>{const b=q.body;
  if(!/^\d{4}-\d\d-\d\d$/.test(b.fecha||'')||!/^\d\d:\d\d$/.test(b.hora||''))return fail(s,400,'Faltan la fecha y la hora nuevas.');
  const[r]=await db.query('SELECT estado FROM turno WHERE id_turno=?',[q.params.id]);if(!r[0])return fail(s,404,'Turno inexistente.');
  if(!['pendiente','confirmado'].includes(r[0].estado))return fail(s,400,'Solo se pueden reprogramar turnos pendientes o confirmados.');
  try{await db.query('UPDATE turno SET fecha=?,horario=? WHERE id_turno=?',[b.fecha,b.hora,q.params.id])}
  catch(e){if(e.code=='ER_DUP_ENTRY')return fail(s,409,'Ese horario ya está ocupado.');throw e}
  const avisos=await conTimeout(avisar(+q.params.id,'modificacion',{canal:CANALES_VALIDOS.includes(b.canal)?b.canal:undefined}),8000);s.json({ok:true,avisos})}));

// Recordatorios (24 h y 2 h antes) y reintentos: cada 15 minutos. Si no hay ningún canal configurado no se programan.
if(notificador.hayCanales()&&process.env.NOTIF_RECORDATORIOS!=='0'){let enCurso=false;
  cron.schedule('*/15 * * * *',async()=>{if(enCurso)return;enCurso=true;
    try{await notificador.recordatorios();await notificador.reintentar()}catch(e){console.error('[notificaciones] tarea programada:',e.message)}finally{enCurso=false}},{timezone:'America/Argentina/Buenos_Aires'})}
// Para probar sin esperar: recepción dispara recordatorios y reintentos a mano.
app.post('/api/recordatorios/ejecutar',auth('recepcion'),wrap(async(q,s)=>s.json({enviados:await notificador.recordatorios(),reintentos:await notificador.reintentar()})));
{const d=notificador.disponibles();console.log('[notificaciones] correo:',d.email?'activo':'sin configurar','| SMS:',d.sms?(process.env.SMS_MASIVOS_TEST==='1'?'activo (MODO PRUEBA, no envía)':'activo'):'sin configurar','| WhatsApp:',d.whatsapp?'activo':'no disponible todavía')}

app.listen(process.env.PORT||3000,()=>console.log('ClinicaMed en http://localhost:'+(process.env.PORT||3000)));
