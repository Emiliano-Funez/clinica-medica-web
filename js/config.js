// La app usa el backend local de Express; para producción, reemplazá el host por el dominio de la API.
export const CONFIG = { adaptador: 'api', apiUrl: 'http://localhost:3000/api' };
// URL absoluta de la raíz del proyecto: sirve igual desde index.html y desde pages/.
export const RAIZ = new URL('../', import.meta.url).href;
