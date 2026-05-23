/**
 * src/js/core/inicializador.js
 * Responsabilidade: Bootstrap da aplicação, inicializar listeners e lazy loading
 */

import estado from './estado.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('AcessoEdu Nordeste: Inicializando aplicação...');

    // Toggle Mapa / Lista
    const btnMapa = document.getElementById('toggle-mapa');
    const btnLista = document.getElementById('toggle-lista');
    const containerMapa = document.getElementById('container-mapa');
    const containerLista = document.getElementById('container-lista');

    if (btnMapa && btnLista && containerMapa && containerLista) {
        btnMapa.addEventListener('click', () => {
            btnMapa.classList.replace('bg-transparent', 'bg-white');
            btnMapa.classList.replace('text-slate-500', 'text-primaria');
            btnLista.classList.replace('bg-white', 'bg-transparent');
            btnLista.classList.replace('text-primaria', 'text-slate-500');
            containerMapa.classList.remove('hidden');
            containerLista.classList.add('hidden');
            containerLista.classList.remove('flex');
        });

        btnLista.addEventListener('click', () => {
            btnLista.classList.replace('bg-transparent', 'bg-white');
            btnLista.classList.replace('text-slate-500', 'text-primaria');
            btnMapa.classList.replace('bg-white', 'bg-transparent');
            btnMapa.classList.replace('text-primaria', 'text-slate-500');
            containerLista.classList.remove('hidden');
            containerLista.classList.add('flex');
            containerMapa.classList.add('hidden');
        });
    }

    // Lazy Loading do Mapa usando IntersectionObserver
    const mapaElement = document.getElementById('container-mapa');
    if (mapaElement) {
        const observadorMapa = new IntersectionObserver((entradas) => {
            if (entradas[0].isIntersecting) {
                console.log('Elemento mapa visível. Inicializando Leaflet...');
                import('../ui/mapa.ui.js').then(modulo => {
                    modulo.inicializarMapa();
                }).catch(erro => console.error('Erro ao carregar mapa:', erro));
                
                observadorMapa.disconnect();
            }
        }, { threshold: 0.1 });

        observadorMapa.observe(mapaElement);
    }
});
