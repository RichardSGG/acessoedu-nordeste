/**
 * src/js/ui/mapa.ui.js
 * Responsabilidade: Controlar o ciclo de vida e eventos do Leaflet.js
 */

import estado from '../core/estado.js';
import { EVENTOS } from '../core/constantes.js';

let instanciaMapa = null;

/**
 * Função responsável por importar o Leaflet e renderizar o mapa na página
 */
export function inicializarMapa() {
    console.log('Stub: Inicializando Leaflet e OpenStreetMap');
    
    // Substituir pela inicialização real do L.map()
    const container = document.getElementById('container-mapa');
    if (container) {
        container.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 font-medium">Mapa Carregado (Stub)</div>';
    }

    // Assinar evento para reagir quando os dados chegarem
    estado.assinar(EVENTOS.ESCOLAS_CARREGADAS, renderizarMarcadores);
}

/**
 * Renderiza os pinos das escolas no mapa, construindo popups via DOM Fragments se aplicável
 * @param {Array} escolas - Lista de escolas recuperadas do estado
 */
export function renderizarMarcadores(escolas) {
    console.log('Stub: Renderizando marcadores para', escolas.length, 'escolas');
    // TODO: Usar cluster ou markers do Leaflet, sem bloquear a thread
}
