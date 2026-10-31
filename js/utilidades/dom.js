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

export function confirmar(texto) {
  return new Promise((resolver) => {
    const dialogo = el('dialog', 'modal');
    const si = el('button', 'boton boton--primario', 'Sí, continuar');
    const no = el('button', 'boton boton--secundario', 'Volver');
    [si, no].forEach((b) => { b.type = 'button'; });
    const cerrar = (valor) => { dialogo.close(); dialogo.remove(); resolver(valor); };
    si.addEventListener('click', () => cerrar(true));
    no.addEventListener('click', () => cerrar(false));
    dialogo.addEventListener('cancel', () => cerrar(false));
    const acciones = el('div', 'modal__acciones');
    acciones.append(si, no);
    dialogo.append(el('p', '', texto), acciones);
    document.body.append(dialogo);
    dialogo.showModal();
  });
}

export const hoyISO = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local

export const formatearFecha = (iso) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${iso}T00:00`));
