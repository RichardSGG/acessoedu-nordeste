/**
 * pipeline_dados/gerar_estaticos.js
 * Gera estatisticas agregadas a partir dos JSONs de escolas (escolas_2024.json, escolas_2025.json).
 *
 * Saidas:
 *   - indicadores_gerais.json  (medias do Nordeste inteiro por ano)
 *   - por_estado.json          (medias por UF e ano)
 *   - por_municipio.json       (medias por Municipio, UF e ano)
 *
 * Uso:
 *   node pipeline_dados/gerar_estaticos.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, '..');
const SAIDA = resolve(__dirname, 'saida');

/** Indicadores presentes no JSON de origem (schema antigo do ETL) */
const INDICADORES = [
  { chave: 'internet',          agregado: 'com_internet' },
  { chave: 'banheiro_acessivel', agregado: 'com_banheiro_pne' },
  { chave: 'quadra_esportes',   agregado: 'com_quadra' },
  { chave: 'rampas',            agregado: 'com_rampa' },
  { chave: 'lab_informatica',   agregado: 'com_laboratorio' },
  { chave: 'agua_potavel',      agregado: 'com_agua_potavel' },
];

/** Energia eletrica nao existe no JSON antigo — sempre 0 */
const INDICADOR_ENERGIA = 'com_energia';

/** Inicializa um acumulador zerado */
function acumuladorVazio() {
  const acc = { total: 0 };
  for (const ind of INDICADORES) acc[ind.agregado] = 0;
  acc[INDICADOR_ENERGIA] = 0;
  /* soma dos indicadores para media */
  acc._somaIndicadores = 0;
  return acc;
}

/** Acumula indicadores de uma escola no acumulador */
function acumular(acc, escola) {
  acc.total++;
  for (const ind of INDICADORES) {
    const v = escola[ind.chave];
    if (v === 1) {
      acc[ind.agregado]++;
      acc._somaIndicadores++;
    }
  }
  /* energia eletrica sempre 0 (nao existe no JSON) */
}

/** Finaliza acumulador calculando media_indicador (0-10) */
function finalizar(acc) {
  const total = acc.total || 1;
  const result = { total };
  for (const ind of INDICADORES) result[ind.agregado] = acc[ind.agregado];
  result[INDICADOR_ENERGIA] = 0;
  result.media_indicador = Math.round((acc._somaIndicadores / (total * INDICADORES.length)) * 100) / 10;
  delete acc._somaIndicadores;
  return result;
}

function carregarJSON(nome) {
  const raw = readFileSync(resolve(RAIZ, nome), 'utf-8');
  return JSON.parse(raw);
}

function main() {
  mkdirSync(SAIDA, { recursive: true });

  const anos = [2024, 2025];
  const arquivos = { 2024: 'escolas_2024.json', 2025: 'escolas_2025.json' };

  /* Estruturas de agregacao */
  const geral = {};          // ano -> acumulador
  const porEstado = {};      // "UF_ANO" -> acumulador
  const porMunicipio = {};   // "Municipio_UF_ANO" -> acumulador

  for (const ano of anos) {
    console.log(`Processando ${ano}...`);
    const dados = carregarJSON(arquivos[ano]);
    const escolas = Object.values(dados);

    if (!geral[ano]) geral[ano] = acumuladorVazio();

    for (const escola of escolas) {
      const uf = escola.uf || 'XX';
      const municipio = escola.cidade || 'SemNome';

      /* Geral */
      acumular(geral[ano], escola);

      /* Por estado */
      const chaveEstado = `${uf}_${ano}`;
      if (!porEstado[chaveEstado]) porEstado[chaveEstado] = acumuladorVazio();
      acumular(porEstado[chaveEstado], escola);

      /* Por municipio */
      const chaveMunicipio = `${municipio}_${uf}_${ano}`;
      if (!porMunicipio[chaveMunicipio]) porMunicipio[chaveMunicipio] = acumuladorVazio();
      acumular(porMunicipio[chaveMunicipio], escola);
    }

    console.log(`  ${escolas.length} escolas processadas`);
  }

  /* Finaliza e salva */
  console.log('\nFinalizando e salvando...');

  /* Indicadores gerais */
  const saidaGeral = {};
  for (const ano of anos) saidaGeral[String(ano)] = finalizar(geral[ano]);
  writeFileSync(resolve(SAIDA, 'indicadores_gerais.json'), JSON.stringify(saidaGeral, null, 2));
  console.log(`  indicadores_gerais.json — ${Object.keys(saidaGeral).length} anos`);

  /* Por estado */
  const saidaEstado = {};
  for (const [chave, acc] of Object.entries(porEstado).sort()) {
    saidaEstado[chave] = finalizar(acc);
  }
  writeFileSync(resolve(SAIDA, 'por_estado.json'), JSON.stringify(saidaEstado, null, 2));
  console.log(`  por_estado.json — ${Object.keys(saidaEstado).length} registros`);

  /* Por municipio */
  const saidaMunicipio = {};
  for (const [chave, acc] of Object.entries(porMunicipio).sort()) {
    saidaMunicipio[chave] = finalizar(acc);
  }
  writeFileSync(resolve(SAIDA, 'por_municipio.json'), JSON.stringify(saidaMunicipio, null, 2));
  console.log(`  por_municipio.json — ${Object.keys(saidaMunicipio).length} registros`);

  console.log('\nGeracao de estatisticas concluida.');
}

main();
