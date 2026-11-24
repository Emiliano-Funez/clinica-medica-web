// Ejecuta todas las pruebas (funciona igual en Windows, Mac y Linux y en cualquier versión de Node 18+).
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const archivos = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).map(f => path.join(__dirname, f));
process.exit(spawnSync(process.execPath, ['--test', ...archivos], { stdio: 'inherit' }).status ?? 1);
