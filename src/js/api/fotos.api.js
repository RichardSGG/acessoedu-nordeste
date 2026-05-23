/**
 * src/js/api/fotos.api.js
 * Responsabilidade: Gestão de upload e consulta de fotos comunitárias (Back4App)
 */

/**
 * Retorna as fotos comunitárias com estado aprovado para uma dada escola
 * @param {string} idEscola - Pointer da escola
 * @returns {Promise<Array>} Lista de objetos SchoolPhoto
 */
export async function listarAprovadas(idEscola) {
    try {
        // TODO: Implementar Parse.Query('SchoolPhoto').equalTo('status', 'approved')
        console.log('Stub: Listar fotos aprovadas da escola', idEscola);
        return [];
    } catch (erro) {
        console.error('Erro ao listar fotos:', erro);
        return [];
    }
}

/**
 * Submete uma nova foto para moderação
 * @param {string} idEscola - Pointer da escola alvo
 * @param {File} arquivoImagem - Ficheiro processado pelo Pica.js
 */
export async function enviarFoto(idEscola, arquivoImagem) {
    try {
        // TODO: Implementar upload Parse.File e salvar na classe SchoolPhoto
        console.log('Stub: Foto enviada para aprovação', idEscola, arquivoImagem);
    } catch (erro) {
        console.error('Erro ao submeter foto:', erro);
        throw erro;
    }
}
