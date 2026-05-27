/**
 * src/js/api/mapillary.api.js
 * Responsabilidade: Fallback de imagens de fachada via Mapillary API
 */

const MAPILLARY_TOKEN = 'MLY|dXNlckB0ZXN0LmNvbXx0ZXN0X3Rva2Vu'; /* Token placeholder — substituir pelo token real */
const MAPILLARY_BASE = 'https://graph.mapillary.com/images';

/**
 * Busca imagens de rua proximas a coordenada
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} raio - Raio da bounding box em graus (default ~110m)
 * @returns {Promise<Array>}
 */
export async function buscarPorCoordenadas(latitude, longitude, raio = 0.001) {
  if (latitude == null || longitude == null ||
      latitude === 0 || longitude === 0) {
    return [];
  }

  const d = raio;
  const bbox = `${longitude - d},${latitude - d},${longitude + d},${latitude + d}`;

  try {
    const url = `${MAPILLARY_BASE}?fields=id,thumb_1024_url&bbox=${bbox}&limit=5`;
    const resposta = await fetch(url, {
      headers: { 'Authorization': `Bearer ${MAPILLARY_TOKEN}` }
    });

    if (!resposta.ok) {
      if (resposta.status === 401) {
        console.warn('[mapillary.api] Token invalido ou expirado. Configure MAPILLARY_TOKEN.');
      }
      return [];
    }

    const dados = await resposta.json();

    if (!dados.data || dados.data.length === 0) return [];

    return dados.data.map(img => ({
      id: img.id,
      url: img.thumb_1024_url || `https://images.mapillary.com/${img.id}/thumb-1024.jpg`,
      fonte: 'Mapillary',
    }));
  } catch (erro) {
    console.error('[mapillary.api] Erro:', erro);
    return [];
  }
}
