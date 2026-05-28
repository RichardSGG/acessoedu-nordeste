/**
 * src/js/ui/ranking.js
 * Responsabilidade: Ranking de Excelência — pódio visual Top 3, lista 4-50, modal algorítmico
 */

import estado from '../core/estado.js';
import * as EscolasAPI from '../api/escolas.api.js';

Parse.initialize('pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj', 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN');
Parse.serverURL = 'https://parseapi.back4app.com/parse/';

let ufSelecionada = null;

const ESTADOS_NORDESTE = [
  { sigla: '', nome: 'Todos os Estados' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'SE', nome: 'Sergipe' }
];

async function iniciar() {
  configurarDropdownEstado();
  configurarModal();
  await carregarRanking();
}

function configurarDropdownEstado() {
  const inputUf = document.getElementById('filtro-ranking-uf');
  const containerSugestoes = document.getElementById('lista-sugestoes-ranking');
  if (!inputUf || !containerSugestoes) return;

  const renderizarEstados = () => {
    const fragment = document.createDocumentFragment();
    ESTADOS_NORDESTE.forEach((est, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.textContent = est.nome;
      item.style.cssText = `
        width: 100%; text-align: left; padding: 10px 16px;
        background-color: #ffffff; color: #334155;
        font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
        border: none; cursor: pointer; display: block;
        transition: background-color 150ms ease; outline: none;
      `;
      if (index < ESTADOS_NORDESTE.length - 1) {
        item.style.borderBottom = '1px solid #f1f5f9';
      }
      item.addEventListener('mouseenter', () => { item.style.backgroundColor = '#f1f5f9'; });
      item.addEventListener('mouseleave', () => { item.style.backgroundColor = '#ffffff'; });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        inputUf.value = est.nome;
        ufSelecionada = est.sigla || null;
        containerSugestoes.classList.add('hidden');
        carregarRanking();
      });
      fragment.appendChild(item);
    });
    containerSugestoes.innerHTML = '';
    containerSugestoes.appendChild(fragment);
    containerSugestoes.classList.remove('hidden');
  };

  inputUf.addEventListener('click', (e) => {
    e.stopPropagation();
    if (containerSugestoes.classList.contains('hidden')) {
      renderizarEstados();
    } else {
      containerSugestoes.classList.add('hidden');
    }
  });

  document.addEventListener('click', () => {
    containerSugestoes.classList.add('hidden');
  });
}

function configurarModal() {
  const modal = document.getElementById('modal-algoritmo');
  document.getElementById('btn-como-calculado').addEventListener('click', () => {
    modal.classList.add('aberto');
  });
  document.getElementById('fechar-modal').addEventListener('click', () => {
    modal.classList.remove('aberto');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('aberto');
  });
}

async function carregarRanking() {
  const loader = document.getElementById('loader-ranking');
  loader.classList.remove('hidden');

  const uf = ufSelecionada;
  const escolas = await EscolasAPI.obterRanking(uf);

  loader.classList.add('hidden');

  if (escolas.length === 0) {
    document.getElementById('lista-ranking').innerHTML =
      '<p class="text-center text-slate-400 py-8">Nenhuma escola encontrada.</p>';
    return;
  }

  renderizarPodio(escolas.slice(0, 3));
  renderizarLista(escolas.slice(3));
}

function renderizarPodio(top3) {
  const container = document.getElementById('podio');
  if (top3.length === 0) { container.innerHTML = ''; return; }

  /* A ordem visual e: 2 — 1 — 3 */
  const ordem = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];

  const escalas = top3.length >= 3 ? ['scale(1.0)', 'scale(1.1)', 'scale(0.95)'] : ['scale(1.0)'];
  const alturas = top3.length >= 3 ? ['h-36', 'h-44', 'h-28'] : ['h-36'];

  container.innerHTML = ordem.map((escola, i) => {
    const posicao = top3.indexOf(escola) + 1;
    const badgeHtml = _renderizarBadge(escola.badge);
    return `
      <div class="flex flex-col items-center gap-2" style="transform: ${escalas[i] || 'scale(1.0)'}">
        <div class="text-center">
          <span class="font-display font-black text-3xl text-slate-300">${posicao}</span>
          ${badgeHtml}
        </div>
        <div class="${alturas[i] || 'h-36'} w-28 sm:w-36 bg-gradient-to-b ${_corPodio(posicao)} rounded-t-2xl flex flex-col items-center justify-center p-3 text-white shadow-lg">
          <p class="font-display font-black text-2xl">${escola.notaExcelencia}</p>
          <p class="text-[10px] opacity-80">Nota</p>
        </div>
        <p class="font-bold text-xs text-slate-700 text-center max-w-[120px] truncate">${esc(escola.nome)}</p>
        <p class="text-[10px] text-slate-500">${esc(escola.cidade)} - ${esc(escola.uf)}</p>
      </div>`;
  }).join('');
}

function _corPodio(pos) {
  if (pos === 1) return 'from-amber-400 to-orange-500';
  if (pos === 2) return 'from-slate-400 to-slate-500';
  return 'from-orange-400 to-orange-600';
}

function renderizarLista(escolas) {
  const container = document.getElementById('lista-ranking');
  const fragmento = document.createDocumentFragment();

  escolas.forEach((escola, idx) => {
    const posicao = idx + 4;
    const item = document.createElement('div');
    item.className = 'bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-primaria/30 transition-colors cursor-pointer';

    const badgeHtml = _renderizarBadge(escola.badge);
    item.innerHTML = `
      <span class="font-display font-black text-lg text-slate-300 w-10 text-center">${posicao}</span>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-sm text-slate-700 truncate">${esc(escola.nome)}</p>
        <p class="text-xs text-slate-400">${esc(escola.cidade)} - ${esc(escola.uf)}</p>
      </div>
      ${badgeHtml}
      <span class="font-display font-black text-lg text-primaria">${escola.notaExcelencia}</span>`;

    item.addEventListener('click', () => {
      window.location.href = `detalhes.html?id=${escola.id_escola}`;
    });

    fragmento.appendChild(item);
  });

  container.innerHTML = '';
  container.appendChild(fragmento);
}

function _renderizarBadge(badge) {
  if (badge === 'ouro') return '<span class="badge-ouro"><i class="ph-fill ph-trophy"></i> Ouro</span>';
  if (badge === 'prata') return '<span class="badge-prata"><i class="ph-fill ph-medal"></i> Prata</span>';
  if (badge === 'bronze') return '<span class="badge-bronze"><i class="ph-fill ph-medal"></i> Bronze</span>';
  return '';
}

function esc(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texto));
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', iniciar);
