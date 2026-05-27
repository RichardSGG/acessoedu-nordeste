/**
 * src/js/api/escolas.api.js
 * Responsabilidade: Comunicacao com Back4App para Escolas2024 e Escolas2025
 */

import estado from '../core/estado.js';
import { CONFIGURACOES } from '../core/constantes.js';

const CLASSE_2024 = 'Escolas2024';
const CLASSE_2025 = 'Escolas2025';

/**
 * Retorna o nome da classe conforme o ano selecionado nos filtros
 */
function classeAtiva() {
  const ano = estado.obter('filtros')?.ano || 2025;
  return ano === 2024 ? CLASSE_2024 : CLASSE_2025;
}

/**
 * Lista escolas com filtros geograficos e paginacao
 */
export async function listar(filtros = {}) {
  estado.definir('carregando', true);
  try {
    const query = new Parse.Query(classeAtiva());
    query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
    query.exists('internet');

    if (filtros.uf) {
      query.equalTo('uf', filtros.uf);
    }
    if (filtros.municipio) {
      query.equalTo('cidade', filtros.municipio);
    }

    const resultados = await query.find();

    const escolas = resultados.map(obj => {
      const pos = obj.get('posicao_geografica');
      const niveis = obj.get('niveis_ensino');
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        latitude: pos ? pos.latitude : null,
        longitude: pos ? pos.longitude : null,
        internet: obj.get('internet') ?? null,
        biblioteca: obj.get('biblioteca') ?? null,
        lab_informatica: obj.get('lab_informatica') ?? null,
        quadra_esportes: obj.get('quadra_esportes') ?? null,
        rampas: obj.get('rampas') ?? null,
        banheiro_acessivel: obj.get('banheiro_acessivel') ?? null,
        psicologos: obj.get('psicologos') ?? null,
        agua_potavel: obj.get('agua_potavel') ?? null,
        dependencia: obj.get('dependencia') || '',
        niveis_ensino: niveis || {},
        endereco: obj.get('endereco') || null,
        telefone: obj.get('telefone') || null,
        email: obj.get('email') || null,
        delta_infraestrutura: obj.get('delta_infraestrutura') ?? null,
      };
    });

    estado.definir('escolas', escolas);
    return escolas;
  } catch (erro) {
    console.error('[escolas.api] Erro ao listar:', erro);
    estado.definir('escolas', []);
  } finally {
    estado.definir('carregando', false);
  }
}

/**
 * Busca uma escola pelo id_escola (codigo INEP)
 */
export async function buscarPorIdEscola(idEscola) {
  try {
    const query = new Parse.Query(classeAtiva());
    query.equalTo('id_escola', String(idEscola));
    const obj = await query.first();
    if (!obj) return null;

    const pos = obj.get('posicao_geografica');
    return {
      id_parse: obj.id,
      id_escola: obj.get('id_escola'),
      nome: obj.get('nome') || '',
      cidade: obj.get('cidade') || '',
      uf: obj.get('uf') || '',
      latitude: pos ? pos.latitude : null,
      longitude: pos ? pos.longitude : null,
      internet: obj.get('internet') ?? null,
      biblioteca: obj.get('biblioteca') ?? null,
      lab_informatica: obj.get('lab_informatica') ?? null,
      quadra_esportes: obj.get('quadra_esportes') ?? null,
      rampas: obj.get('rampas') ?? null,
      banheiro_acessivel: obj.get('banheiro_acessivel') ?? null,
      psicologos: obj.get('psicologos') ?? null,
      agua_potavel: obj.get('agua_potavel') ?? null,
      dependencia: obj.get('dependencia') || '',
      niveis_ensino: obj.get('niveis_ensino') || {},
      endereco: obj.get('endereco') || null,
      telefone: obj.get('telefone') || null,
      email: obj.get('email') || null,
      delta_infraestrutura: obj.get('delta_infraestrutura') ?? null,
    };
  } catch (erro) {
    console.error('[escolas.api] Erro ao buscar escola:', erro);
    return null;
  }
}

/**
 * Busca a mesma escola nos dois anos para comparacao
 */
export async function buscarComparativo(idEscola) {
  try {
    const [dados2024, dados2025] = await Promise.all([
      _buscarPorAno(CLASSE_2024, idEscola),
      _buscarPorAno(CLASSE_2025, idEscola),
    ]);
    return { dados2024, dados2025 };
  } catch (erro) {
    console.error('[escolas.api] Erro ao buscar comparativo:', erro);
    return { dados2024: null, dados2025: null };
  }
}

async function _buscarPorAno(classe, idEscola) {
  const query = new Parse.Query(classe);
  query.equalTo('id_escola', String(idEscola));
  const obj = await query.first();
  if (!obj) return null;
  const pos = obj.get('posicao_geografica');
  return {
    id_escola: obj.get('id_escola'),
    nome: obj.get('nome') || '',
    internet: obj.get('internet') ?? null,
    biblioteca: obj.get('biblioteca') ?? null,
    lab_informatica: obj.get('lab_informatica') ?? null,
    quadra_esportes: obj.get('quadra_esportes') ?? null,
    rampas: obj.get('rampas') ?? null,
    banheiro_acessivel: obj.get('banheiro_acessivel') ?? null,
    psicologos: obj.get('psicologos') ?? null,
    agua_potavel: obj.get('agua_potavel') ?? null,
    latitude: pos ? pos.latitude : null,
    longitude: pos ? pos.longitude : null,
    endereco: obj.get('endereco') || null,
    telefone: obj.get('telefone') || null,
    email: obj.get('email') || null,
    delta_infraestrutura: obj.get('delta_infraestrutura') ?? null,
  };
}

