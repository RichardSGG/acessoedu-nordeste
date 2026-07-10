/**
 * src/js/api/mapillary.api.js
 * Responsabilidade: Busca de imagens de rua via Mapillary API por coordenadas
 *
 * Obter token gratuito:
 *   1. Acessar https://www.mapillary.com/dashboard/developers
 *   2. Criar um aplicativo gratuito
 *   3. Copiar o Client Token e colar na constante MAPILLARY_TOKEN abaixo
 */

const MAPILLARY_TOKEN = 'MLY|dXNlckB0ZXN0LmNvbXx0ZXN0X3Rva2Vu';

/**
 * Busca fotos de rua proximas a uma coordenada geografica.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} [limite=3] - Numero maximo de fotos
 * @returns {Promise<{ok: boolean, fotos?: Array, mensagem?: string}>}
 */
export async function buscarFotosDaEscola(lat, lng, limite = 3) {
  if (lat == null || lng == null || lat === 0 || lng === 0) {
    return { ok: false, mensagem: 'Coordenadas invalidas.' };
  }

  const campos = 'id,thumb_512_url,thumb_1024_url,captured_at,is_pano';
  const url = `https://graph.mapillary.com/images`
    + `?access_token=${MAPILLARY_TOKEN}`
    + `&fields=${campos}`
    + `&lat=${lat}&lng=${lng}`
    + `&radius=50&limit=${limite}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ${response.status}`);
    const json = await response.json();
    if (!json.data || json.data.length === 0) {
      return { ok: false, mensagem: 'Nenhuma foto disponivel para esta localizacao.' };
    }
    return { ok: true, fotos: json.data };
  } catch (err) {
    return { ok: false, mensagem: err.message };
  }
}

/**
 * Adaptador para compatibilidade com codigo legado.
 * Retorna array de fotos no formato {id, url, fonte}.
 * @deprecated Use buscarFotosDaEscola diretamente.
 */
export async function buscarPorCoordenadas(latitude, longitude) {
  const resultado = await buscarFotosDaEscola(latitude, longitude, 5);
  if (!resultado.ok) return [];
  return resultado.fotos.map(img => ({
    id: img.id,
    url: img.thumb_1024_url || img.thumb_512_url || '',
    fonte: 'Mapillary',
    captured_at: img.captured_at,
    is_pano: img.is_pano,
  }));
}
