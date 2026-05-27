/**
 * seeder/seed.mjs
 * Responsabilidade: Criar registos nas classes 'Escolas2024' e 'Escolas2025'
 * no Back4App a partir dos JSONs gerados pelo extrator_censo_simples.py.
 *
 * ATENCAO: Este script faz CREATE (insercao nova). Destroi os registos
 * existentes antes de recriar (FULL IMPORT).
 *
 * Uso:
 *   node seeder/seed.mjs
 *
 * Requer .env na raiz com APP_ID, JAVASCRIPT_KEY e MASTER_KEY.
 */

import { config } from 'dotenv';
import Parse from 'parse/node';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Configuracao de ambiente
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..');

config({ path: join(RAIZ, '.env') });

const APP_ID = process.env.APP_ID;
const JS_KEY = process.env.JAVASCRIPT_KEY;
const MASTER_KEY = process.env.MASTER_KEY;

if (!APP_ID || !JS_KEY || !MASTER_KEY) {
    console.error('[ERRO] Variaveis APP_ID, JAVASCRIPT_KEY ou MASTER_KEY ausentes no .env');
    process.exit(1);
}

Parse.initialize(APP_ID, JS_KEY, MASTER_KEY);
Parse.serverURL = 'https://parseapi.back4app.com';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const TAMANHO_LOTE = 100;

const CONFIG = {
    'escolas_2024.json': 'Escolas2024',
    'escolas_2025.json': 'Escolas2025',
};

// ---------------------------------------------------------------------------
// Funcoes auxiliares
// ---------------------------------------------------------------------------

function carregarJson(caminho) {
    const raw = readFileSync(caminho, 'utf-8');
    const dados = JSON.parse(raw);
    if (typeof dados !== 'object' || Array.isArray(dados)) {
        throw new Error('JSON raiz nao e um objeto. Esperado dicionario chaveado por id_escola.');
    }
    return Object.entries(dados);
}

function chunkArray(arr, tamanho) {
    const lotes = [];
    for (let i = 0; i < arr.length; i += tamanho) {
        lotes.push(arr.slice(i, i + tamanho));
    }
    return lotes;
}

// ---------------------------------------------------------------------------
// Limpar classe existente
// ---------------------------------------------------------------------------

async function limparClasse(nomeClasse) {
    console.log(`[SEED]   Limpando classe '${nomeClasse}'...`);
    const query = new Parse.Query(nomeClasse);
    query.limit(1000);

    let totalRemovidos = 0;

    while (true) {
        let objetos;
        try {
            objetos = await query.find({ useMasterKey: true });
        } catch (erro) {
            console.error(`[ERRO] Falha ao listar '${nomeClasse}': ${erro.message}`);
            break;
        }

        if (objetos.length === 0) break;

        try {
            await Parse.Object.destroyAll(objetos, { useMasterKey: true });
            totalRemovidos += objetos.length;
            console.log(`[SEED]     ${totalRemovidos} removidos...`);
        } catch (erro) {
            console.error(`[ERRO] Falha ao destruir lote: ${erro.message}`);
            // Fallback: destruir um a um
            for (const obj of objetos) {
                try {
                    await obj.destroy({ useMasterKey: true });
                    totalRemovidos++;
                } catch (e2) {
                    console.error(`[ERRO]       obj ${obj.id}: ${e2.message}`);
                }
            }
        }
    }

    console.log(`[SEED]   Total removidos da classe '${nomeClasse}': ${totalRemovidos}`);
    return totalRemovidos;
}

// ---------------------------------------------------------------------------
// Criar lote de escolas
// ---------------------------------------------------------------------------

