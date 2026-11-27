require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const frontDir = path.resolve(__dirname, '..');
app.get('/', (q, s) => s.sendFile(path.join(frontDir, 'index.html')));
app.use('/js', express.static(path.join(frontDir, 'js')));
app.use('/pages', express.static(path.join(frontDir, 'pages')));
app.use('/styles', express.static(path.join(frontDir, 'styles')));

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'clinicamed',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
});
const SECRET = process.env.JWT_SECRET || 'cambiar-esto';

// El front corre normalmente con Live Server; permite loopback y los orígenes indicados en .env.
const originsPermitidos = (process.env.FRONTEND_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
function esOrigenPermitido(origin) {
  if (originsPermitidos.includes(origin)) return true;
  try { return ['localhost', '127.0.0.1'].includes(new URL(origin).hostname); } catch { return false; }
}
app.use((q, s, n) => {
  const origin = q.get('Origin');
  if (origin && !esOrigenPermitido(origin)) return s.status(403).json({ error: 'Origen no permitido.' });
  if (origin) {
    s.set('Access-Control-Allow-Origin', origin);
    s.set('Access-Control-Allow-Credentials', 'true');
    s.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    s.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    s.vary('Origin');
  }
  if (q.method === 'OPTIONS') return s.sendStatus(204);
  n();
});

const wrap = f => (q, s, n) => Promise.resolve(f(q, s, n)).catch(e => {
  console.error('[api]', e.code || e.name || 'error', e.message);
  if (!s.headersSent) s.status(500).json({ error: 'Error del servidor.' });
});
const fail = (s, c, m) => s.status(c).json({ error: m });
const rolBD = rol => rol === 'recepcion' ? 'ADMINISTRATIVO' : String(rol || '').toUpperCase();
const rolApp = rol => String(rol).toUpperCase() === 'ADMINISTRATIVO' ? 'recepcion' : String(rol).toLowerCase();

// La base existente usa password_hash y persona_especialidad (no contrasena/especialista).
const USER_SQL = `SELECT p.id_persona id,p.nombre,p.apellido,p.dni,p.email,
    p.password_hash contrasena,p.fecha_nacimiento,p.num_celular telefono,p.activo,
    ${"CASE WHEN UPPER(r.nombre)='ADMINISTRATIVO' THEN 'recepcion' ELSE LOWER(r.nombre) END"} rol,
    e.id_especialidad esp
  FROM persona p
  JOIN persona_rol pr ON pr.id_persona=p.id_persona
  JOIN rol r ON r.id_rol=pr.id_rol
  LEFT JOIN persona_especialidad e ON e.id_persona_rol=pr.id_persona_rol`;
const out = ({ contrasena, ...u }) => u;
const token = u => jwt.sign({ id: u.id, rol: u.rol }, SECRET, { expiresIn: '8h' });
const auth = (...roles) => (q, s, n) => {
  try {
    const header = q.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new Error('token');
    q.u = jwt.verify(header.slice(7), SECRET);
  } catch { return fail(s, 401, 'Sesión vencida. Ingresá de nuevo.'); }
  if (roles.length && !roles.includes(q.u.rol)) return fail(s, 403, 'No tenés permiso para esta acción.');
  n();
};
const prId = async (id, rol) => {
  const [r] = await db.query(`SELECT pr.id_persona_rol i FROM persona_rol pr
    JOIN rol ro ON ro.id_rol=pr.id_rol WHERE pr.id_persona=? AND UPPER(ro.nombre)=?`, [id, rolBD(rol)]);
  return r[0] && r[0].i;
};
async function conflictoHorario({ pacienteRolId, especialistaRolId, fecha, hora, excluirTurnoId }) {
  const [r] = await db.query(`SELECT MAX(id_persona_rol_paciente=?) paciente,MAX(id_persona_rol_especialista=?) especialista
    FROM turno WHERE fecha=? AND horario=? AND horario_ocupado=1
      AND (? IS NULL OR id_turno<>?)
      AND (id_persona_rol_paciente=? OR id_persona_rol_especialista=?)`,
  [pacienteRolId, especialistaRolId, fecha, hora, excluirTurnoId ?? null, excluirTurnoId ?? null, pacienteRolId, especialistaRolId]);
  return r[0];
}
const mensajeConflictoHorario = (e) => {
  const mensaje = String(e.message || '');
  if (mensaje.includes('uq_turno_paciente_fecha_horario')) return 'El paciente ya tiene otro turno ese día y a esa hora.';
  if (mensaje.includes('uq_turno_especialista_fecha_horario')) return 'Ese horario del especialista ya está ocupado.';
  return 'Ese horario ya no está disponible. Elegí otro.';
};

async function crearPersona(b, rol, pass) {
  const email = String(b.email || '').trim().toLowerCase();
  const dni = String(b.dni || '').trim();
  const [d] = await db.query('SELECT 1 FROM persona WHERE email=? OR dni=?', [email, dni]);
  if (d.length) return null;
  const hash = await bcrypt.hash(pass, 10);
  const [r] = await db.query(`INSERT INTO persona
    (nombre,apellido,dni,fecha_nacimiento,email,password_hash,num_celular)
    VALUES(?,?,?,?,?,?,?)`, [String(b.nombre || '').trim(), String(b.apellido || '').trim(), dni,
      b.fecha_nacimiento || b.fechaNacimiento || null, email, hash, b.telefono || b.num_celular || null]);
  const [asig] = await db.query('INSERT INTO persona_rol(id_persona,id_rol) SELECT ?,id_rol FROM rol WHERE UPPER(nombre)=?', [r.insertId, rolBD(rol)]);
  if (!asig.affectedRows) throw new Error(`No existe el rol ${rolBD(rol)} en la base.`);
  return r.insertId;
}

async function claveValida(entrada, hashGuardado, idPersona) {
  if (!hashGuardado) return false;
  try { if (await bcrypt.compare(entrada, hashGuardado)) return true; } catch { /* puede ser un hash del modo demo anterior */ }
  const pbkdf = /^pbkdf2:sha256:(\d+)\$([^$]+)\$([a-f0-9]+)$/i.exec(hashGuardado);
  if (pbkdf && Number(pbkdf[1]) <= 1000000) {
    const digest = crypto.pbkdf2Sync(entrada, pbkdf[2], Number(pbkdf[1]), pbkdf[3].length / 2, 'sha256').toString('hex');
    const coincide = crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(pbkdf[3], 'hex'));
    if (coincide) await db.query('UPDATE persona SET password_hash=? WHERE id_persona=?', [await bcrypt.hash(entrada, 10), idPersona]);
    return coincide;
  }
  if (/^[a-f0-9]{64}$/i.test(hashGuardado)) {
    const digest = crypto.createHash('sha256').update(entrada).digest('hex');
    const coincide = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hashGuardado.toLowerCase()));
    if (coincide) await db.query('UPDATE persona SET password_hash=? WHERE id_persona=?', [await bcrypt.hash(entrada, 10), idPersona]);
    return coincide;
  }
  return false;
}

