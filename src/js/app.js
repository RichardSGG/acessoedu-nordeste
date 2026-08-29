/**
 * src/js/app.js
 * Responsabilidade: Inicializar a aplicação, configurar o banco de dados e dar o "start".
 */

import estado from './core/estado.js';
import * as EscolasAPI from './api/escolas.api.js';
import { PARSE_CONFIG } from './core/constantes.js';

Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
Parse.serverURL = PARSE_CONFIG.SERVER_URL;

async function iniciarApp() {
    console.log("[INFO] Iniciando AcessoEdu Nordeste...");

    estado.assinar('escolas', (listaDeEscolas) => {
        console.log(`[OK] O App recebeu ${listaDeEscolas.length} escolas do Back4App!`);
    });

    await EscolasAPI.listar();
}

document.addEventListener('DOMContentLoaded', iniciarApp);