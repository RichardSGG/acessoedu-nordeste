/**
 * src/js/api/escolas.api.js
 * Responsabilidade: Comunicação com Back4App para Escolas2024 e Escolas2025
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
    const query = new Parse.Query(CLASSE_2025);
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
      const lat = pos ? pos.latitude : null;
      const lng = pos ? pos.longitude : null;
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        lat, lng,
        latitude: lat,
        longitude: lng,
        internet: obj.get('internet') ?? null,
        laboratorio: obj.get('laboratorio') ?? null,
        quadra: obj.get('quadra') ?? null,
        rampa_acessibilidade: obj.get('rampa_acessibilidade') ?? null,
        banheiro_pne: obj.get('banheiro_pne') ?? null,
        agua_potavel: obj.get('agua_potavel') ?? null,
        energia_eletrica: obj.get('energia_eletrica') ?? null,
        dependencia: obj.get('dependencia') || '',
        telefone: obj.get('telefone') || '',
        cep: obj.get('cep') || '',
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
 * Busca uma escola pelo id_escola (código INEP).
 * Procura em ambas as classes (2025 primeiro, 2024 como fallback)
 * para garantir que o link direto ?id= sempre funcione,
 * independentemente do estado dos filtros.
 * @param {string|number} idEscola - Código INEP da escola
 * @returns {Promise<Object|null>}
 */
export async function buscarPorIdEscola(idEscola) {
  const id = String(idEscola).trim();
  if (!id) return null;

  const mapear = (obj) => {
    if (!obj) return null;
    const pos = obj.get('posicao_geografica');
    const lat = pos ? pos.latitude : null;
    const lng = pos ? pos.longitude : null;
    return {
      id_parse: obj.id,
      classe: obj.className,
      id_escola: obj.get('id_escola'),
      nome: obj.get('nome') || '',
      cidade: obj.get('cidade') || '',
      uf: obj.get('uf') || '',
      lat, lng,
      latitude: lat,
      longitude: lng,
      internet: obj.get('internet') ?? null,
      laboratorio: obj.get('laboratorio') ?? null,
      quadra: obj.get('quadra') ?? null,
      rampa_acessibilidade: obj.get('rampa_acessibilidade') ?? null,
      banheiro_pne: obj.get('banheiro_pne') ?? null,
      agua_potavel: obj.get('agua_potavel') ?? null,
      energia_eletrica: obj.get('energia_eletrica') ?? null,
      dependencia: obj.get('dependencia') || '',
      endereco: obj.get('endereco') || null,
      telefone: obj.get('telefone') || null,
      foto_url: obj.get('foto_url') || null,
      cep: obj.get('cep') || '',
    };
  };

  try {
    /* Tenta 2025 primeiro */
    const q25 = new Parse.Query(CLASSE_2025);
    q25.equalTo('id_escola', id);
    const obj25 = await q25.first({ useMasterKey: false });
    if (obj25) return mapear(obj25);

    /* Fallback para 2024 */
    const q24 = new Parse.Query(CLASSE_2024);
    q24.equalTo('id_escola', id);
    const obj24 = await q24.first({ useMasterKey: false });
    if (obj24) return mapear(obj24);

    return null;
  } catch (erro) {
    console.error('[escolas.api] Erro ao buscar escola por id_escola:', erro);
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
  const lat = pos ? pos.latitude : null;
  const lng = pos ? pos.longitude : null;
  return {
    id_escola: obj.get('id_escola'),
    nome: obj.get('nome') || '',
    internet: obj.get('internet') ?? null,
    laboratorio: obj.get('laboratorio') ?? null,
    quadra: obj.get('quadra') ?? null,
    rampa_acessibilidade: obj.get('rampa_acessibilidade') ?? null,
    banheiro_pne: obj.get('banheiro_pne') ?? null,
    agua_potavel: obj.get('agua_potavel') ?? null,
    energia_eletrica: obj.get('energia_eletrica') ?? null,
    latitude: lat,
    longitude: lng,
    endereco: obj.get('endereco') || null,
    telefone: obj.get('telefone') || null,
    foto_url: obj.get('foto_url') || null,
    cep: obj.get('cep') || '',
    classe: obj.className,
  };
}

/**
 * Busca escolas dentro da caixa delimitadora visivel no mapa.
 * Usa withinGeoBox do Parse para carregamento dinamico sob demanda.
 * @param {Object} sw - { lat: number, lng: number } canto sudoeste
 * @param {Object} ne - { lat: number, lng: number } canto nordeste
 * @returns {Promise<Array>}
 */
export async function buscarPorBoundingBox(sw, ne) {
  if (!sw || !ne) return [];

  try {
    const geoSw = new Parse.GeoPoint(sw.lat, sw.lng);
    const geoNe = new Parse.GeoPoint(ne.lat, ne.lng);

    const query = new Parse.Query(CLASSE_2025);
    query.withinGeoBox('posicao_geografica', geoSw, geoNe);
    query.limit(100);
    query.exists('posicao_geografica');

    const resultados = await query.find();

    return resultados.map(obj => {
      const pos = obj.get('posicao_geografica');
      const lat = pos ? pos.latitude : null;
      const lng = pos ? pos.longitude : null;
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        lat, lng,
        latitude: lat,
        longitude: lng,
        internet: obj.get('internet') ?? null,
        laboratorio: obj.get('laboratorio') ?? null,
        quadra: obj.get('quadra') ?? null,
        rampa_acessibilidade: obj.get('rampa_acessibilidade') ?? null,
        banheiro_pne: obj.get('banheiro_pne') ?? null,
        agua_potavel: obj.get('agua_potavel') ?? null,
        energia_eletrica: obj.get('energia_eletrica') ?? null,
        dependencia: obj.get('dependencia') || '',
        telefone: obj.get('telefone') || '',
        cep: obj.get('cep') || '',
      };
    });
  } catch (erro) {
    console.error('[escolas.api] Erro na busca por bounding box:', erro);
    return [];
  }
}

