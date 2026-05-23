/**
 * src/js/api/mapillary.api.js
 * Responsabilidade: Consulta à API do Mapillary como fallback de imagens de fachada
 */

/**
 * Busca imagens de ruas e fachadas próximas a uma coordenada geográfica
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<Array>} Lista de imagens
 */
export async function buscarPorCoordenadas(latitude, longitude) {
    try {
        // TODO: Implementar fetch para graph.mapillary.com usando bounding box
        console.log('Stub: Buscar imagens Mapillary nas coordenadas', latitude, longitude);
        return [];
    } catch (erro) {
        console.error('Erro na integração Mapillary:', erro);
        return [];
    }
}
