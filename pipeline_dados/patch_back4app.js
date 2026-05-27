/**
 * pipeline_dados/patch_back4app.js
 * Atualiza apenas os campos 'dependencia', 'numero' e 'telefone' em Escolas2025.
 *
 * Estrategia (2 fases):
 *   1. Pagina TODOS os registros de Escolas2025 para montar mapa id_escola → objectId
 *   2. Envia PUT em batch de 150 atualizando dependencia, numero e telefone
 *
 * Uso:
 *   node pipeline_dados/patch_back4app.js
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, '..', '.env') });

const APP_ID = process.env.BACK4APP_APP_ID;
const REST_API_KEY = process.env.BACK4APP_REST_API_KEY;
const B4A_BASE = 'https://parseapi.back4app.com';
const BATCH_SIZE = 50;
const PAGE_SIZE = 500;
const DELAY_MS = 300;
const MAX_RETRIES = 3;

function checkCredentials() {
  if (!APP_ID || !REST_API_KEY) {
    console.error('ERRO: BACK4APP_APP_ID e/ou BACK4APP_REST_API_KEY nao encontrados no .env.');
    process.exit(1);
  }
}

function loadJSON(filename) {
  const raw = readFileSync(resolve(__dirname, 'saida', filename), 'utf-8');
  return JSON.parse(raw);
}

/** Filtra apenas escolas do Nordeste pelo prefixo do codigo INEP (21-29) */
function isNordeste(idEscola) {
  const prefixo = parseInt(String(idEscola).substring(0, 2), 10);
  return prefixo >= 21 && prefixo <= 29;
}

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  for (let tentativa = 1; tentativa <= retries; tentativa++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 429) {
        const wait = Math.min(1000 * tentativa, 5000);
        console.warn(`  Rate-limit (429), aguardando ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (res.status >= 500) {
        console.warn(`  Erro ${res.status}, tentativa ${tentativa}/${retries}...`);
        await new Promise(r => setTimeout(r, 500 * tentativa));
        continue;
      }
      return res;
    } catch (err) {
      if (tentativa < retries) {
        console.warn(`  Erro de rede: ${err.message}, tentativa ${tentativa}/${retries}...`);
        await new Promise(r => setTimeout(r, 500 * tentativa));
      } else {
        throw err;
      }
    }
  }
}

/** Fase 1: Paginar todos os registros da classe e construir mapa id_escola → objectId */
async function construirMapaObjectIds(classe) {
  console.log(`  Construindo mapa de objectIds para ${classe}...`);
  const mapa = new Map();
  let skip = 0;
  let pagina = 1;
  let totalEstimado = null;

  while (true) {
    const url = `${B4A_BASE}/parse/classes/${classe}?keys=objectId,id_escola&limit=${PAGE_SIZE}&skip=${skip}&order=createdAt`;
    const res = await fetchWithRetry(url, {
      headers: {
        'X-Parse-Application-Id': APP_ID,
        'X-Parse-REST-API-Key': REST_API_KEY,
      },
    });

    const data = await res.json();
    if (!data.results || data.results.length === 0) break;

    if (totalEstimado === null && data.count) {
      totalEstimado = data.count;
      const totalPaginas = Math.ceil(totalEstimado / PAGE_SIZE);
      console.log(`  Total estimado: ${totalEstimado} registros (~${totalPaginas} paginas)`);
    }

    for (const r of data.results) {
      const id = r.id_escola;
      if (id) mapa.set(String(id), r.objectId);
    }

    if (pagina % 20 === 0) {
      console.log(`  Pagina ${pagina}: ${mapa.size} objectIds no mapa ate agora...`);
    }

    skip += PAGE_SIZE;
    pagina++;
  }

  console.log(`  Mapa construido: ${mapa.size} objectIds`);
  return mapa;
}

/** Fase 2: Enviar PUTs em batch */
async function enviarLotePUT(classe, updates, numLote, totalLotes) {
  const requests = updates.map(({ objectId, dependencia, numero, telefone }) => ({
    method: 'PUT',
    path: `/parse/classes/${classe}/${objectId}`,
    body: { dependencia, numero, telefone },
  }));

  const url = `${B4A_BASE}/parse/batch`;
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-REST-API-Key': REST_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  const result = await res.json();
  const erros = result.filter((r) => r.error);
  if (erros.length > 0) {
    console.warn(`  Aviso: ${erros.length} erro(s) no lote ${numLote}/${totalLotes}`);
    const primeiro = erros[0].error;
    console.warn(`  -> [${primeiro.code}] ${primeiro.message || primeiro.error || JSON.stringify(primeiro)}`);
  }

  return result;
}

async function main() {
  checkCredentials();

  console.log('=== PATCH Back4App: dependencia, numero e telefone ===');
  console.log(`  Base URL: ${B4A_BASE}`);
  console.log(`  Classe: Escolas2025`);
  console.log(`  Campos: dependencia, numero, telefone\n`);

  // Carregar complementos
  const complementos = loadJSON('complementos_2025.json');
  const todas = Object.values(complementos);
  const entradas = todas.filter(e => isNordeste(e.id_escola));
  const foraNordeste = todas.length - entradas.length;

  console.log(`--- Escolas2025 (2025) ---`);
  console.log(`  Total no JSON: ${todas.length} | Nordeste: ${entradas.length} | Ignorados (outras regioes): ${foraNordeste}`);

  // Fase 1: Construir mapa de objectIds (paginação ~500 registros por vez)
  const mapaObjectIds = await construirMapaObjectIds('Escolas2025');

  // Fase 2: Cruzar complementos com objectIds
  console.log(`\n  Cruzando complementos com objectIds...`);
  const updates = [];
  let naoEncontrados = 0;

  for (const entrada of entradas) {
    const objectId = mapaObjectIds.get(String(entrada.id_escola));
    if (objectId) {
      updates.push({
        objectId,
        dependencia: entrada.dependencia || '',
        numero: entrada.numero || '',
        telefone: entrada.telefone || '',
      });
    } else {
      naoEncontrados++;
    }
  }

  console.log(`  Encontrados: ${updates.length} | Nao encontrados: ${naoEncontrados}`);

  if (updates.length === 0) {
    console.log('  Nada a atualizar.');
    return;
  }

  // Fase 3: Enviar PUTs em batch
  const totalLotes = Math.ceil(updates.length / BATCH_SIZE);
  console.log(`\n  Enviando ${updates.length} atualizacoes em ${totalLotes} lote(s) de ${BATCH_SIZE}...`);

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const lote = updates.slice(i, i + BATCH_SIZE);
    const numLote = Math.floor(i / BATCH_SIZE) + 1;

    try {
      await enviarLotePUT('Escolas2025', lote, numLote, totalLotes);
      console.log(`  Lote ${numLote}/${totalLotes} enviado (${lote.length} registros)`);
    } catch (err) {
      console.error(`  ERRO FATAL no lote ${numLote}/${totalLotes}: ${err.message}`);
    }

    if (numLote < totalLotes) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\n=== PATCH concluido com sucesso. ===');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
