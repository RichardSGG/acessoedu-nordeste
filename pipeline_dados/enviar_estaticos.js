/**
 * pipeline_dados/enviar_estaticos.js
 * Envia estatisticas agregadas para a classe EstatisticasAgregadas no Back4App.
 *
 * Le os JSONs gerados por gerar_estaticos.js e envia em lotes de 50.
 *
 * Uso:
 *   node pipeline_dados/enviar_estaticos.js
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
const DELAY_MS = 500;

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

/** Converte chave de municipio "NomeMunicipio_UF_ANO" -> { municipio, uf, ano } */
function parseChaveMunicipio(chave) {
  const partes = chave.split('_');
  const ano = parseInt(partes.pop(), 10);
  const uf = partes.pop();
  const municipio = partes.join('_');
  return { municipio, uf, ano };
}

/** Converte chave de estado "UF_ANO" -> { uf, ano } */
function parseChaveEstado(chave) {
  const partes = chave.split('_');
  const ano = parseInt(partes.pop(), 10);
  const uf = partes.join('_');
  return { uf, ano };
}

/** Transforma agregado (contagens) em objeto com percentagens (0-100) */
function formatarDados(agg) {
  const total = agg.total || 1;
  return {
    total_escolas: total,
    internet: Math.round((agg.com_internet / total) * 1000) / 10,
    banheiro_pne: Math.round((agg.com_banheiro_pne / total) * 1000) / 10,
    quadra: Math.round((agg.com_quadra / total) * 1000) / 10,
    rampa_acessibilidade: Math.round((agg.com_rampa / total) * 1000) / 10,
    laboratorio: Math.round((agg.com_laboratorio / total) * 1000) / 10,
    agua_potavel: Math.round((agg.com_agua_potavel / total) * 1000) / 10,
    energia_eletrica: Math.round((agg.com_energia / total) * 1000) / 10,
    indicador_geral: agg.media_indicador,
  };
}

/** Constroi a lista de payloads a partir dos JSONs gerados */
function construirPayloads() {
  const indicadoresGerais = loadJSON('indicadores_gerais.json');
  const porEstado = loadJSON('por_estado.json');
  const porMunicipio = loadJSON('por_municipio.json');

  const payloads = [];

  /* --- Regiao (Nordeste) --- */
  if (indicadoresGerais['2024'] && indicadoresGerais['2025']) {
    payloads.push({
      nivel: 'regiao',
      chave: 'Nordeste',
      dados_2024: indicadoresGerais['2024'],
      dados_2025: indicadoresGerais['2025'],
    });
    console.log(`  Regiao: Nordeste (1 registro)`);
  }

  /* --- Estados --- */
  const estadosMap = {};
  for (const [chave, agg] of Object.entries(porEstado)) {
    const { uf, ano } = parseChaveEstado(chave);
    if (!estadosMap[uf]) estadosMap[uf] = {};
    estadosMap[uf][ano] = agg;
  }

  for (const [uf, anos] of Object.entries(estadosMap).sort()) {
    if (anos[2024] && anos[2025]) {
      payloads.push({
        nivel: 'estado',
        chave: uf,
        dados_2024: formatarDados(anos[2024]),
        dados_2025: formatarDados(anos[2025]),
      });
    }
  }
  console.log(`  Estados: ${Object.keys(estadosMap).length} UFs`);

  /* --- Municipios --- */
  const municipiosMap = {};
  for (const [chave, agg] of Object.entries(porMunicipio)) {
    const { municipio, uf, ano } = parseChaveMunicipio(chave);
    const chaveUnica = `${uf}-${municipio}`;
    if (!municipiosMap[chaveUnica]) municipiosMap[chaveUnica] = {};
    municipiosMap[chaveUnica][ano] = agg;
  }

  for (const [chaveUnica, anos] of Object.entries(municipiosMap).sort()) {
    if (anos[2024] && anos[2025]) {
      payloads.push({
        nivel: 'municipio',
        chave: chaveUnica,
        dados_2024: formatarDados(anos[2024]),
        dados_2025: formatarDados(anos[2025]),
      });
    }
  }
  console.log(`  Municipios: ${Object.keys(municipiosMap).length} municipios`);

  return payloads;
}

async function sendBatch(lote, numLote, totalLotes) {
  const requests = lote.map((payload) => ({
    method: 'POST',
    path: '/parse/classes/EstatisticasAgregadas',
    body: payload,
  }));

  const url = `${B4A_BASE}/parse/batch`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-REST-API-Key': REST_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`HTTP ${res.status}: ${errBody}`);
  }

  const result = await res.json();

  const erros = result.filter((r) => r.error);
  if (erros.length > 0) {
    console.warn(`  Aviso: ${erros.length} erro(s) no lote ${numLote}/${totalLotes}`);
    console.error(`  -> Primeiro erro: [${erros[0].error.code}] ${erros[0].error.message || erros[0].error.error || JSON.stringify(erros[0].error)}`);
  }

  console.log(`  Lote ${numLote}/${totalLotes} enviado (${requests.length} registros)`);
  return result;
}

async function main() {
  checkCredentials();

  console.log('Construindo payloads de estatisticas agregadas...');
  const payloads = construirPayloads();
  console.log(`\nTotal de registros a enviar: ${payloads.length}`);

  const totalLotes = Math.ceil(payloads.length / BATCH_SIZE);

  console.log(`Enviando para Back4App (lotes de ${BATCH_SIZE})...`);
  console.log(`  Base URL: ${B4A_BASE}`);
  console.log(`  Classe: EstatisticasAgregadas\n`);

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const lote = payloads.slice(i, i + BATCH_SIZE);
    const numLote = Math.floor(i / BATCH_SIZE) + 1;

    try {
      await sendBatch(lote, numLote, totalLotes);
    } catch (err) {
      console.error(`  ERRO no lote ${numLote}/${totalLotes}: ${err.message}`);
    }

    if (numLote < totalLotes) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log('\nEnvio de estatisticas concluido.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