app.post('/api/login', wrap(async (q, s) => {
  const [r] = await db.query(USER_SQL + ' WHERE LOWER(p.email)=?', [String(q.body.email || '').trim().toLowerCase()]);
  const u = r[0];
  if (!u || !u.activo || !await claveValida(q.body.password || q.body.clave || '', u.contrasena, u.id))
    return fail(s, 401, 'Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.');
  s.json({ token: token(u), user: out(u) });
}));

app.post('/api/registro', wrap(async (q, s) => {
  const b = q.body;
  const password = b.password || b.clave || '';
  if (!b.nombre || !b.apellido || !b.dni || !b.email || password.length < 8)
    return fail(s, 400, 'Completá los campos. La contraseña necesita al menos 8 caracteres.');
  const id = await crearPersona(b, 'paciente', password);
  if (!id) return fail(s, 409, 'Ese email o DNI ya está registrado. Ingresá a tu cuenta.');
  const [r] = await db.query(USER_SQL + ' WHERE p.id_persona=?', [id]);
  s.json({ token: token(r[0]), user: out(r[0]) });
}));
app.get('/api/yo', auth(), wrap(async (q, s) => {
  const [r] = await db.query(USER_SQL + ' WHERE p.id_persona=?', [q.u.id]);
  r[0] ? s.json({ user: out(r[0]) }) : fail(s, 401, 'Sesión inválida.');
}));

