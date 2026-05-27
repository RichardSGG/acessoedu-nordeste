/**
 * src/js/ui/mapa.ui.js
 * Responsabilidade: Controlar o ciclo de vida e eventos do Leaflet.js e Parse.js
 */

import estado from '../core/estado.js';
import { EVENTOS } from '../core/constantes.js';
import { mostrarAlerta } from './modal.ui.js';
import { buscarPorBoundingBox } from '../api/escolas.api.js';

let instanciaMapa = null;
let markersCluster = null;
let timerMoveend = null;

export function obterInstanciaMapa() {
  return instanciaMapa;
}

// Inicializa Back4App no navegador
Parse.initialize('pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj', 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN');
Parse.serverURL = 'https://parseapi.back4app.com/parse/';

export function inicializarMapa() {
    console.log('Inicializando Leaflet e OpenStreetMap...');

    instanciaMapa = L.map('map').setView([-8.0, -38.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(instanciaMapa);

    markersCluster = L.markerClusterGroup();
    instanciaMapa.addLayer(markersCluster);

    // Eventos do Painel Lateral
    const fecharBtn = document.getElementById('fechar-painel');
    const enviarBtn = document.getElementById('btn-enviar-auditoria');

    if (fecharBtn) fecharBtn.addEventListener('click', fecharPainel);
    if (enviarBtn) enviarBtn.addEventListener('click', enviarAuditoria);

    // Carrega escolas apenas na area visivel
    carregarEscolasVisiveis();

    // Recarrega ao arrastar ou dar zoom (debounce 300ms)
    instanciaMapa.on('moveend', () => {
      clearTimeout(timerMoveend);
      timerMoveend = setTimeout(carregarEscolasVisiveis, 300);
    });
    instanciaMapa.on('zoomend', () => {
      clearTimeout(timerMoveend);
      timerMoveend = setTimeout(carregarEscolasVisiveis, 300);
    });
}

async function carregarEscolasVisiveis() {
    const bounds = instanciaMapa.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    console.log(`[Mapa] Carregando escolas na area visivel: SW(${sw.lat.toFixed(4)}, ${sw.lng.toFixed(4)}) NE(${ne.lat.toFixed(4)}, ${ne.lng.toFixed(4)})`);

    try {
        const escolas = await buscarPorBoundingBox(
            { lat: sw.lat, lng: sw.lng },
            { lat: ne.lat, lng: ne.lng }
        );
        renderizarMarcadores(escolas);
    } catch (error) {
        console.error('[Mapa] Erro ao carregar escolas visiveis:', error.message);
    }
}

export function renderizarMarcadores(escolas) {
    console.log(`Montando clusters para ${escolas.length} escolas.`);
    markersCluster.clearLayers();

    escolas.forEach(escola => {
        /* Compatibilidade com Parse.Object e objetos planos */
        const obter = (chave) => typeof escola.get === 'function' ? escola.get(chave) : escola[chave];

        /* Extrai coordenadas: Parse.Object tem posicao_geografica, objeto plano tem lat/lng ou latitude/longitude */
        let lat, lng;
        if (typeof escola.get === 'function') {
          const pos = escola.get('posicao_geografica');
          lat = pos ? pos.latitude : null;
          lng = pos ? pos.longitude : null;
        } else {
          lat = escola.lat ?? escola.latitude ?? null;
          lng = escola.lng ?? escola.longitude ?? null;
        }

        if (lat && lng && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            const marker = L.marker([lat, lng]);

            const nome = obter('nome') || 'Sem nome';
            const municipio = obter('cidade') || '';
            const uf = obter('uf') || '';

            /* Calcula indice de infraestrutura (0-10) — schema real do DB */
            const indicadores = [
                obter('internet'),
                obter('laboratorio'),
                obter('quadra'),
                obter('rampa_acessibilidade'),
                obter('banheiro_pne'),
                obter('agua_potavel'),
                obter('energia_eletrica'),
            ];
            const soma = indicadores.reduce((acc, v) => acc + (v === 1 ? 1 : 0), 0);
            const nota = ((soma / indicadores.length) * 10).toFixed(1);

            marker.bindTooltip(`
                <strong>${escHtml(nome)}</strong><br>
                ${escHtml(municipio)} &mdash; ${escHtml(uf)}<br>
                Indice: ${nota}
            `, { direction: 'top', offset: [0, -10] });

            marker.on('click', () => {
                const idEscola = obter('id_escola');
                window.location.href = `detalhes.html?id=${idEscola}`;
            });

            markersCluster.addLayer(marker);
        }
    });
}

function escHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(texto));
    return div.innerHTML;
}

function abrirPainel(escola) {
    const painel = document.getElementById('painel-zeladoria');
    
    document.getElementById('painel-escola-nome').textContent = escola.get('nome') || 'Desconhecido';
    document.getElementById('painel-escola-cidade').textContent = `${escola.get('cidade')} - ${escola.get('uf')}`;
    document.getElementById('form-escola-id').value = escola.get('id_escola');
    
    // Reseta form
    document.getElementById('form-nota').value = '';
    document.getElementById('form-comentario').value = '';

    // Anima a entrada da barra lateral
    painel.classList.remove('translate-x-full');
}

function fecharPainel() {
    const painel = document.getElementById('painel-zeladoria');
    painel.classList.add('translate-x-full');
}

async function enviarAuditoria() {
    const idEscola = document.getElementById('form-escola-id').value;
    const nota = parseInt(document.getElementById('form-nota').value);
    const categoria = document.getElementById('form-categoria').value;
    const comentario = document.getElementById('form-comentario').value;

    if (!nota || nota < 1 || nota > 5) {
        await mostrarAlerta('Forneça uma nota entre 1 e 5.', 'Validação');
        return;
    }
    if (!comentario.trim()) {
        await mostrarAlerta('Descreva a situação atual da escola.', 'Validação');
        return;
    }

    const btn = document.getElementById('btn-enviar-auditoria');
    btn.textContent = "Enviando para Nuvem...";
    btn.disabled = true;

    try {
        const AvaliacoesClass = Parse.Object.extend("Avaliacoes");
        const obj = new AvaliacoesClass();
        
        obj.set("id_escola", idEscola);
        obj.set("nome", "Cidadao Voluntario");
        obj.set("categoria_problema", categoria);
        obj.set("mensagem", comentario);
        obj.set("nota", nota);
        obj.set("status_resolucao", "Aberto");
        obj.set("data_auditoria", new Date());
        obj.set("possui_evidencia", false);
        obj.set("respostas", []);
        obj.set("verificado_local", false);
        obj.set("flags_count", 0);

        await obj.save();
        await mostrarAlerta('Denúncia / Auditoria salva com sucesso!', 'Sucesso');
        fecharPainel();
    } catch (error) {
        console.error("Erro no Back4App:", error);
        await mostrarAlerta('Falha na rede. Tente de novo.', 'Erro');
    } finally {
        btn.textContent = "Enviar Auditoria";
        btn.disabled = false;
    }
}
