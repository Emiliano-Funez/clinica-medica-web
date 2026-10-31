// SOLO DEMO: en producción el hash de contraseñas se hace en el servidor (bcrypt/argon2).
export async function hashClave(texto) {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
