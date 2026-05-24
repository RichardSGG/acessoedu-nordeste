/**
 * src/js/ui/mapa.ui.js
 * Responsabilidade: Controlar o ciclo de vida e eventos do Leaflet.js e Parse.js
 */

import estado from '../core/estado.js';
import { EVENTOS } from '../core/constantes.js';

let instanciaMapa = null;
let markersCluster = null;

// Inicializa Back4App no navegador
Parse.initialize("8uIloIhmnqIK0y8P2vghyDGk20EX5wwnbBTxYAhk", "o4wIFtX6xdbhdYX8PRfD57oOzN8ZkoLrA18Jxb93");
Parse.serverURL = 'https://parseapi.back4app.com/';

export function inicializarMapa() {
    console.log('Inicializando Leaflet e OpenStreetMap...');
    
    // Configura o Leaflet na Div com id "map"
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

    // Carrega escolas direto da nuvem
    carregarMapaEscolas();
}

async function carregarMapaEscolas() {
    console.log("Baixando escolas da nuvem Back4App...");
    const EscolasClass = Parse.Object.extend("Escolas");
    const query = new Parse.Query(EscolasClass);
    
    // Apenas escolas que têm geolocalização preenchida no banco
    query.exists("latitude");
    query.exists("longitude");
    query.limit(2000); // Limite de 2000 para não travar o navegador
    
    try {
        const resultados = await query.find();
        renderizarMarcadores(resultados);
    } catch (error) {
        console.error("Erro ao baixar escolas:", error.message);
    }
}

export function renderizarMarcadores(escolas) {
    console.log(`Montando clusters para ${escolas.length} escolas.`);
    markersCluster.clearLayers();

    escolas.forEach(escola => {
        const lat = escola.get("latitude");
        const lng = escola.get("longitude");
        
        // Trava rigorosa: Ignora escolas que vieram com GPS nulo ou corrompido do banco
        if (lat && lng && lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            const marker = L.marker([lat, lng]);
            
            // Abre a barra lateral ao clicar no pino
            marker.on('click', () => abrirPainel(escola));
            
            markersCluster.addLayer(marker);
        }
    });
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
        alert("Forneça uma nota entre 1 e 5.");
        return;
    }
    if (!comentario.trim()) {
        alert("Descreva a situação atual da escola.");
        return;
    }

    const btn = document.getElementById('btn-enviar-auditoria');
    btn.textContent = "Enviando para Nuvem...";
    btn.disabled = true;

    try {
        const AvaliacoesClass = Parse.Object.extend("Avaliacoes");
        const obj = new AvaliacoesClass();
        
        obj.set("id_escola", idEscola);
        obj.set("autor_avaliacao", "Cidadão Voluntário");
        obj.set("categoria_problema", categoria);
        obj.set("comentario", comentario);
        obj.set("nota_atribuida", nota);
        obj.set("status_resolucao", "Aberto");
        obj.set("data_auditoria", new Date());
        obj.set("possui_evidencia", false);

        await obj.save();
        alert("Denúncia / Auditoria salva com sucesso!");
        fecharPainel();
    } catch (error) {
        console.error("Erro no Back4App:", error);
        alert("Falha na rede. Tente de novo.");
    } finally {
        btn.textContent = "Enviar Auditoria";
        btn.disabled = false;
    }
}