// Catálogo público para la portada; no incluye pacientes, turnos ni historiales.
app.get('/api/catalogos', wrap(async (q, s) => {
  const [especialidades] = await db.query('SELECT id_especialidad id,nombre,descripcion FROM especialidad ORDER BY nombre');
  const [especialistas] = await db.query(`SELECT DISTINCT p.id_persona id,p.id_persona usuarioId,
      p.nombre,p.apellido,pe.id_especialidad especialidadId
    FROM persona p JOIN persona_rol pr ON pr.id_persona=p.id_persona
    JOIN rol r ON r.id_rol=pr.id_rol
    LEFT JOIN persona_especialidad pe ON pe.id_persona_rol=pr.id_persona_rol
    WHERE UPPER(r.nombre)='ESPECIALISTA' AND p.activo=1 ORDER BY p.apellido,p.nombre`);
  s.json({ especialidades, especialistas });
}));

// Datos con la forma que ya consume el front-end. Los pacientes solo reciben su ficha,
// sus turnos/historial y horarios ocupados sin datos personales de otros pacientes.
app.get('/api/datos', auth(), wrap(async (q, s) => {
  const { id, rol } = q.u;
  const [especialidades] = await db.query('SELECT id_especialidad id,nombre,descripcion FROM especialidad ORDER BY nombre');
  const [especialistas] = await db.query(`SELECT DISTINCT p.id_persona id,p.id_persona usuarioId,
      p.nombre,p.apellido,pe.id_especialidad especialidadId
    FROM persona p JOIN persona_rol pr ON pr.id_persona=p.id_persona
    JOIN rol r ON r.id_rol=pr.id_rol
    LEFT JOIN persona_especialidad pe ON pe.id_persona_rol=pr.id_persona_rol
    WHERE UPPER(r.nombre)='ESPECIALISTA' ORDER BY p.apellido,p.nombre`);

  let patientSql = `SELECT DISTINCT p.id_persona id,p.id_persona usuarioId,p.nombre,p.apellido,p.dni,
      p.fecha_nacimiento fechaNacimiento,p.num_celular telefono,p.email
    FROM persona p JOIN persona_rol pr ON pr.id_persona=p.id_persona
    JOIN rol r ON r.id_rol=pr.id_rol WHERE UPPER(r.nombre)='PACIENTE'`;
  let patientsParams = [];
  if (rol === 'paciente') { patientSql += ' AND p.id_persona=?'; patientsParams = [id]; }
  else if (rol === 'especialista') {
    patientSql += ` AND EXISTS (SELECT 1 FROM turno tx
      JOIN persona_rol px ON px.id_persona_rol=tx.id_persona_rol_paciente
      JOIN persona_rol dx ON dx.id_persona_rol=tx.id_persona_rol_especialista
      WHERE px.id_persona=p.id_persona AND dx.id_persona=?)`;
    patientsParams = [id];
  }
  patientSql += ' ORDER BY p.apellido,p.nombre';
  const [pacientes] = await db.query(patientSql, patientsParams);

  const turnSql = `SELECT t.id_turno id,pp.id_persona pacienteId,pe.id_persona especialistaId,
      DATE_FORMAT(t.fecha,'%Y-%m-%d') fecha,LEFT(t.horario,5) hora,LOWER(t.estado) estado
    FROM turno t
    JOIN persona_rol rp ON rp.id_persona_rol=t.id_persona_rol_paciente
    JOIN persona pp ON pp.id_persona=rp.id_persona
    JOIN persona_rol re ON re.id_persona_rol=t.id_persona_rol_especialista
    JOIN persona pe ON pe.id_persona=re.id_persona`;
  let turnos = [];
  if (rol === 'paciente') {
    const [propios] = await db.query(turnSql + ' WHERE pp.id_persona=? ORDER BY t.fecha,t.horario', [id]);
    const [ocupados] = await db.query(turnSql + " WHERE pp.id_persona<>? AND UPPER(t.estado)<>'CANCELADO' ORDER BY t.fecha,t.horario", [id]);
    turnos = propios.concat(ocupados.map(t => ({ ...t, id: -t.id, pacienteId: 0, estado: 'ocupado' })));
  } else if (rol === 'especialista') {
    [turnos] = await db.query(turnSql + ' WHERE pe.id_persona=? ORDER BY t.fecha,t.horario', [id]);
  } else {
    [turnos] = await db.query(turnSql + ' ORDER BY t.fecha,t.horario');
  }

  let historial = [];
  if (rol === 'paciente') {
    [historial] = await db.query(`SELECT h.id_historial id,rp.id_persona pacienteId,
        re.id_persona especialistaId,h.id_turno turnoId,DATE_FORMAT(h.fecha_registro,'%Y-%m-%d') fecha,
        h.motivo,h.resultado
      FROM historial_clinico h JOIN turno t ON t.id_turno=h.id_turno
      JOIN persona_rol rp ON rp.id_persona_rol=t.id_persona_rol_paciente
      JOIN persona_rol re ON re.id_persona_rol=h.id_persona_rol_carga
      WHERE rp.id_persona=? ORDER BY h.fecha_registro DESC`, [id]);
  } else if (rol === 'especialista') {
    [historial] = await db.query(`SELECT h.id_historial id,rp.id_persona pacienteId,
        re.id_persona especialistaId,h.id_turno turnoId,DATE_FORMAT(h.fecha_registro,'%Y-%m-%d') fecha,
        h.motivo,h.resultado
      FROM historial_clinico h JOIN turno t ON t.id_turno=h.id_turno
      JOIN persona_rol rp ON rp.id_persona_rol=t.id_persona_rol_paciente
      JOIN persona_rol re ON re.id_persona_rol=h.id_persona_rol_carga
      WHERE re.id_persona=? ORDER BY h.fecha_registro DESC`, [id]);
  }
  const extra = rol === 'recepcion' ? { notif: await notificador.resumen(), canales: notificador.disponibles() } : {};
  s.json({ especialidades, especialistas, pacientes, turnos, historial, ...extra });
}));

