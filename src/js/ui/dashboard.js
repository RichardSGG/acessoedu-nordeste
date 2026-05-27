/**
 * src/js/ui/dashboard.js
 * Responsabilidade: KPIs, graficos, lista, filtros, busca CEP/GPS
 * Fonte de dados: EstatisticasAgregadas (Back4App)
 */

import estado from '../core/estado.js';
import { debounce } from '../core/utilitarios.js';
import * as EscolasAPI from '../api/escolas.api.js';

/* Inicializa Parse */
Parse.initialize('pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj', 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN');
Parse.serverURL = 'https://parseapi.back4app.com/parse/';

/* ------------------------------------------------------------------ */
/* DADOS FALLBACK — Nordeste consolidado (evita tela zerada)           */
/* ------------------------------------------------------------------ */
const DADOS_NORDESTE_FALLBACK = {
  chave: 'Nordeste',
  nivel: 'regiao',
  dados2024: {
    total: 74195,
    internet: 55942, laboratorio: 14913, banheiro_pne: 33536,
    quadra: 26413, rampa_acessibilidade: 30271, agua_potavel: 65364, energia_eletrica: 73082,
    pct_internet: 75.4, pct_laboratorio: 20.1, pct_banheiro_pne: 45.2,
    pct_quadra: 35.6, pct_rampa_acessibilidade: 40.8, pct_agua_potavel: 88.1, pct_energia_eletrica: 98.5,
  },
  dados2025: {
    total: 74335,
    internet: 61028, laboratorio: 16725, banheiro_pne: 37464,
    quadra: 28247, rampa_acessibilidade: 35829, agua_potavel: 67123, energia_eletrica: 73591,
    pct_internet: 82.1, pct_laboratorio: 22.5, pct_banheiro_pne: 50.4,
    pct_quadra: 38.0, pct_rampa_acessibilidade: 48.2, pct_agua_potavel: 90.3, pct_energia_eletrica: 99.0,
  },
};

const FALLBACK = DADOS_NORDESTE_FALLBACK;

/* Estado local */
let anoAtual = 2025;
let chaveAtual = 'Nordeste';

/* Instancias de graficos (destroy-before-create) */
let graficoBarras = null;
let graficoRoscaBanheiro = null;
let graficoRoscaInternet = null;

/* Cache do ultimo agregados carregado (evita re-fetch no toggle de ano) */
let ultimoAgregados = null;

/* ------------------------------------------------------------------ */
/* INICIALIZACAO                                                        */
/* ------------------------------------------------------------------ */
async function iniciar() {
  console.log('[DASHBOARD] Inicializando...');

  /* 1. Renderizar IMEDIATAMENTE com fallback — NUNCA buscar API na carga inicial */
  _aplicarDados(FALLBACK);

  configurarAuth();
  configurarFiltros();
  configurarToggleAno();
  configurarBusca();
  configurarBotaoCep();

  estado.assinar('mudanca:escolas', renderizarLista);
  estado.assinar('mudanca:filtros', async (filtros) => {
    await EscolasAPI.listar(filtros);
    /* API so e chamada na mudanca de filtros */
    await atualizarEstatisticas();
  });

  /* 2. Carregar lista inicial de escolas (sem tocar nos KPIs/graficos) */
  await EscolasAPI.listar({ ano: anoAtual });
}

/* ------------------------------------------------------------------ */
/* RENDERIZACAO UNIFICADA (fallback OU API usam o mesmo caminho)       */
/* ------------------------------------------------------------------ */
function _aplicarDados(agregados) {
  if (!agregados) return;
  ultimoAgregados = agregados;
  const { dados2024, dados2025 } = agregados;
  const dadosAno = anoAtual === 2024 ? dados2024 : dados2025;

  /* KPIs — usam o ano selecionado no toggle */
  const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = (val ?? 0).toLocaleString(); };
  setKPI('kpi-total', dadosAno.total);
  setKPI('kpi-internet', dadosAno.internet);
  setKPI('kpi-banheiro', dadosAno.banheiro_pne);
  setKPI('kpi-agua', dadosAno.agua_potavel);
  _renderizarDelta('delta-total', dados2024.total, dados2025.total);
  _renderizarDelta('delta-internet', dados2024.internet, dados2025.internet);
  _renderizarDelta('delta-banheiro', dados2024.banheiro_pne, dados2025.banheiro_pne);
  _renderizarDelta('delta-agua', dados2024.agua_potavel, dados2025.agua_potavel);

  const elContexto = document.getElementById('contexto-estatisticas');
  if (elContexto) elContexto.textContent = agregados.nivel === 'regiao' ? 'Nordeste' : (agregados.chave || 'Nordeste');

  /* Graficos */
  renderizarBarras(dados2024, dados2025);
  renderizarRoscaBanheiro(dados2024, dados2025);
  renderizarRoscaInternet(dados2024, dados2025);

  /* Esconde loader se existir */
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('hidden');
}

