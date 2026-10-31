export const $ = (selector, raiz = document) => raiz.querySelector(selector);

// Crea nodos con textContent (nunca innerHTML) para evitar inyección de código.
export function el(etiqueta, clase = '', texto = '') {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  nodo.textContent = texto;
  return nodo;
}

export function mostrarAviso(nodo, texto, tipo = 'error') {
  nodo.textContent = texto;
  nodo.className = `aviso aviso--${tipo}`;
  nodo.hidden = !texto;
}

export const hoyISO = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local

export const formatearFecha = (iso) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00`));
