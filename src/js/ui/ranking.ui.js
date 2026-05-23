/**
 * src/js/ui/ranking.ui.js
 * Responsabilidade: Renderização da lista de excelência usando DocumentFragment
 */

import estado from '../core/estado.js';

/**
 * Renderiza o pódio e a lista contínua utilizando as melhores práticas de DOM
 * @param {Array} escolas - Array ordenado por notaExcelencia
 */
export function renderizarRanking(escolas) {
    const listaElemento = document.getElementById('lista-ranking');
    if (!listaElemento) return;

    // TODO: Separar o Top 3 para o Pódio
    
    // Implementação obrigatória da Regra de Performance: DocumentFragment
    const fragmento = document.createDocumentFragment();

    escolas.forEach((escola, indice) => {
        // Ignorar o top 3 na lista, caso eles já estejam no pódio
        if (indice < 3) return;

        const itemLista = document.createElement('div');
        itemLista.className = 'flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm';
        itemLista.textContent = `${indice + 1}º - ${escola.nomeEscola} (Stub)`;
        
        fragmento.appendChild(itemLista);
    });

    // Apenas uma injeção no DOM
    listaElemento.innerHTML = '';
    listaElemento.appendChild(fragmento);
    
    console.log('Stub: Ranking atualizado com sucesso');
}