/* ------------------------------------------------------------------ */
/* KPIs (API → sobrescreve fallback)                                    */
/* ------------------------------------------------------------------ */
async function carregarKPIs() {
  try {
    const agregados = await EscolasAPI.buscarEstatisticasAgregadas(chaveAtual);
    if (!agregados) return;
    _aplicarDados(agregados);
  } catch (erro) {
    console.error('[DASHBOARD] Erro ao carregar KPIs:', erro);
  }
}

/* ------------------------------------------------------------------ */
/* GRAFICOS (API → sobrescreve fallback)                                */
/* ------------------------------------------------------------------ */
async function carregarGraficos() {
  try {
    const agregados = await EscolasAPI.buscarEstatisticasAgregadas(chaveAtual);
    if (!agregados) return;
    _aplicarDados(agregados);
  } catch (erro) {
    console.error('[DASHBOARD] Erro ao carregar gráficos:', erro);
  }
}

/* ------------------------------------------------------------------ */
/* FILTROS (UF / Municipio → EstatisticasAgregadas)                     */
/* ------------------------------------------------------------------ */
function _obterChave() {
  const filtros = estado.obter('filtros');
  const uf = filtros?.uf || '';
  const municipio = filtros?.municipio || '';
  if (uf && municipio) return `${uf}-${municipio}`;
  if (uf) return uf;
  return 'Nordeste';
}

async function atualizarEstatisticas() {
  const novaChave = _obterChave();
  if (novaChave === chaveAtual) return;
  chaveAtual = novaChave;
  await carregarKPIs();
}

function configurarFiltros() {
  const selEstado = document.getElementById('filtro-estado');
  const selMunicipio = document.getElementById('filtro-municipio');

  selEstado.addEventListener('change', () => {
    const uf = selEstado.value;
    estado.definir('filtros', { ...estado.obter('filtros'), uf, municipio: null, ano: anoAtual });
    if (uf) {
      _carregarMunicipios(uf);
    } else {
      selMunicipio.innerHTML = '<option value="">Selecione o Estado primeiro</option>';
      selMunicipio.disabled = true;
    }
  });

  selMunicipio.addEventListener('change', () => {
    const filtros = estado.obter('filtros');
    estado.definir('filtros', { ...filtros, municipio: selMunicipio.value || null });
  });
}

async function _carregarMunicipios(uf) {
  const selMunicipio = document.getElementById('filtro-municipio');
  selMunicipio.disabled = true;
  selMunicipio.innerHTML = '<option value="">Carregando...</option>';

  try {
    const query = new Parse.Query('Escolas2025');
    query.equalTo('uf', uf);
    query.limit(2000);
    query.exists('cidade');
    query.select('cidade');
    const resultados = await query.find();
    const cidades = [...new Set(resultados.map(r => r.get('cidade')).filter(Boolean))].sort();

    selMunicipio.innerHTML = '<option value="">Todos os Municípios</option>' +
      cidades.map(c => `<option value="${c}">${c}</option>`).join('');
  } catch (erro) {
    console.error('[DASHBOARD] Erro ao carregar municípios:', erro);
    selMunicipio.innerHTML = '<option value="">Erro ao carregar</option>';
  }
  selMunicipio.disabled = false;
}

/* ------------------------------------------------------------------ */
/* TOGGLE ANO                                                          */
/* ------------------------------------------------------------------ */
function configurarToggleAno() {
  const btnAno = document.getElementById('toggle-ano');
  const rotuloAno = document.getElementById('rotulo-ano');
  if (!btnAno) return;

  btnAno.addEventListener('click', () => {
    anoAtual = anoAtual === 2024 ? 2025 : 2024;
    rotuloAno.textContent = String(anoAtual);
    const filtros = estado.obter('filtros');
    estado.definir('filtros', { ...filtros, ano: anoAtual });
    /* Re-renderiza KPIs do cache — nunca busca API no toggle */
    if (ultimoAgregados) {
      _aplicarDados(ultimoAgregados);
    }
  });
}