app.post('/api/turnos', auth('paciente', 'recepcion'), wrap(async (q, s) => {
  const b = q.body;
  const pac = q.u.rol === 'paciente' ? q.u.id : Number(b.pac ?? b.pacienteId);
  const esp = Number(b.esp ?? b.especialistaId);
  if (!pac || !esp || !/^\d{4}-\d\d-\d\d$/.test(b.fecha || '') || !/^\d\d:\d\d$/.test(b.hora || ''))
    return fail(s, 400, 'Faltan datos del turno.');
  const [ip, ie] = await Promise.all([prId(pac, 'paciente'), prId(esp, 'especialista')]);
  if (!ip || !ie) return fail(s, 400, 'Paciente o especialista inválido.');
  const conflicto = await conflictoHorario({ pacienteRolId: ip, especialistaRolId: ie, fecha: b.fecha, hora: b.hora });
  if (Number(conflicto?.paciente)) return fail(s, 409, 'El paciente ya tiene otro turno ese día y a esa hora. Elegí otro horario.');
  if (Number(conflicto?.especialista)) return fail(s, 409, 'Ese horario del especialista ya está ocupado. Elegí otro horario.');
  try {
    const [ins] = await db.query(`INSERT INTO turno
      (id_persona_rol_paciente,id_persona_rol_especialista,fecha,horario,estado)
      VALUES(?,?,?,?,?)`, [ip, ie, b.fecha, b.hora, q.u.rol === 'paciente' ? 'PENDIENTE' : 'CONFIRMADO']);
    s.json({ ok: true, id: ins.insertId, pacienteId: pac, especialistaId: esp, fecha: b.fecha, hora: b.hora,
      estado: q.u.rol === 'paciente' ? 'pendiente' : 'confirmado' });
    avisar(ins.insertId, 'confirmacion');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return fail(s, 409, mensajeConflictoHorario(e));
    throw e;
  }
}));

app.patch('/api/turnos/:id', auth('paciente', 'recepcion'), wrap(async (q, s) => {
  const estado = String(q.body.estado || '').toLowerCase();
  const [r] = await db.query(`SELECT rp.id_persona paciente,t.estado FROM turno t
    JOIN persona_rol rp ON rp.id_persona_rol=t.id_persona_rol_paciente WHERE t.id_turno=?`, [q.params.id]);
  const t = r[0];
  if (!t) return fail(s, 404, 'Turno inexistente.');
  if (q.u.rol === 'paciente' && (t.paciente !== q.u.id || estado !== 'cancelado'))
    return fail(s, 403, 'Solo podés cancelar tus propios turnos.');
  if (!['confirmado', 'cancelado'].includes(estado) || ['atendido', 'cancelado'].includes(String(t.estado).toLowerCase()))
    return fail(s, 400, 'Cambio de estado no permitido.');
  await db.query('UPDATE turno SET estado=? WHERE id_turno=?', [estado.toUpperCase(), q.params.id]);
  s.json({ ok: true });
  avisar(+q.params.id, estado === 'cancelado' ? 'cancelacion' : 'confirmado');
}));

