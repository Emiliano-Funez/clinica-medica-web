// 'local' = datos ficticios en el navegador (solo demostración). 'api' = backend real.
export const CONFIG = { adaptador: 'local', apiUrl: '/api' };
// URL absoluta de la raíz del proyecto: sirve igual desde index.html y desde pages/.
export const RAIZ = new URL('../', import.meta.url).href;