/**
 * Busca escolas por nome com debounce (a UI ja aplica o debounce)
 */
export async function buscarPorNome(termo) {
  if (!termo || termo.length < 2) return [];
  try {
    const query = new Parse.Query(classeAtiva());
    query.matches('nome', termo, 'i');
    query.limit(50);
    query.exists('internet');
    const resultados = await query.find();
    return resultados.map(obj => {
      const pos = obj.get('posicao_geografica');
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        latitude: pos ? pos.latitude : null,
        longitude: pos ? pos.longitude : null,
      };
    });
  } catch (erro) {
    console.error('[escolas.api] Erro na busca por nome:', erro);
    return [];
  }
}

/**
 * Obtem totais agregados para os KPIs do dashboard
 */
export async function obterAgregados() {
  try {
    const [res2024, res2025] = await Promise.all([
      _contarIndicadores(CLASSE_2024),
      _contarIndicadores(CLASSE_2025),
    ]);
    return { dados2024: res2024, dados2025: res2025 };
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter agregados:', erro);
    return null;
  }
}

async function _contarIndicadores(classe) {
  const query = new Parse.Query(classe);
  query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
  query.exists('internet');
  query.exists('biblioteca');
  query.exists('lab_informatica');
  query.exists('banheiro_acessivel');
  query.exists('agua_potavel');

  const resultados = await query.find();
  let internet = 0, biblioteca = 0, lab = 0, banheiro = 0,
      quadra = 0, rampas = 0, agua = 0, psicologos = 0;

  for (const obj of resultados) {
    if (obj.get('internet') === 1) internet++;
    if (obj.get('biblioteca') === 1) biblioteca++;
    if (obj.get('lab_informatica') === 1) lab++;
    if (obj.get('banheiro_acessivel') === 1) banheiro++;
    if (obj.get('quadra_esportes') === 1) quadra++;
    if (obj.get('rampas') === 1) rampas++;
    if (obj.get('agua_potavel') === 1) agua++;
    psicologos += obj.get('psicologos') || 0;
  }

  return {
    total: resultados.length,
    internet, biblioteca, lab_informatica: lab,
    banheiro_acessivel: banheiro, quadra_esportes: quadra,
    rampas, agua_potavel: agua, psicologos,
  };
}

/**
 * Obtem media de indicadores por municipio (para grafico radar comparativo)
 */
export async function obterMediaMunicipio(municipio) {
  try {
    const query = new Parse.Query(classeAtiva());
    query.equalTo('cidade', municipio);
    query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
    query.exists('internet');

    const resultados = await query.find();
    if (resultados.length === 0) return null;

    let internet = 0, biblioteca = 0, lab = 0, banheiro = 0,
        quadra = 0, rampas = 0, agua = 0;

    for (const obj of resultados) {
      internet += obj.get('internet') || 0;
      biblioteca += obj.get('biblioteca') || 0;
      lab += obj.get('lab_informatica') || 0;
      banheiro += obj.get('banheiro_acessivel') || 0;
      quadra += obj.get('quadra_esportes') || 0;
      rampas += obj.get('rampas') || 0;
      agua += obj.get('agua_potavel') || 0;
    }

    const n = resultados.length;
    return {
      total: n,
      internet: internet / n,
      biblioteca: biblioteca / n,
      lab_informatica: lab / n,
      banheiro_acessivel: banheiro / n,
      quadra_esportes: quadra / n,
      rampas: rampas / n,
      agua_potavel: agua / n,
    };
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter media do municipio:', erro);
    return null;
  }
}

/**
 * Obtem as top 50 escolas ordenadas por um criterio composto de infraestrutura
 */
export async function obterRanking(uf = null) {
  try {
    const query = new Parse.Query(classeAtiva());
    query.limit(2000);
    query.exists('internet');

    if (uf) {
      query.equalTo('uf', uf);
    }

    const resultados = await query.find();

    const escolas = resultados.map(obj => {
      const nota = _calcularNotaExcelencia(obj);
      return {
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        notaExcelencia: nota.nota,
        badge: nota.badge,
        internet: obj.get('internet') || 0,
        biblioteca: obj.get('biblioteca') || 0,
        lab_informatica: obj.get('lab_informatica') || 0,
        banheiro_acessivel: obj.get('banheiro_acessivel') || 0,
        agua_potavel: obj.get('agua_potavel') || 0,
      };
    });

    escolas.sort((a, b) => b.notaExcelencia - a.notaExcelencia);
    return escolas.slice(0, 50);
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter ranking:', erro);
    return [];
  }
}

function _calcularNotaExcelencia(obj) {
  const indicadores = [
    obj.get('internet') || 0,
    obj.get('biblioteca') || 0,
    obj.get('lab_informatica') || 0,
    obj.get('quadra_esportes') || 0,
    obj.get('rampas') || 0,
    obj.get('banheiro_acessivel') || 0,
    obj.get('agua_potavel') || 0,
  ];
  const soma = indicadores.reduce((acc, v) => acc + v, 0);
  const nota = (soma / indicadores.length) * 10;
  let badge = null;
  if (nota >= 9) badge = 'ouro';
  else if (nota >= 7.5) badge = 'prata';
  else if (nota >= 6) badge = 'bronze';
  return { nota: Math.round(nota * 10) / 10, badge };
}