async function criarLote(lote, nomeClasse, indiceLote, totalLotes) {
    const objetos = [];

    for (const [idEscola, dados] of lote) {
        const obj = new Parse.Object(nomeClasse);

        obj.set('id_escola', String(idEscola));
        obj.set('nome', dados.nome || '');
        obj.set('cidade', dados.cidade || '');
        obj.set('uf', dados.uf || '');

        // Indicadores binarios de infraestrutura
        obj.set('internet', dados.internet ?? 0);
        obj.set('biblioteca', dados.biblioteca ?? 0);
        obj.set('lab_informatica', dados.lab_informatica ?? 0);
        obj.set('quadra_esportes', dados.quadra_esportes ?? 0);
        obj.set('rampas', dados.rampas ?? 0);
        obj.set('banheiro_acessivel', dados.banheiro_acessivel ?? 0);
        obj.set('psicologos', dados.psicologos ?? 0);
        obj.set('agua_potavel', dados.agua_potavel ?? 0);
        obj.set('dependencia', dados.dependencia || 'Nao informada');

        // Niveis de ensino como Object
        if (dados.niveis_ensino && typeof dados.niveis_ensino === 'object') {
            obj.set('niveis_ensino', dados.niveis_ensino);
        }

        // Endereco e contatos
        if (dados.endereco) {
            obj.set('endereco', dados.endereco);
        }
        if (dados.telefone) {
            obj.set('telefone', dados.telefone);
        }
        if (dados.email) {
            obj.set('email', dados.email);
        }

        // Delta de infraestrutura (pre-calculado no ETL)
        if (dados.delta_infraestrutura !== undefined && dados.delta_infraestrutura !== null) {
            obj.set('delta_infraestrutura', dados.delta_infraestrutura);
        }

        // posicao_geografica como GeoPoint nativo do Parse
        if (dados.posicao_geografica) {
            const { latitude, longitude } = dados.posicao_geografica;
            const lat = Number(latitude);
            const lng = Number(longitude);
            if (
                !isNaN(lat) && !isNaN(lng) &&
                (lat !== 0 || lng !== 0) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180
            ) {
                obj.set('posicao_geografica', new Parse.GeoPoint(lat, lng));
            }
        }

        objetos.push(obj);
    }

    let falhasSalvar = 0;
    try {
        await Parse.Object.saveAll(objetos, { useMasterKey: true });
    } catch (erro) {
        console.error(
            `[ERRO] Falha ao salvar lote ${indiceLote + 1}: ${erro.message}`
        );
        // Fallback: salvar individualmente
        for (const obj of objetos) {
            try {
                await obj.save(null, { useMasterKey: true });
            } catch (errInd) {
                falhasSalvar++;
                console.error(
                    `[ERRO]   id=${obj.get('id_escola')}: ${errInd.message}`
                );
            }
        }
    }

    const criadas = objetos.length - falhasSalvar;

    console.log(
        `[OK] Lote ${indiceLote + 1}/${totalLotes} - ` +
        `${criadas} criadas` +
        (falhasSalvar > 0 ? `, ${falhasSalvar} falhas` : '')
    );

    return { criadas, falhas: falhasSalvar };
}

// ---------------------------------------------------------------------------
// Processar um arquivo JSON → classe
// ---------------------------------------------------------------------------

async function processarArquivo(arquivoJson, nomeClasse) {
    const caminho = join(RAIZ, arquivoJson);

    console.log(`[SEED] === Classe '${nomeClasse}' ===`);
    console.log(`[SEED] JSON : ${caminho}`);

    let entradas;
    try {
        entradas = carregarJson(caminho);
    } catch (erro) {
        console.error(`[ERRO] Falha ao ler JSON: ${erro.message}`);
        return;
    }

    console.log(`[SEED] Total de escolas no JSON: ${entradas.length.toLocaleString()}`);

    // Limpar classe
    await limparClasse(nomeClasse);

    // Dividir em lotes
    const lotes = chunkArray(entradas, TAMANHO_LOTE);
    console.log(`[SEED] Inserindo ${lotes.length} lotes de ate ${TAMANHO_LOTE}...`);
    console.log('');

    let totalCriadas = 0;
    let totalFalhas = 0;

    for (let i = 0; i < lotes.length; i++) {
        const { criadas, falhas } = await criarLote(lotes[i], nomeClasse, i, lotes.length);
        totalCriadas += criadas;
        totalFalhas += falhas;
    }

    console.log('');
    console.log(`[SEED]   Criadas : ${totalCriadas.toLocaleString()}`);
    console.log(`[SEED]   Falhas  : ${totalFalhas.toLocaleString()}`);
    console.log('');
    return { criadas: totalCriadas, falhas: totalFalhas };
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------

async function executarSeed() {
    console.log('='.repeat(60));
    console.log('[SEED] FULL IMPORT — Escolas2024 + Escolas2025');
    console.log(`[SEED] App ID : ${APP_ID}`);
    console.log('='.repeat(60));
    console.log('');

    for (const [arquivo, classe] of Object.entries(CONFIG)) {
        await processarArquivo(arquivo, classe);
        console.log('-'.repeat(60));
        console.log('');
    }

    console.log('[SEED] Importacao concluida.');
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

executarSeed().catch((erro) => {
    console.error('[FATAL] Erro nao tratado durante o seed:', erro);
    process.exit(1);
});
