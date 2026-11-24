// Crea usuarios de demo (contraseña 1234) con hash real. Ejecutar una vez: npm run seed
require('dotenv').config();const mysql=require('mysql2/promise'),bcrypt=require('bcryptjs');
(async()=>{const db=await mysql.createConnection({host:process.env.DB_HOST||'localhost',port:+process.env.DB_PORT||3306,user:process.env.DB_USER||'root',password:process.env.DB_PASS||'',database:process.env.DB_NAME||'clinicamed'});
const h=await bcrypt.hash('1234',10);
const U=[['Martín','Gutiérrez','32456789','martin@email.com','paciente'],['Ana','Pereyra','28114302','ana@email.com','paciente'],
['Dra. Laura','Gómez','20111222','laura@clinicamed.com','especialista',1,'MP-1001'],['Dr. Martín','Pérez','20111223','perez@clinicamed.com','especialista',1,'MP-1002'],
['Dr. Diego','Salas','21333444','diego@clinicamed.com','especialista',3,'MP-1003'],['Dra. Carla','Ríos','22333555','carla@clinicamed.com','especialista',4,'MP-1004'],
['Dra. Sofía','Ibáñez','23333666','sofia@clinicamed.com','especialista',2,'MP-1005'],['Recepción','Clínica','30000000','recepcion@clinicamed.com','recepcion']];
for(const[n,a,d,e,rol,esp,mat]of U){const[x]=await db.query('SELECT 1 FROM persona WHERE email=?',[e]);if(x.length)continue;
 const[r]=await db.query('INSERT INTO persona(nombre,apellido,dni,email,contrasena) VALUES(?,?,?,?,?)',[n,a,d,e,h]);
 const[pr]=await db.query('INSERT INTO persona_rol(id_persona,id_rol) SELECT ?,id_rol FROM rol WHERE nombre=?',[r.insertId,rol]);
 if(esp)await db.query('INSERT INTO especialista VALUES(?,?,?)',[pr.insertId,esp,mat])}
console.log('Usuarios de demo listos (contraseña 1234).');process.exit()})();
