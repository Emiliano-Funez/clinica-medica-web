import { iniciarCabecera } from '../componentes/header.js';

const $ = (selector) => document.querySelector(selector);
const nombreEl = $('#sede-nombre');
const direccionEl = $('#sede-direccion');
const estadoEl = $('#sede-estado');
const enlaceEl = $('#enlace-maps');
const mapaErrorEl = $('#mapa-error');
const mapaEl = $('#mapa');

function urlApiSede() {
  const configurada = document.querySelector('meta[name="clinicamed-api-url"]')?.content.trim();
  if (configurada) return `${configurada.replace(/\/$/, '')}/sede`;

  const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const base = esLocal ? 'http://localhost:3000/api' : `${location.origin}/api`;
  return `${base}/sede`;
}

function cargarGoogleMaps(key) {
  if (window.google?.maps?.Map) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', key);
    url.searchParams.set('loading', 'async');
    url.searchParams.set('callback', 'clinicaMedMapsLoaded');
    window.clinicaMedMapsLoaded = resolve;
    script.src = url.href;
    script.async = true;
    script.onerror = () => {
      delete window.clinicaMedMapsLoaded;
      reject(new Error('No se pudo cargar Google Maps. Revisá la API key y que Maps JavaScript API esté habilitada.'));
    };
    document.head.append(script);
  });
}

function mostrarError(mensaje) {
  mapaErrorEl.textContent = mensaje;
  mapaErrorEl.hidden = false;
  estadoEl.textContent = 'No se pudo cargar el mapa.';
}

async function iniciarMapa(sede) {
  if (!sede.mapsKey) throw new Error('Falta GOOGLE_MAPS_API_KEY en el .env del backend.');
  if (!Number.isFinite(sede.lat) || !Number.isFinite(sede.lng)) {
    throw new Error('Configurá SEDE_LAT y SEDE_LNG con las coordenadas de la clínica.');
  }

  await cargarGoogleMaps(sede.mapsKey);
  if (!window.google?.maps?.Map) throw new Error('Google Maps no terminó de inicializar. Revisá la API key y la configuración del proyecto de Google Cloud.');
  const posicion = { lat: sede.lat, lng: sede.lng };
  const mapa = new google.maps.Map(mapaEl, {
    center: posicion,
    zoom: 16,
    mapId: sede.mapId || 'DEMO_MAP_ID',
    mapTypeControl: false,
    streetViewControl: true,
    fullscreenControl: true,
    zoomControl: true,
  });

  new google.maps.Marker({ map: mapa, position: posicion, title: sede.nombre });
  estadoEl.textContent = 'Ubicación cargada';
}

async function iniciar() {
  await iniciarCabecera();
  try {
    const respuesta = await fetch(urlApiSede(), { headers: { Accept: 'application/json' } });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status} al consultar la sede.`);
    const sede = await respuesta.json();

    nombreEl.textContent = sede.nombre || 'ClinicaMed';
    direccionEl.textContent = sede.direccion || 'La dirección todavía no está configurada.';

    const destino = Number.isFinite(sede.lat) && Number.isFinite(sede.lng)
      ? `${sede.lat},${sede.lng}`
      : sede.direccion;
    if (destino) {
      enlaceEl.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
      enlaceEl.hidden = false;
    }

    await iniciarMapa(sede);
  } catch (error) {
    mostrarError(error.message || 'No se pudo conectar con la sede.');
    if (direccionEl.textContent === 'Cargando dirección…') direccionEl.textContent = 'No se pudo cargar la dirección.';
  }
}

iniciar();
