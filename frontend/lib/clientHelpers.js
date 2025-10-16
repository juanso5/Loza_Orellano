// lib/clientHelpers.js
/**
 * Helpers para operaciones con clientes
 */
/**
 * Carga clientes desde la API
 * @returns {Promise<Array>} Lista de clientes
 */
export async function fetchClients() {
  const res = await fetch('/api/cliente', { cache: 'no-store' });
  if (!res.ok) throw new Error('Error cargando clientes');
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
/**
 * Carga fondos (carteras) de un cliente específico
 * @param {number} clientId - ID del cliente
 * @returns {Promise<Array>} Lista de fondos del cliente
 */
export async function fetchClientFunds(clientId) {
  const res = await fetch(`/api/fondo?cliente_id=${clientId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error cargando fondos del cliente ${clientId}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
/**
 * Carga movimientos de un cliente específico
 * @param {number} clientId - ID del cliente
 * @param {number} limit - Límite de movimientos (default 10000)
 * @returns {Promise<Array>} Lista de movimientos del cliente
 */
export async function fetchClientMovements(clientId, limit = 10000) {
  const res = await fetch(`/api/movimiento?cliente_id=${clientId}&limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Error cargando movimientos del cliente ${clientId}`);
  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}
/**
 * Carga un cliente con sus fondos y movimientos
 * @param {Object} client - Objeto cliente básico
 * @returns {Promise<Object>} Cliente enriquecido con portfolios y movements
 */
export async function fetchClientWithData(client) {
  const clientId = Number(client.id ?? client.id_cliente ?? 0);
  try {
    const [portfolios, movements] = await Promise.all([
      fetchClientFunds(clientId),
      fetchClientMovements(clientId)
    ]);
    return {
      id: clientId,
      name: client.name || client.nombre || '',
      portfolios,
      movements,
    };
  } catch (error) {
    return {
      id: clientId,
      name: client.name || client.nombre || '',
      portfolios: [],
      movements: [],
    };
  }
}
/**
 * Carga todos los clientes con sus datos completos
 * @returns {Promise<Array>} Lista de clientes con portfolios y movements
 */
export async function fetchAllClientsWithData() {
  const clients = await fetchClients();
  return Promise.all(clients.map(fetchClientWithData));
}
/**
 * Normaliza un objeto cliente para uso en UI
 * @param {Object} rawClient - Cliente crudo de la API
 * @returns {Object} Cliente normalizado
 */
export function normalizeClient(rawClient) {
  const banks = Array.isArray(rawClient.banks) 
    ? rawClient.banks 
    : (rawClient.bank 
        ? [{ name: rawClient.bank, alias: rawClient.alias || rawClient.bankAlias || "" }] 
        : []);
  return {
    ...rawClient,
    id: Number(rawClient.id ?? rawClient.id_cliente ?? 0),
    name: rawClient.name || rawClient.nombre || '',
    banks,
    comments: rawClient.comments || rawClient.comentario || "",
    joinedAt: rawClient.joinedAt || new Date().toISOString(),
  };
}
/**
 * Filtra clientes por query de búsqueda
 * @param {Array} clients - Lista de clientes
 * @param {string} query - Query de búsqueda
 * @returns {Array} Clientes filtrados
 */
export function filterClientsByQuery(clients, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return clients;
  return clients.filter(c => c.name.toLowerCase().includes(q));
}
