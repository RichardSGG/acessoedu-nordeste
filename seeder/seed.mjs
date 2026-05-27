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
Parse.serverURL = 'https://parseapi.back4app.com/';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const TAMANHO_LOTE = 150;
const DELAY_ENTRE_LOTES_MS = 300;
const MAX_TENTATIVAS = 3;

// ---------------------------------------------------------------------------
// Funcoes auxiliares
// ---------------------------------------------------------------------------

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

function extrairMensagemErro(erro) {
    if (!erro) return 'erro desconhecido';
    if (erro.message) return erro.message;
    if (typeof erro === 'string') return erro;
    try { return JSON.stringify(erro); } catch (_) { return String(erro); }
}

// ---------------------------------------------------------------------------
// Teste de conexao (pre-flight)
// ---------------------------------------------------------------------------

async function verificarConexao() {
    console.log('[SEED] Verificando conexao com Back4App...');
    try {
        const Teste = Parse.Object.extend('TesteConexao');
        const obj = new Teste();
        obj.set('ping', Date.now());
        await obj.save(null, { useMasterKey: true });
        await obj.destroy({ useMasterKey: true });
        console.log('[OK]  Conexao com Back4App estabelecida.');
        return true;
    } catch (erro) {
        console.error(`[FATAL] Sem conexao com Back4App: ${extrairMensagemErro(erro)}`);
        console.error('[FATAL] Verifique:');
        console.error('        1. Se a app Back4App esta ativa (nao hibernando)');
        console.error('        2. Se as credenciais no .env estao corretas');
        console.error('        3. Se a internet esta funcionando');
        return false;
    }
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
            console.error(`[ERRO] Falha ao listar '${nomeClasse}': ${extrairMensagemErro(erro)}`);
            break;
        }

        if (objetos.length === 0) break;

        try {
            await Parse.Object.destroyAll(objetos, { useMasterKey: true });
            totalRemovidos += objetos.length;
            console.log(`[SEED]     ${totalRemovidos} removidos...`);
            await sleep(200);
        } catch (erro) {
            console.error(`[ERRO] Falha ao destruir lote: ${extrairMensagemErro(erro)}`);
            for (const obj of objetos) {
                try {
                    await obj.destroy({ useMasterKey: true });
                    totalRemovidos++;
                } catch (e2) {
                    console.error(`[ERRO]       obj ${obj.id}: ${extrairMensagemErro(e2)}`);
                }
            }
        }
    }

    console.log(`[SEED]   Total removidos da classe '${nomeClasse}': ${totalRemovidos}`);
    return totalRemovidos;
}

// ---------------------------------------------------------------------------
// Criar lote de escolas (com retry)
// ---------------------------------------------------------------------------

async function criarLoteComRetry(lote, nomeClasse, indiceLote, totalLotes) {
    let ultimaFalha = null;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
        const resultado = await _tentarCriarLote(lote, nomeClasse);
        if (resultado.falhas === 0) {
            console.log(
                `[OK] Lote ${indiceLote + 1}/${totalLotes} - ` +
                `${resultado.criadas} criadas` +
                (tentativa > 1 ? ` (tentativa ${tentativa})` : '')
            );
            return resultado;
        }
        ultimaFalha = resultado.erro;

        if (tentativa < MAX_TENTATIVAS) {
            const espera = DELAY_ENTRE_LOTES_MS * tentativa * 2;
            console.log(
                `[RETRY] Lote ${indiceLote + 1}: ${resultado.falhas} falhas, ` +
                `tentativa ${tentativa + 1}/${MAX_TENTATIVAS} em ${espera}ms...`
            );
            await sleep(espera);
        }
    }

    console.error(
        `[ERRO] Lote ${indiceLote + 1}/${totalLotes} - ` +
        `FALHA APOS ${MAX_TENTATIVAS} TENTATIVAS: ${extrairMensagemErro(ultimaFalha)}`
    );
    return { criadas: 0, falhas: lote.length };
}