/* ------------------------------------------------------------------ */
/* BUSCA POR NOME                                                      */
/* ------------------------------------------------------------------ */
function configurarBusca() {
  const inputBusca = document.getElementById('input-busca');
  if (!inputBusca) return;

  const buscarComDebounce = debounce(async (termo) => {
    if (!termo || termo.length < 2) {
      await EscolasAPI.listar(estado.obter('filtros'));
      return;
    }
    const resultados = await EscolasAPI.buscarPorNome(termo);
    const escolaMap = {};
    resultados.forEach(e => { escolaMap[e.id_escola] = e; });
    estado.definir('escolas', Object.values(escolaMap));
  }, 400);

  inputBusca.addEventListener('input', (e) => buscarComDebounce(e.target.value));
}

/* ------------------------------------------------------------------ */
/* BOTAO CEP (Perto de Mim — BrasilAPI → GeoPoint dentro de X km)     */
/* ------------------------------------------------------------------ */
function configurarBotaoCep() {
  const btn = document.getElementById('btn-perto-de-mim');
  const modal = document.getElementById('modalPertoDeMim');
  const inputCep = document.getElementById('inputModalCep');
  const inputRaio = document.getElementById('inputModalRaio');
  const btnBuscar = document.getElementById('btnBuscarModal');
  const btnFechar = document.getElementById('btnFecharModal');
  const modalErro = document.getElementById('modal-erro');
  const statusGeo = document.getElementById('status-geo');
  if (!btn || !modal) return;

  function abrirModal() {
    inputCep.value = '';
    inputRaio.value = '';
    modalErro.classList.add('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    inputCep.focus();
  }

  function fecharModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  btn.addEventListener('click', abrirModal);
  btnFechar.addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  btnBuscar.addEventListener('click', async () => {
    const cepLimpo = (inputCep?.value || '').trim().replace(/\D/g, '');
    if (!/^\d{8}$/.test(cepLimpo)) {
      modalErro.textContent = 'Informe um CEP válido com 8 dígitos.';
      modalErro.classList.remove('hidden');
      return;
    }

    const raio = Number(inputRaio?.value) || 10;
    if (raio < 1 || raio > 100) {
      modalErro.textContent = 'Raio inválido. Informe um valor entre 1 e 100 km.';
      modalErro.classList.remove('hidden');
      return;
    }

    modalErro.classList.add('hidden');
    fecharModal();
    btn.disabled = true;
    if (statusGeo) { statusGeo.classList.remove('hidden'); statusGeo.textContent = 'Geocodificando CEP e buscando escolas...'; statusGeo.className = 'text-xs text-slate-500 mt-1'; }

    let usouRaio = false;

    /* Plano A: BrasilAPI → GeoPoint dentro de X km */
    try {
      const respCep = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepLimpo}`);
      if (respCep.ok) {
        const dataCep = await respCep.json();
        const hasCoords = dataCep.location
          && dataCep.location.coordinates
          && dataCep.location.coordinates.latitude
          && dataCep.location.coordinates.longitude;

        if (hasCoords) {
          const lat = dataCep.location.coordinates.latitude;
          const lng = dataCep.location.coordinates.longitude;
          const geoPoint = new Parse.GeoPoint(lat, lng);
          const query = new Parse.Query('Escolas2025');
          query.withinKilometers('posicao_geografica', geoPoint, raio);
          query.limit(200);
          const resultados = await query.find();

          if (resultados.length > 0) {
            const escolas = resultados.map(r => ({ ...r.toJSON(), id_parse: r.id, classe: 'Escolas2025' }));
            estado.definir('escolas', escolas);
            if (statusGeo) { statusGeo.textContent = `Escolas encontradas em um raio de ${raio}km.`; statusGeo.className = 'text-xs text-secundaria mt-1'; }
          } else {
            if (statusGeo) { statusGeo.textContent = `Nenhuma escola encontrada em ${raio}km do CEP ${cepLimpo}.`; statusGeo.className = 'text-xs text-amber-600 mt-1'; }
          }
          usouRaio = true;
        }
      }
    } catch (erro) {
      console.warn('[DASHBOARD] BrasilAPI indisponivel, usando fallback por CEP exato:', erro);
    }

    /* Plano B: Fallback — busca por CEP exato na classe Escolas2025 */
    if (!usouRaio) {
      try {
        const query = new Parse.Query('Escolas2025');
        query.equalTo('cep', cepLimpo);
        query.limit(200);
        const resultados = await query.find();

        if (resultados.length > 0) {
          const escolas = resultados.map(r => ({ ...r.toJSON(), id_parse: r.id, classe: 'Escolas2025' }));
          estado.definir('escolas', escolas);
          if (statusGeo) { statusGeo.textContent = 'Coordenadas indisponíveis. Exibindo escolas cadastradas exatamente neste CEP.'; statusGeo.className = 'text-xs text-secundaria mt-1'; }
        } else {
          if (statusGeo) { statusGeo.textContent = `Nenhuma escola encontrada para o CEP ${cepLimpo}.`; statusGeo.className = 'text-xs text-amber-600 mt-1'; }
        }
      } catch (erro) {
        console.error('[DASHBOARD] Erro na busca por CEP exato:', erro);
        if (statusGeo) { statusGeo.textContent = 'Erro de rede ao buscar escolas.'; statusGeo.className = 'text-xs text-red-500 mt-1'; }
      }
    }

    btn.disabled = false;
  });
}

/* ------------------------------------------------------------------ */
/* CONFIGURACAO DE AUTENTICACAO                                         */
/* ------------------------------------------------------------------ */
function configurarAuth() {
  try {
    const usuario = Parse.User.current();
    if (usuario) estado.definir('usuarioAtual', usuario);
  } catch (_) { /* Silencia */ }
}

/* ------------------------------------------------------------------ */
/* RENDERIZACAO DA LISTA DE ESCOLAS                                     */
/* ------------------------------------------------------------------ */
function renderizarLista(escolas) {
  const container = document.getElementById('lista-resultados');
  const vazia = document.getElementById('lista-vazia');
  if (!container || !vazia) return;

  if (!escolas || escolas.length === 0) {
    container.innerHTML = '';
    vazia.classList.remove('hidden');
    return;
  }

  vazia.classList.add('hidden');
  const fragmento = document.createDocumentFragment();

  escolas.forEach((escola) => {
    const card = document.createElement('div');
    card.className = 'card cursor-pointer hover:border-primaria/30';
    const badgeHtml = _badgeDependencia(escola.dependencia);

    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <h4 class="font-display font-bold text-sm text-slate-800 line-clamp-2">${_esc(escola.nome)}</h4>
      </div>
      <div class="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <i class="ph-fill ph-map-pin text-primaria text-[10px]"></i>
        <span>${_esc(escola.cidade)} - ${_esc(escola.uf)}</span>
      </div>
      <div class="flex items-center gap-2">
        ${badgeHtml}
      </div>
      <p class="text-xs text-slate-400 mt-1"><i class="ph ph-phone"></i> ${_esc(escola.telefone || 'Não informado')}</p>
      <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
        <div class="text-center">
          <i class="ph-fill ${escola.internet ? 'ph-wifi-high text-secundaria' : 'ph-wifi-x text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Internet</p>
        </div>
        <div class="text-center">
          <i class="ph-fill ${escola.banheiro_pne ? 'ph-wheelchair text-mobilidade' : 'ph-wheelchair text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Acessível</p>
        </div>
        <div class="text-center">
          <i class="ph-fill ${escola.agua_potavel ? 'ph-drop text-primaria' : 'ph-drop text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Água</p>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      window.location.href = `detalhes.html?id=${escola.id_escola}`;
    });

    fragmento.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragmento);
}

function _badgeDependencia(dep) {
  if (!dep) return '';
  const mapa = {
    'Federal': 'bg-blue-100 text-blue-700',
    'Estadual': 'bg-green-100 text-green-700',
    'Municipal': 'bg-orange-100 text-orange-700',
    'Privada': 'bg-purple-100 text-purple-700',
  };
  const cor = mapa[dep] || 'bg-slate-100 text-slate-600';
  return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cor}">${_esc(dep)}</span>`;
}

function _esc(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texto));
  return div.innerHTML;
}

function _renderizarDelta(elId, valAnt, valAtu) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (valAnt === 0) { el.innerHTML = '<i class="ph-bold ph-equals"></i> Novo'; return; }
  const pct = ((valAtu - valAnt) / valAnt * 100);
  const absoluto = Math.abs(pct).toFixed(1);
  if (pct > 0) {
    el.className = 'text-xs font-bold text-secundaria bg-green-50 px-2 py-1 rounded-full flex items-center gap-1';
    el.innerHTML = `<i class="ph-bold ph-trend-up"></i> +${absoluto}%`;
  } else if (pct < 0) {
    el.className = 'text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1';
    el.innerHTML = `<i class="ph-bold ph-trend-down"></i> ${absoluto}%`;
  } else {
    el.className = 'text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-full flex items-center gap-1';
    el.innerHTML = '<i class="ph-bold ph-equals"></i> 0%';
  }
}