/**
 * Busca escolas em um raio de X quilometros a partir de coordenadas.
 * Utiliza GeoPoint nativo do Parse com withinKilometers().
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} raioKm - Raio em quilometros (max 50)
 * @returns {Promise<Array>}
 */
export async function buscarPorRaio(latitude, longitude, raioKm = 10) {
  if (latitude == null || longitude == null) return [];

  try {
    const ponto = new Parse.GeoPoint(latitude, longitude);
    const query = new Parse.Query(CLASSE_2025);
    query.withinKilometers('posicao_geografica', ponto, Math.min(raioKm, 50));
    query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
    query.exists('posicao_geografica');

    const resultados = await query.find();

    return resultados.map(obj => {
      const pos = obj.get('posicao_geografica');
      const lat = pos ? pos.latitude : null;
      const lng = pos ? pos.longitude : null;
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        lat, lng,
        latitude: lat,
        longitude: lng,
        internet: obj.get('internet') ?? null,
        laboratorio: obj.get('laboratorio') ?? null,
        quadra: obj.get('quadra') ?? null,
        rampa_acessibilidade: obj.get('rampa_acessibilidade') ?? null,
        banheiro_pne: obj.get('banheiro_pne') ?? null,
        agua_potavel: obj.get('agua_potavel') ?? null,
        energia_eletrica: obj.get('energia_eletrica') ?? null,
        dependencia: obj.get('dependencia') || '',
        telefone: obj.get('telefone') || '',
        cep: obj.get('cep') || '',
      };
    });
  } catch (erro) {
    console.error('[escolas.api] Erro na busca por raio:', erro);
    return [];
  }
}

/**
 * Busca escolas por nome com debounce (a UI ja aplica o debounce)
 */
