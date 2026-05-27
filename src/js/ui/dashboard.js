/**
 * src/js/ui/dashboard.js
 * Responsabilidade: Dashboard principal — KPIs, filtros, toggle mapa/lista, busca
 */

import estado from '../core/estado.js';
import { debounce } from '../core/utilitarios.js';
import * as EscolasAPI from '../api/escolas.api.js';

/* Inicializa Parse com credenciais */
Parse.initialize('8uIloIhmnqIK0y8P2vghyDGk20EX5wwnbBTxYAhk', 'o4wIFtX6xdbhdYX8PRfD57oOzN8ZkoLrA18Jxb93');
Parse.serverURL = 'https://parseapi.back4app.com';

/* Estado local */
let anoAtual = 2025;
let modoVisualizacao = 'mapa';

async function iniciar() {
  console.log('[DASHBOARD] Inicializando...');

  configurarAuth();
  configurarFiltros();
  configurarToggleVisualizacao();
  configurarToggleAno();
  configurarBusca();

  estado.assinar('mudanca:escolas', renderizarLista);
  estado.assinar('mudanca:filtros', () => EscolasAPI.listar(estado.obter('filtros')));

  await carregarKPIs();
  await EscolasAPI.listar({ ano: anoAtual });
}

function configurarAuth() {
  try {
    const usuario = Parse.User.current();
    if (usuario) {
      estado.definir('usuarioAtual', usuario);
    }
  } catch (_) { /* Silencia */ }
}

/* --- KPIs --- */
async function carregarKPIs() {
  try {
    const agregados = await EscolasAPI.obterAgregados();
    if (!agregados) return;

    const { dados2024, dados2025 } = agregados;

    document.getElementById('kpi-total').textContent = dados2025.total.toLocaleString();
    document.getElementById('kpi-internet').textContent = dados2025.internet.toLocaleString();
    document.getElementById('kpi-banheiro').textContent = dados2025.banheiro_acessivel.toLocaleString();
    document.getElementById('kpi-agua').textContent = dados2025.agua_potavel.toLocaleString();

    _renderizarDelta('delta-total', dados2024.total, dados2025.total);
    _renderizarDelta('delta-internet', dados2024.internet, dados2025.internet);
    _renderizarDelta('delta-banheiro', dados2024.banheiro_acessivel, dados2025.banheiro_acessivel);
    _renderizarDelta('delta-agua', dados2024.agua_potavel, dados2025.agua_potavel);
  } catch (erro) {
    console.error('[DASHBOARD] Erro ao carregar KPIs:', erro);
  }
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

/* --- Filtros --- */
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

  const escolas = estado.obter('escolas');
  const cidades = [...new Set(escolas.filter(e => e.uf === uf).map(e => e.cidade).filter(Boolean))].sort();

  selMunicipio.innerHTML = '<option value="">Todos os Municipios</option>' +
    cidades.map(c => `<option value="${c}">${c}</option>`).join('');
  selMunicipio.disabled = false;
}

/* --- Toggle Mapa / Lista / Ano --- */
function configurarToggleVisualizacao() {
  const btnMapa = document.getElementById('toggle-mapa');
  const btnLista = document.getElementById('toggle-lista');
  const containerMapa = document.getElementById('container-mapa');
  const containerLista = document.getElementById('container-lista');

  if (!btnMapa || !btnLista) return;

  btnMapa.addEventListener('click', async () => {
    modoVisualizacao = 'mapa';
    btnMapa.classList.replace('bg-transparent', 'bg-white');
    btnMapa.classList.replace('text-slate-500', 'text-primaria');
    btnLista.classList.replace('bg-white', 'bg-transparent');
    btnLista.classList.replace('text-primaria', 'text-slate-500');
    containerMapa.classList.remove('hidden');
    containerLista.classList.add('hidden');
    try {
      const mapaMod = await import('../ui/mapa.ui.js');
      const mapa = mapaMod.obterInstanciaMapa();
      if (mapa) mapa.invalidateSize();
    } catch (_) { /* Mapa pode nao estar inicializado ainda */ }
  });

  btnLista.addEventListener('click', () => {
    modoVisualizacao = 'lista';
    btnLista.classList.replace('bg-transparent', 'bg-white');
    btnLista.classList.replace('text-slate-500', 'text-primaria');
    btnMapa.classList.replace('bg-white', 'bg-transparent');
    btnMapa.classList.replace('text-primaria', 'text-slate-500');
    containerLista.classList.remove('hidden');
    containerMapa.classList.add('hidden');
  });
}

function configurarToggleAno() {
  const btnAno = document.getElementById('toggle-ano');
  const rotuloAno = document.getElementById('rotulo-ano');
  if (!btnAno) return;

  btnAno.addEventListener('click', () => {
    anoAtual = anoAtual === 2024 ? 2025 : 2024;
    rotuloAno.textContent = String(anoAtual);
    const filtros = estado.obter('filtros');
    estado.definir('filtros', { ...filtros, ano: anoAtual });
  });
}

/* --- Busca --- */
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
    resultados.forEach(e => {
      escolaMap[e.id_escola] = e;
    });
    estado.definir('escolas', Object.values(escolaMap));
  }, 400);

  inputBusca.addEventListener('input', (e) => buscarComDebounce(e.target.value));
}

/* --- Renderizacao da Lista --- */
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
        <span class="text-xs text-slate-400">${_esc(escola.dependencia)}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
        <div class="text-center">
          <i class="ph-fill ${escola.internet ? 'ph-wifi-high text-secundaria' : 'ph-wifi-x text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Internet</p>
        </div>
        <div class="text-center">
          <i class="ph-fill ${escola.banheiro_acessivel ? 'ph-wheelchair text-mobilidade' : 'ph-wheelchair text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Acessivel</p>
        </div>
        <div class="text-center">
          <i class="ph-fill ${escola.agua_potavel ? 'ph-drop text-primaria' : 'ph-drop text-slate-300'} text-lg"></i>
          <p class="text-[10px] text-slate-400">Agua</p>
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

document.addEventListener('DOMContentLoaded', iniciar);