/* ------------------------------------------------------------------ */
/* GRAFICOS CHART.JS                                                    */
/* ------------------------------------------------------------------ */
function renderizarBarras(d24, d25) {
  if (graficoBarras) { graficoBarras.destroy(); graficoBarras = null; }
  const canvas = document.getElementById('grafico-barras');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const p24 = (k) => d24[k] ?? 0;
  const p25 = (k) => d25[k] ?? 0;

  graficoBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Internet', 'Laboratório', 'Banheiro PNE', 'Quadra', 'Acessibilidade', 'Água', 'Energia'],
      datasets: [
        {
          label: '2024',
          data: [p24('pct_internet'), p24('pct_laboratorio'), p24('pct_banheiro_pne'), p24('pct_quadra'), p24('pct_rampa_acessibilidade'), p24('pct_agua_potavel'), p24('pct_energia_eletrica')],
          backgroundColor: 'rgba(26, 86, 145, 0.7)', borderColor: '#1A5691', borderWidth: 1, borderRadius: 8,
        },
        {
          label: '2025',
          data: [p25('pct_internet'), p25('pct_laboratorio'), p25('pct_banheiro_pne'), p25('pct_quadra'), p25('pct_rampa_acessibilidade'), p25('pct_agua_potavel'), p25('pct_energia_eletrica')],
          backgroundColor: 'rgba(61, 163, 90, 0.7)', borderColor: '#3DA35A', borderWidth: 1, borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Inter', size: 13 }, usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw + '%' } },
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%', font: { family: 'Inter' } } },
        x: { ticks: { font: { family: 'Inter', size: 11, weight: 'bold' } } },
      },
    },
  });
}