app.patch('/api/turnos/:id/reprogramar', auth('recepcion'), wrap(async (q, s) => {
  const b = q.body;
  if (!/^\d{4}-\d\d-\d\d$/.test(b.fecha || '') || !/^\d\d:\d\d$/.test(b.hora || ''))
    return fail(s, 400, 'Faltan la fecha y la hora nuevas.');
  const [r] = await db.query(`SELECT id_persona_rol_paciente paciente,id_persona_rol_especialista especialista,LOWER(estado) estado
    FROM turno WHERE id_turno=?`, [q.params.id]);
  if (!r[0]) return fail(s, 404, 'Turno inexistente.');
  if (!['pendiente', 'confirmado'].includes(r[0].estado)) return fail(s, 400, 'Solo se pueden reprogramar turnos pendientes o confirmados.');
  const conflicto = await conflictoHorario({ pacienteRolId: r[0].paciente, especialistaRolId: r[0].especialista, fecha: b.fecha, hora: b.hora, excluirTurnoId: Number(q.params.id) });
  if (Number(conflicto?.paciente)) return fail(s, 409, 'El paciente ya tiene otro turno ese día y a esa hora. Elegí otro horario.');
  if (Number(conflicto?.especialista)) return fail(s, 409, 'Ese horario del especialista ya está ocupado. Elegí otro horario.');
  try { await db.query('UPDATE turno SET fecha=?,horario=? WHERE id_turno=?', [b.fecha, b.hora, q.params.id]); }
  catch (e) { if (e.code === 'ER_DUP_ENTRY') return fail(s, 409, mensajeConflictoHorario(e)); throw e; }
  const avisos = await conTimeout(avisar(+q.params.id, 'modificacion', { canal: CANALES_VALIDOS.includes(b.canal) ? b.canal : undefined }), 8000);
  s.json({ ok: true, avisos });
}));

app.post('/api/historial', auth('especialista'), wrap(async (q, s) => {
  const b = q.body;
  if (!(b.motivo || '').trim() || !(b.resultado || '').trim()) return fail(s, 400, 'Faltan campos obligatorios: motivo y resultado.');
  const especialista = await prId(q.u.id, 'especialista');
  const [r] = await db.query(`SELECT LOWER(estado) estado FROM turno
    WHERE id_turno=? AND id_persona_rol_especialista=?`, [b.turno ?? b.turnoId, especialista]);
  if (!r[0]) return fail(s, 404, 'Ese turno no está en tu agenda.');
  if (r[0].estado === 'atendido') return fail(s, 409, 'Ese turno ya tiene historial cargado.');
  const fecha = /^\d{4}-\d\d-\d\d$/.test(b.fecha || '') ? b.fecha : new Date().toISOString().slice(0, 10);
  const [ins] = await db.query(`INSERT INTO historial_clinico
    (id_turno,id_persona_rol_carga,fecha_registro,motivo,resultado) VALUES(?,?,?,?,?)`,
    [b.turno ?? b.turnoId, especialista, fecha, b.motivo.trim(), b.resultado.trim()]);
  await db.query("UPDATE turno SET estado='ATENDIDO' WHERE id_turno=?", [b.turno ?? b.turnoId]);
  s.json({ ok: true, id: ins.insertId });
}));

app.post('/api/pacientes', auth('recepcion'), wrap(async (q, s) => {
  const b = q.body;
  if (!b.nombre || !b.apellido || !b.dni || !b.email || !(b.telefono || b.num_celular))
    return fail(s, 400, 'Completá los campos obligatorios.');
  const id = await crearPersona(b, 'paciente', crypto.randomBytes(24).toString('hex'));
  id ? s.json({ id, usuarioId: null }) : fail(s, 409, 'El paciente ya está registrado.');
}));