async function _tentarCriarLote(lote, nomeClasse) {
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

        // Endereco e contato
        if (dados.endereco) {
            obj.set('endereco', dados.endereco);
        }
        if (dados.telefone) {
            obj.set('telefone', dados.telefone);
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
    let ultimoErro = null;

    try {
        await Parse.Object.saveAll(objetos, { useMasterKey: true });
    } catch (erro) {
        ultimoErro = erro;
        // Fallback: salvar individualmente
        for (const obj of objetos) {
            try {
                await obj.save(null, { useMasterKey: true });
            } catch (errInd) {
                falhasSalvar++;
                ultimoErro = errInd;
                // So loga os 3 primeiros erros para nao poluir o console
                if (falhasSalvar <= 3) {
                    console.error(
                        `[ERRO]   id=${obj.get('id_escola')}: ${extrairMensagemErro(errInd)}`
                    );
                }
            }
        }
        if (falhasSalvar > 3) {
            console.error(`[ERRO]   ... e mais ${falhasSalvar - 3} falhas`);
        }
    }

    const criadas = objetos.length - falhasSalvar;
    return { criadas, falhas: falhasSalvar, erro: ultimoErro };
}

// ---------------------------------------------------------------------------
// Processar um arquivo JSON -> classe
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
    console.log(`[SEED] Delay entre lotes: ${DELAY_ENTRE_LOTES_MS}ms | Max tentativas: ${MAX_TENTATIVAS}`);
    console.log('');

    let totalCriadas = 0;
    let totalFalhas = 0;
    const inicio = Date.now();

    for (let i = 0; i < lotes.length; i++) {
        const { criadas, falhas } = await criarLoteComRetry(lotes[i], nomeClasse, i, lotes.length);
        totalCriadas += criadas;
        totalFalhas += falhas;

        // Delay entre lotes para respeitar rate limit (30 req/s no free tier)
        if (i < lotes.length - 1) {
            await sleep(DELAY_ENTRE_LOTES_MS);
        }
    }

    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

    console.log('');
    console.log(`[SEED]   Criadas : ${totalCriadas.toLocaleString()}`);
    console.log(`[SEED]   Falhas  : ${totalFalhas.toLocaleString()}`);
    console.log(`[SEED]   Duracao : ${duracao}s`);
    console.log('');
    return { criadas: totalCriadas, falhas: totalFalhas };
}

// ---------------------------------------------------------------------------
// Processar estatisticas agregadas -> classe EstatisticasGeograficas
// ---------------------------------------------------------------------------

async function processarEstatisticas() {
    const caminho = join(RAIZ, 'estatisticas_agregadas.json');
    const nomeClasse = 'EstatisticasGeograficas';

    console.log(`[SEED] JSON : ${caminho}`);
    console.log(`[SEED] Classe: ${nomeClasse}`);

    let entradas;
    try {
        const raw = readFileSync(caminho, 'utf-8');
        entradas = JSON.parse(raw);
        if (!Array.isArray(entradas)) {
            throw new Error('JSON raiz nao e um array. Esperado lista de objetos.');
        }
    } catch (erro) {
        console.error(`[ERRO] Falha ao ler JSON de estatisticas: ${erro.message}`);
        return;
    }

    console.log(`[SEED] Total de entradas: ${entradas.length}`);

    // Limpar classe
    await limparClasse(nomeClasse);

    // Inserir em lotes
    const lotes = chunkArray(entradas, TAMANHO_LOTE);
    console.log(`[SEED] Inserindo ${lotes.length} lotes...`);
    console.log('');

    let totalCriadas = 0;
    let totalFalhas = 0;
    const inicio = Date.now();

    const CHAVES_INDICADORES = [
        'internet', 'biblioteca', 'lab_informatica',
        'quadra_esportes', 'rampas', 'banheiro_acessivel', 'agua_potavel',
    ];

    for (let i = 0; i < lotes.length; i++) {
        const lote = lotes[i];
        const objetos = [];

        for (const entrada of lote) {
            const obj = new Parse.Object(nomeClasse);

            obj.set('nivel', entrada.nivel || '');
            obj.set('total_escolas', entrada.total_escolas || 0);

            if (entrada.uf) {
                obj.set('uf', entrada.uf);
            }
            if (entrada.municipio) {
                obj.set('municipio', entrada.municipio);
            }

            for (const ch of CHAVES_INDICADORES) {
                obj.set(ch, entrada[ch] ?? 0.0);
            }

            objetos.push(obj);
        }

        try {
            await Parse.Object.saveAll(objetos, { useMasterKey: true });
            totalCriadas += objetos.length;
            console.log(`[OK] Lote ${i + 1}/${lotes.length} - ${objetos.length} criadas`);
        } catch (erro) {
            // Fallback individual
            let falhas = 0;
            for (const obj of objetos) {
                try {
                    await obj.save(null, { useMasterKey: true });
                    totalCriadas++;
                } catch (errInd) {
                    falhas++;
                    totalFalhas++;
                    if (falhas <= 3) {
                        console.error(`[ERRO]   nivel=${obj.get('nivel')}: ${extrairMensagemErro(errInd)}`);
                    }
                }
            }
            if (falhas > 3) {
                console.error(`[ERRO]   ... e mais ${falhas - 3} falhas`);
            }
            console.log(`[OK] Lote ${i + 1}/${lotes.length} - ${objetos.length - falhas} criadas, ${falhas} falhas`);
        }

        if (i < lotes.length - 1) {
            await sleep(DELAY_ENTRE_LOTES_MS);
        }
    }

    const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log('');
    console.log(`[SEED]   Criadas : ${totalCriadas.toLocaleString()}`);
    console.log(`[SEED]   Falhas  : ${totalFalhas.toLocaleString()}`);
    console.log(`[SEED]   Duracao : ${duracao}s`);
}