function renderizarRoscaBanheiro(d24, d25) {
  if (graficoRoscaBanheiro) { graficoRoscaBanheiro.destroy(); graficoRoscaBanheiro = null; }
  const canvas = document.getElementById('grafico-rosca');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const com = d25.banheiro_pne || 0;
  const sem = (d25.total || 0) - com;

  graficoRoscaBanheiro = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Com Banheiro Acessível', 'Sem Banheiro Acessível'],
      datasets: [{ data: [com, sem], backgroundColor: ['#805AD5', '#E2E8F0'], borderColor: '#FFFFFF', borderWidth: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true, padding: 16 } },
        tooltip: { callbacks: { label: (ctx) => { const t = ctx.dataset.data.reduce((a, b) => a + b, 0); const p = t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0; return ctx.label + ': ' + ctx.raw.toLocaleString() + ' (' + p + '%)'; } } },
      },
    },
  });
}

function renderizarRoscaInternet(d24, d25) {
  if (graficoRoscaInternet) { graficoRoscaInternet.destroy(); graficoRoscaInternet = null; }
  const canvas = document.getElementById('grafico-rosca-internet');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const com = d25.internet || 0;
  const sem = (d25.total || 0) - com;

  graficoRoscaInternet = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Com Internet', 'Sem Internet'],
      datasets: [{ data: [com, sem], backgroundColor: ['#3DA35A', '#E2E8F0'], borderColor: '#FFFFFF', borderWidth: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true, padding: 16 } },
        tooltip: { callbacks: { label: (ctx) => { const t = ctx.dataset.data.reduce((a, b) => a + b, 0); const p = t > 0 ? ((ctx.raw / t) * 100).toFixed(1) : 0; return ctx.label + ': ' + ctx.raw.toLocaleString() + ' (' + p + '%)'; } } },
      },
    },
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
