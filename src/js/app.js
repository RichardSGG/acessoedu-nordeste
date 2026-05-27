/**
 * src/js/app.js
 * Responsabilidade: Inicializar a aplicação, configurar o banco de dados e dar o "start".
 */

import estado from './core/estado.js';
import * as EscolasAPI from './api/escolas.api.js';

// Consumindo estritamente via variáveis configuradas no escopo global do ambiente
const APP_ID = window.ENV?.BACK4APP_APP_ID; 
const JS_KEY = window.ENV?.BACK4APP_JS_KEY;

if (!APP_ID || !JS_KEY) {
    console.error("[ERRO] Chaves do Back4App nao encontradas no escopo de variaveis globais.");
} else {
    Parse.initialize(APP_ID, JS_KEY);
    Parse.serverURL = 'https://parseapi.back4app.com/parse/';
}

async function iniciarApp() {
    console.log("[INFO] Iniciando AcessoEdu Nordeste...");

    estado.assinar('escolas', (listaDeEscolas) => {
        console.log(`[OK] O App recebeu ${listaDeEscolas.length} escolas do Back4App!`);
    });

    await EscolasAPI.listar();
}

document.addEventListener('DOMContentLoaded', iniciarApp);