app.patch('/api/pacientes/:id', auth('paciente', 'recepcion'), wrap(async (q, s) => {
  const id = Number(q.params.id);
  if (q.u.rol === 'paciente' && q.u.id !== id) return fail(s, 403, 'Solo podés modificar tu propio perfil.');
  const b = q.body || {};
  const campos = {
    nombre: b.nombre,
    apellido: b.apellido,
    dni: b.dni,
    email: typeof b.email === 'string' ? b.email.trim().toLowerCase() : undefined,
    fecha_nacimiento: b.fecha_nacimiento ?? b.fechaNacimiento,
    num_celular: b.telefono ?? b.num_celular,
  };
  const entries = Object.entries(campos).filter(([, v]) => v !== undefined);
  if (!entries.length) return s.json({ ok: true });
  try {
    const [r] = await db.query(`UPDATE persona SET ${entries.map(([k]) => `\`${k}\`=?`).join(',')} WHERE id_persona=?`, [...entries.map(([, v]) => v), id]);
    if (!r.affectedRows) return fail(s, 404, 'Paciente inexistente.');
    s.json({ ok: true });
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') return fail(s, 409, 'El email o DNI ya pertenece a otra persona.'); throw e; }
}));

// ---- Sede / Google Maps ----
app.get('/api/sede', (q, s) => {
  const lat = parseFloat(process.env.SEDE_LAT), lng = parseFloat(process.env.SEDE_LNG);
  s.json({ nombre: process.env.SEDE_NOMBRE || 'ClinicaMed', direccion: process.env.SEDE_DIRECCION || '',
    lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null,
    mapsKey: process.env.GOOGLE_MAPS_API_KEY || '', mapId: process.env.SEDE_MAP_ID || 'DEMO_MAP_ID' });
});

// ---- Notificaciones ----
const cron = require('node-cron');
const { crearNotificador, canalesPorDefecto, CANALES_VALIDOS } = require('./services/notificaciones');
const { crearRepoMysql } = require('./services/notificacionesRepo');
const lista = (v, d) => (v || d).split(',').map(x => x.trim()).filter(Boolean);
const notificador = crearNotificador({ repo: crearRepoMysql(db), canales: canalesPorDefecto(process.env),
  config: { canalPredeterminado: CANALES_VALIDOS.includes(process.env.NOTIF_CANAL_PREDETERMINADO) ? process.env.NOTIF_CANAL_PREDETERMINADO : 'auto',
    canalesAuto: lista(process.env.NOTIF_CANALES_AUTO, 'email,sms'),
    sede: { nombre: process.env.SEDE_NOMBRE || 'ClínicaMed', direccion: process.env.SEDE_DIRECCION || '' } } });
const conTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
const avisar = (id, tipo, o = {}) => notificador.notificar({ idTurno: id, tipo, ...o })
  .catch(e => { console.error('[notificaciones]', e.code || '', e.message); return []; });

app.get('/api/turnos/:id/notificaciones', auth('recepcion'), wrap(async (q, s) =>
  s.json({ notificaciones: await notificador.historial(+q.params.id) })));
app.post('/api/turnos/:id/notificar', auth('recepcion'), wrap(async (q, s) => {
  const canal = CANALES_VALIDOS.includes(q.body.canal) ? q.body.canal : 'auto';
  const [r] = await db.query('SELECT LOWER(estado) estado FROM turno WHERE id_turno=?', [q.params.id]);
  if (!r[0]) return fail(s, 404, 'Turno inexistente.');
  const tipo = r[0].estado === 'cancelado' ? 'cancelacion' : r[0].estado === 'confirmado' ? 'confirmado' : 'confirmacion';
  s.json({ avisos: await avisar(+q.params.id, tipo, { canal, forzar: true }) });
}));
app.post('/api/recordatorios/ejecutar', auth('recepcion'), wrap(async (q, s) =>
  s.json({ enviados: await notificador.recordatorios(), reintentos: await notificador.reintentar() })));

if (notificador.hayCanales() && process.env.NOTIF_RECORDATORIOS !== '0') {
  let enCurso = false;
  cron.schedule('*/15 * * * *', async () => {
    if (enCurso) return;
    enCurso = true;
    try { await notificador.recordatorios(); await notificador.reintentar(); }
    catch (e) { console.error('[notificaciones] tarea programada:', e.code || '', e.message); }
    finally { enCurso = false; }
  }, { timezone: 'America/Argentina/Buenos_Aires' });
}
const disponibles = notificador.disponibles();
console.log('[notificaciones] correo:', disponibles.email ? 'activo' : 'sin configurar', '| SMS:', disponibles.sms ? 'activo' : 'sin configurar', '| WhatsApp: no disponible todavía');

app.listen(process.env.PORT || 3000, () => console.log('ClinicaMed en http://localhost:' + (process.env.PORT || 3000)));
