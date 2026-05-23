/**
 * src/js/api/escolas.api.js
 * Responsabilidade: Comunicação com o Back4App para gerir dados das escolas
 */

import estado from '../core/estado.js';
import { EVENTOS } from '../core/constantes.js';

/**
 * Busca escolas baseadas em filtros
 * @param {Object} filtros 
 */
export async function listar(filtros) {
    estado.definir('carregando', true);
    try {
        // TODO: Implementar Parse.Query('School')
        console.log('Stub: Buscar escolas com filtros', filtros);
        const resultadosSimulados = []; 
        estado.definir('escolas', resultadosSimulados);
    } catch (erro) {
        console.error('Erro ao listar escolas:', erro);
    } finally {
        estado.definir('carregando', false);
    }
}

/**
 * Busca uma escola específica pelo ID do Parse
 * @param {string} id 
 */
export async function buscarPorId(id) {
    try {
        // TODO: Implementar Parse.Query('School').get(id)
        console.log('Stub: Buscar escola por ID', id);
        return null;
    } catch (erro) {
        console.error('Erro ao buscar escola:', erro);
        throw erro;
    }
}

/**
 * Busca escolas que contenham o termo de pesquisa no nome
 * @param {string} termo 
 */
export async function buscarPorNome(termo) {
    try {
        // TODO: Implementar Parse.Query('School').matches('nomeEscola', termo)
        console.log('Stub: Buscar escola por nome', termo);
    } catch (erro) {
        console.error('Erro na pesquisa:', erro);
    }
}