export async function buscarPorNome(termo) {
  if (!termo || termo.length < 2) return [];
  try {
    const query = new Parse.Query(CLASSE_2025);
    query.matches('nome', termo, 'i');
    query.limit(50);
    query.exists('internet');
    const resultados = await query.find();
    return resultados.map(obj => {
      const pos = obj.get('posicao_geografica');
      const lat = pos ? pos.latitude : null;
      const lng = pos ? pos.longitude : null;
      return {
        id_parse: obj.id,
        id_escola: obj.get('id_escola'),
        nome: obj.get('nome') || '',
        cidade: obj.get('cidade') || '',
        uf: obj.get('uf') || '',
        lat, lng,
        latitude: lat,
        longitude: lng,
        telefone: obj.get('telefone') || '',
        cep: obj.get('cep') || '',
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
export async function obterAgregados(uf = null) {
  try {
    const [res2024, res2025] = await Promise.all([
      _contarIndicadores(CLASSE_2024, uf),
      _contarIndicadores(CLASSE_2025, uf),
    ]);
    return { dados2024: res2024, dados2025: res2025 };
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter agregados:', erro);
    return null;
  }
}

async function _contarIndicadores(classe, uf = null) {
  const query = new Parse.Query(classe);
  query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
  query.exists('internet');
  query.exists('laboratorio');
  query.exists('banheiro_pne');
  query.exists('agua_potavel');

  if (uf) {
    query.equalTo('uf', uf);
  }

  const resultados = await query.find();
  let internet = 0, lab = 0, banheiro = 0,
      quadra = 0, rampas = 0, agua = 0, energia = 0;

  for (const obj of resultados) {
    if (obj.get('internet') === 1) internet++;
    if (obj.get('laboratorio') === 1) lab++;
    if (obj.get('banheiro_pne') === 1) banheiro++;
    if (obj.get('quadra') === 1) quadra++;
    if (obj.get('rampa_acessibilidade') === 1) rampas++;
    if (obj.get('agua_potavel') === 1) agua++;
    if (obj.get('energia_eletrica') === 1) energia++;
  }

  return {
    total: resultados.length,
    internet, laboratorio: lab,
    banheiro_pne: banheiro, quadra,
    rampa_acessibilidade: rampas, agua_potavel: agua,
    energia_eletrica: energia,
  };
}

/**
 * Obtem media de indicadores por municipio (para grafico radar comparativo)
 */
export async function obterMediaMunicipio(municipio) {
  try {
    const query = new Parse.Query(CLASSE_2025);
    query.equalTo('cidade', municipio);
    query.limit(CONFIGURACOES.LIMITE_CARREGAMENTO_ESCOLAS || 500);
    query.exists('internet');

    const resultados = await query.find();
    if (resultados.length === 0) return null;

    let internet = 0, lab = 0, banheiro = 0,
        quadra = 0, rampas = 0, agua = 0, energia = 0;

    for (const obj of resultados) {
      internet += obj.get('internet') || 0;
      lab += obj.get('laboratorio') || 0;
      banheiro += obj.get('banheiro_pne') || 0;
      quadra += obj.get('quadra') || 0;
      rampas += obj.get('rampa_acessibilidade') || 0;
      agua += obj.get('agua_potavel') || 0;
      energia += obj.get('energia_eletrica') || 0;
    }

    const n = resultados.length;
    return {
      total: n,
      internet: internet / n,
      laboratorio: lab / n,
      banheiro_pne: banheiro / n,
      quadra: quadra / n,
      rampa_acessibilidade: rampas / n,
      agua_potavel: agua / n,
      energia_eletrica: energia / n,
    };
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter media do municipio:', erro);
    return null;
  }
}

/**
 * Obtem estatisticas agregadas em 3 niveis para um dado municipio.
 * Consulta a classe EstatisticasGeograficas e retorna um objeto
 * consolidado contendo as medias do Municipio, do Estado (UF) e da Regiao.
 *
 * @param {string} uf - Sigla do estado (ex: 'PE')
 * @param {string} municipio - Nome do municipio (ex: 'Recife')
 * @returns {Promise<{municipio: Object|null, estado: Object|null, regiao: Object|null}>}
 */
export async function obterEstatisticas(uf, municipio) {
  if (!uf || !municipio) {
    return { municipio: null, estado: null, regiao: null };
  }

  try {
    const qMunicipio = new Parse.Query('EstatisticasGeograficas');
    qMunicipio.equalTo('nivel', 'municipio');
    qMunicipio.equalTo('uf', uf);
    qMunicipio.equalTo('municipio', municipio);

    const qEstado = new Parse.Query('EstatisticasGeograficas');
    qEstado.equalTo('nivel', 'estado');
    qEstado.equalTo('uf', uf);

    const qRegiao = new Parse.Query('EstatisticasGeograficas');
    qRegiao.equalTo('nivel', 'regiao');

    const queryComposta = Parse.Query.or(qMunicipio, qEstado, qRegiao);
    queryComposta.limit(3);
    const resultados = await queryComposta.find();

    const response = { municipio: null, estado: null, regiao: null };

    for (const r of resultados) {
      const nivel = r.get('nivel');
      const dados = {
        nivel: r.get('nivel'),
        total_escolas: r.get('total_escolas') || 0,
        internet: r.get('internet') ?? 0,
        biblioteca: r.get('biblioteca') ?? 0,
        lab_informatica: r.get('lab_informatica') ?? 0,
        quadra_esportes: r.get('quadra_esportes') ?? 0,
        rampas: r.get('rampas') ?? 0,
        banheiro_acessivel: r.get('banheiro_acessivel') ?? 0,
        agua_potavel: r.get('agua_potavel') ?? 0,
      };
      if (nivel === 'municipio') response.municipio = dados;
      else if (nivel === 'estado') response.estado = dados;
      else if (nivel === 'regiao') response.regiao = dados;
    }

    return response;
  } catch (erro) {
    console.error('[escolas.api] Erro ao obter estatisticas:', erro);
    return { municipio: null, estado: null, regiao: null };
  }
}

/**
 * Obtem as top 50 escolas ordenadas por um criterio composto de infraestrutura
 */
export async function obterRanking(uf = null) {
  try {
    const query = new Parse.Query(CLASSE_2025);
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
        laboratorio: obj.get('laboratorio') || 0,
        quadra: obj.get('quadra') || 0,
        rampa_acessibilidade: obj.get('rampa_acessibilidade') || 0,
        banheiro_pne: obj.get('banheiro_pne') || 0,
        agua_potavel: obj.get('agua_potavel') || 0,
        energia_eletrica: obj.get('energia_eletrica') || 0,
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
    obj.get('laboratorio') || 0,
    obj.get('quadra') || 0,
    obj.get('rampa_acessibilidade') || 0,
    obj.get('banheiro_pne') || 0,
    obj.get('agua_potavel') || 0,
    obj.get('energia_eletrica') || 0,
  ];
  const soma = indicadores.reduce((acc, v) => acc + v, 0);
  const nota = (soma / indicadores.length) * 10;
  let badge = null;
  if (nota >= 9) badge = 'ouro';
  else if (nota >= 7.5) badge = 'prata';
  else if (nota >= 6) badge = 'bronze';
  return { nota: Math.round(nota * 10) / 10, badge };
}

/**
 * Atualiza silenciosamente a foto_url de uma escola no Back4App (Cache)
 */
export async function atualizarFotoUrl(idParse, classe, fotoUrl) {
  if (!idParse || !classe || !fotoUrl) return false;
  try {
    const Escola = Parse.Object.extend(classe);
    const query = new Parse.Query(Escola);
    const obj = await query.get(idParse);
    obj.set('foto_url', fotoUrl);
    await obj.save();
    return true;
  } catch (erro) {
    console.error('[escolas.api] Erro ao atualizar foto_url:', erro);
    return false;
  }
}

/**
 * Busca estatisticas agregadas (pre-calculadas) da classe EstatisticasAgregadas.
 * Retorna os dados_2024 e dados_2025 com percentagens e total_escolas.
 *
 * Converte percentagens (0-100) de volta para contagens absolutas nos campos
 * 'internet', 'laboratorio', 'banheiro_pne', 'quadra', 'rampa_acessibilidade',
 * 'agua_potavel', 'energia_eletrica' para compatibilidade com os graficos existentes.
 *
 * @param {string} chave - "Nordeste" (regiao), "PE" (estado) ou "PE-Recife" (municipio)
 * @returns {Promise<{dados2024: Object|null, dados2025: Object|null, chave: string, nivel: string}>}
 */
export async function buscarEstatisticasAgregadas(chave = 'Nordeste') {
  try {
    const query = new Parse.Query('EstatisticasAgregadas');
    query.equalTo('chave', chave);
    query.limit(1);
    const resultado = await query.first();

    if (!resultado) {
      console.warn(`[escolas.api] EstatisticasAgregadas nao encontradas para chave: ${chave}`);
      return null;
    }

    const nivel = resultado.get('nivel') || '';
    const d24 = resultado.get('dados_2024') || {};
    const d25 = resultado.get('dados_2025') || {};

    /** Converte percentagem (0-100) para contagem absoluta */
    const pctParaContagem = (pct, total) => total > 0 ? Math.round((pct / 100) * total) : 0;

    const mapear = (dados) => {
      const total = dados.total_escolas || 0;
      return {
        total,
        internet: pctParaContagem(dados.internet, total),
        laboratorio: pctParaContagem(dados.laboratorio, total),
        banheiro_pne: pctParaContagem(dados.banheiro_pne, total),
        quadra: pctParaContagem(dados.quadra, total),
        rampa_acessibilidade: pctParaContagem(dados.rampa_acessibilidade, total),
        agua_potavel: pctParaContagem(dados.agua_potavel, total),
        energia_eletrica: pctParaContagem(dados.energia_eletrica, total),
        /* Mantem percentagens para uso direto nos graficos */
        pct_internet: dados.internet ?? 0,
        pct_laboratorio: dados.laboratorio ?? 0,
        pct_banheiro_pne: dados.banheiro_pne ?? 0,
        pct_quadra: dados.quadra ?? 0,
        pct_rampa_acessibilidade: dados.rampa_acessibilidade ?? 0,
        pct_agua_potavel: dados.agua_potavel ?? 0,
        pct_energia_eletrica: dados.energia_eletrica ?? 0,
      };
    };

    return {
      chave,
      nivel,
      dados2024: mapear(d24),
      dados2025: mapear(d25),
    };
  } catch (erro) {
    console.error('[escolas.api] Erro ao buscar estatisticas agregadas:', erro);
    return null;
  }
}