// ---------------------------------------------------------------------------
// Funcao principal
// ---------------------------------------------------------------------------

async function executarSeed() {
    console.log('='.repeat(60));
    console.log('[SEED] FULL IMPORT LINEAR — Escolas2024 PRIMEIRO, depois Escolas2025');
    console.log(`[SEED] App ID : ${APP_ID}`);
    console.log(`[SEED] Tamanho do lote: ${TAMANHO_LOTE} | Delay: ${DELAY_ENTRE_LOTES_MS}ms | Retry: ${MAX_TENTATIVAS}x`);
    console.log('='.repeat(60));
    console.log('');

    // Pre-flight check
    const conectado = await verificarConexao();
    if (!conectado) {
        process.exit(1);
    }
    console.log('');

    // -----------------------------------------------------------------------
    // FASE 1: Escolas2024 (processamento isolado e completo)
    // -----------------------------------------------------------------------
    console.log('='.repeat(60));
    console.log('[SEED] FASE 1/2 — Processando EXCLUSIVAMENTE Escolas2024');
    console.log('='.repeat(60));
    console.log('');

    await processarArquivo('escolas_2024.json', 'Escolas2024');

    console.log('');
    console.log('[SEED] FASE 1/2 CONCLUIDA — Escolas2024 finalizado.');
    console.log('');

    // Pausa entre anos para garantir isolamento total
    console.log('[SEED] Aguardando 2s antes de iniciar FASE 2...');
    await sleep(2000);
    console.log('');

    // -----------------------------------------------------------------------
    // FASE 2: Escolas2025 (processamento isolado e completo)
    // -----------------------------------------------------------------------
    console.log('='.repeat(60));
    console.log('[SEED] FASE 2/2 — Processando EXCLUSIVAMENTE Escolas2025');
    console.log('='.repeat(60));
    console.log('');

    await processarArquivo('escolas_2025.json', 'Escolas2025');

    console.log('');
    console.log('[SEED] FASE 2/2 CONCLUIDA — Escolas2025 finalizado.');

    console.log('');
    console.log('='.repeat(60));
    console.log('[SEED] Importacao linear concluida com sucesso.');
    console.log('='.repeat(60));

    // -----------------------------------------------------------------------
    // FASE 3: Estatisticas Geograficas (3 niveis)
    // -----------------------------------------------------------------------
    console.log('');
    console.log('='.repeat(60));
    console.log('[SEED] FASE 3/3 — Processando EstatisticasGeograficas');
    console.log('='.repeat(60));
    console.log('');

    await processarEstatisticas();

    console.log('');
    console.log('[SEED] FASE 3/3 CONCLUIDA — Todas as fases finalizadas.');

    console.log('');
    console.log('='.repeat(60));
    console.log('[SEED] Pipeline completo — Escolas2024, Escolas2025 e EstatisticasGeograficas.');
    console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

executarSeed().catch((erro) => {
    console.error('[FATAL] Erro nao tratado durante o seed:', erro);
    process.exit(1);
});
