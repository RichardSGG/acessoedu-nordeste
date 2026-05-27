/**
 * src/js/ui/escola.js
 * Responsabilidade: Perfil da escola — cascata de imagens, checklist 2024vs2025,
 *                   grafico radar, avaliacoes com Haversine, feed de feedbacks
 */

import estado from '../core/estado.js';
import { calcularDistanciaKm, debounce } from '../core/utilitarios.js';
import * as EscolasAPI from '../api/escolas.api.js';
import * as FotosAPI from '../api/fotos.api.js';
import * as MapillaryAPI from '../api/mapillary.api.js';
import * as FeedbackAPI from '../api/feedback.api.js';

Parse.initialize('8uIloIhmnqIK0y8P2vghyDGk20EX5wwnbBTxYAhk', 'o4wIFtX6xdbhdYX8PRfD57oOzN8ZkoLrA18Jxb93');
Parse.serverURL = 'https://parseapi.back4app.com';

/* Estado local */
let dadosEscola = null;
let dadosComparativo = null;
let notaSelecionada = 0;
let verificadoLocal = false;
let coordsEnvio = null;

const INDICADORES = [
  { chave: 'internet', rotulo: 'Internet', icone: 'ph-wifi-high' },
  { chave: 'biblioteca', rotulo: 'Biblioteca', icone: 'ph-books' },
  { chave: 'lab_informatica', rotulo: 'Lab. Informatica', icone: 'ph-desktop' },
  { chave: 'banheiro_acessivel', rotulo: 'Banheiro Acessivel', icone: 'ph-wheelchair' },
  { chave: 'quadra_esportes', rotulo: 'Quadra Esportes', icone: 'ph-soccer-ball' },
  { chave: 'rampas', rotulo: 'Rampas', icone: 'ph-stairs' },
  { chave: 'agua_potavel', rotulo: 'Agua Potavel', icone: 'ph-drop' },
];

async function iniciar() {
  const idEscola = obterIdUrl();
  if (!idEscola) {
    mostrarErro();
    return;
  }

  try {
    /* Carrega dados 2025 */
    dadosEscola = await EscolasAPI.buscarPorIdEscola(idEscola);
    if (!dadosEscola) { mostrarErro(); return; }

    /* Carrega comparativo 2024 vs 2025 */
    dadosComparativo = await EscolasAPI.buscarComparativo(idEscola);

    /* Renderiza */
    esconderLoader();
    document.getElementById('secao-escola').classList.remove('hidden');

    renderizarCabecalho();
    await carregarImagens();
    renderizarContato();
    renderizarChecklist();
    configurarRadar();
    configurarAvaliacao();
    await carregarFeedbacks();
  } catch (erro) {
    console.error('[ESCOLA] Erro:', erro);
    mostrarErro();
  }
}

/* --- URL --- */
function obterIdUrl() {
  return new URLSearchParams(window.location.search).get('id');
}

function mostrarErro() {
  document.getElementById('loader-escola').classList.add('hidden');
  document.getElementById('erro-escola').classList.remove('hidden');
}

function esconderLoader() {
  document.getElementById('loader-escola').classList.add('hidden');
}

/* --- Cabecalho --- */
function renderizarCabecalho() {
  document.getElementById('escola-nome').textContent = dadosEscola.nome || 'Sem nome';
  document.getElementById('escola-cidade').innerHTML =
    `<i class="ph-fill ph-map-pin text-primaria"></i> ${esc(dadosEscola.cidade)} - ${esc(dadosEscola.uf)}`;
  document.getElementById('escola-uf').textContent = dadosEscola.uf || '--';
  document.getElementById('escola-id-inep').textContent = `INEP: ${dadosEscola.id_escola}`;

  const depEl = document.getElementById('escola-dependencia');
  const dep = dadosEscola.dependencia;
  depEl.textContent = dep || '--';
  const mapaCores = {
    'Federal': 'bg-blue-100 text-blue-700',
    'Estadual': 'bg-green-100 text-green-700',
    'Municipal': 'bg-orange-100 text-orange-700',
    'Privada': 'bg-purple-100 text-purple-700',
  };
  depEl.className = `px-2 py-0.5 rounded-full font-bold text-xs ${mapaCores[dep] || 'bg-slate-100 text-slate-600'}`;
}

/* --- Contato e Localizacao --- */
function renderizarContato() {
  const elEndereco = document.getElementById('contato-endereco');
  const elMapa = document.getElementById('contato-mapa');
  const elTelefone = document.getElementById('contato-telefone');
  const elEmail = document.getElementById('contato-email');
  const elSemDados = document.getElementById('contato-sem-dados');

  const endereco = dadosEscola.endereco;
  const telefone = dadosEscola.telefone;
  const email = dadosEscola.email;
  const lat = dadosEscola.latitude;
  const lng = dadosEscola.longitude;

  let temDados = false;

  if (endereco) {
    temDados = true;
    elEndereco.classList.remove('hidden');
    document.getElementById('txt-endereco').textContent = endereco;
  } else {
    elEndereco.classList.add('hidden');
  }

  if (lat && lng && lat !== 0 && lng !== 0) {
    temDados = true;
    elMapa.classList.remove('hidden');
    elMapa.href = `http://maps.google.com/?q=${lat},${lng}`;
  } else {
    elMapa.classList.add('hidden');
  }

  if (telefone) {
    temDados = true;
    elTelefone.classList.remove('hidden');
    const linkTel = document.getElementById('link-telefone');
    linkTel.href = `tel:${telefone.replace(/[^\d+]/g, '')}`;
    linkTel.textContent = telefone;
  } else {
    elTelefone.classList.add('hidden');
  }

  if (email) {
    temDados = true;
    elEmail.classList.remove('hidden');
    const linkEmail = document.getElementById('link-email');
    linkEmail.href = `mailto:${email}`;
    linkEmail.textContent = email;
  } else {
    elEmail.classList.add('hidden');
  }

  if (!temDados) {
    elSemDados.classList.remove('hidden');
    document.getElementById('secao-contato').classList.add('hidden');
  }
}

/* --- Cascata de Imagens --- */
async function carregarImagens() {
  const container = document.getElementById('carrossel-fotos');
  const placeholder = document.getElementById('placeholder-foto');
  const btnAnterior = document.getElementById('btn-foto-anterior');
  const btnProximo = document.getElementById('btn-foto-proximo');

  /* Etapa 1: Back4App */
  const fotosBack4App = await FotosAPI.listarAprovadas(dadosEscola.id_escola);
  if (fotosBack4App.length > 0) {
    renderizarFotos(fotosBack4App.map(f => ({
      url: f.get('arquivo')?.url(),
      fonte: 'Comunidade AcessoEdu',
    })));
    return;
  }

  /* Etapa 2: Mapillary */
  const fotosMapillary = await MapillaryAPI.buscarPorCoordenadas(dadosEscola.latitude, dadosEscola.longitude);
  if (fotosMapillary.length > 0) {
    renderizarFotos(fotosMapillary);
    return;
  }

  /* Etapa 3: Placeholder */
  container.innerHTML = '';
  btnAnterior.classList.add('hidden');
  btnProximo.classList.add('hidden');
  placeholder.classList.remove('hidden');

  document.getElementById('btn-enviar-primeira-foto').addEventListener('click', () => {
    const usuario = estado.obter('usuarioAtual');
    if (!usuario) {
      window.location.href = 'config.html';
      return;
    }
    dispararUploadFoto();
  });
}

function renderizarFotos(fotos) {
  const container = document.getElementById('carrossel-fotos');
  const btnAnterior = document.getElementById('btn-foto-anterior');
  const btnProximo = document.getElementById('btn-foto-proximo');
  const fragmento = document.createDocumentFragment();

  fotos.forEach((foto, idx) => {
    const slide = document.createElement('div');
    slide.className = 'flex-shrink-0 w-full sm:w-96 snap-center';
    slide.innerHTML = `
      <div class="relative rounded-xl overflow-hidden bg-slate-100 aspect-[4/3]">
        <img src="${esc(foto.url)}" alt="Foto da escola" class="w-full h-full object-cover" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center\\'><i class=\\'ph-fill ph-image text-4xl text-slate-300\\'></i></div>'">
        ${foto.fonte ? `<span class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">${esc(foto.fonte)}</span>` : ''}
      </div>`;
    fragmento.appendChild(slide);
  });

  container.innerHTML = '';
  container.appendChild(fragmento);

  if (fotos.length > 1) {
    btnAnterior.classList.remove('hidden');
    btnProximo.classList.remove('hidden');
    let idxAtual = 0;
    btnAnterior.onclick = () => { idxAtual = Math.max(0, idxAtual - 1); container.scrollTo({ left: idxAtual * container.offsetWidth, behavior: 'smooth' }); };
    btnProximo.onclick = () => { idxAtual = Math.min(fotos.length - 1, idxAtual + 1); container.scrollTo({ left: idxAtual * container.offsetWidth, behavior: 'smooth' }); };
  }
}

function dispararUploadFoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await FotosAPI.enviarFoto(dadosEscola.id_escola, file);
      alert('Foto enviada para moderacao. Obrigado pela contribuicao!');
    } catch (erro) {
      alert('Erro ao enviar foto: ' + erro.message);
    }
  };
  input.click();
}

/* --- Checklist Comparativo --- */
function renderizarChecklist() {
  const tbody = document.getElementById('checklist-body');
  const semDados = document.getElementById('checklist-sem-dados');

  if (!dadosComparativo || (!dadosComparativo.dados2024 && !dadosComparativo.dados2025)) {
    semDados.classList.remove('hidden');
    return;
  }

  const d24 = dadosComparativo.dados2024 || {};
  const d25 = dadosComparativo.dados2025 || {};
  const fragmento = document.createDocumentFragment();

  INDICADORES.forEach(ind => {
    const v24 = d24[ind.chave];
    const v25 = d25[ind.chave];
    let evolucao = '--';
    let corEvolucao = 'text-slate-400';

    if (v24 !== undefined && v24 !== null && v25 !== undefined && v25 !== null) {
      if (v25 > v24) { evolucao = 'Melhorou'; corEvolucao = 'text-secundaria'; }
      else if (v25 < v24) { evolucao = 'Piorou'; corEvolucao = 'text-red-500'; }
      else { evolucao = 'Estavel'; corEvolucao = 'text-slate-400'; }
    }

    const icone2024 = _iconeIndicador(v24);
    const icone2025 = _iconeIndicador(v25);

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-3 px-4 font-medium text-slate-700 flex items-center gap-2">
        <i class="ph-fill ${ind.icone} text-slate-500"></i> ${ind.rotulo}
      </td>
      <td class="text-center py-3 px-4">${icone2024}</td>
      <td class="text-center py-3 px-4">${icone2025}</td>
      <td class="text-center py-3 px-4">
        <span class="text-xs font-bold ${corEvolucao}">${evolucao}</span>
      </td>`;
    fragmento.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragmento);
}

function _iconeIndicador(valor) {
  if (valor === 1) {
    return '<i class="ph-fill ph-check-circle text-secundaria text-lg" title="Possui"></i>';
  }
  if (valor === 0) {
    return '<i class="ph-fill ph-x-circle text-red-400 text-lg" title="Nao possui"></i>';
  }
  return '<span class="inline-flex items-center gap-1 text-slate-400 text-xs"><i class="ph-fill ph-minus-circle text-slate-300 text-lg"></i> Sem Informacao</span>';
}

/* --- Grafico Radar (Lazy Loading Chart.js) --- */
function configurarRadar() {
  const container = document.getElementById('container-radar');
  if (!container) return;

  const observador = new IntersectionObserver(async (entradas) => {
    if (!entradas[0].isIntersecting) return;
    observador.disconnect();

    try {
      await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
      await renderizarRadar();
    } catch (erro) {
      console.error('[ESCOLA] Erro ao carregar Chart.js:', erro);
    }
  }, { threshold: 0.1 });

  observador.observe(container);
}

async function renderizarRadar() {
  const ctx = document.getElementById('grafico-radar')?.getContext('2d');
  if (!ctx || !dadosEscola) return;

  const media = await EscolasAPI.obterMediaMunicipio(dadosEscola.cidade);

  const dadosEscolaArr = INDICADORES.map(ind => dadosEscola[ind.chave] ? 100 : 0);
  const dadosMedia = media ? INDICADORES.map(ind => (media[ind.chave] || 0) * 100) : INDICADORES.map(() => 0);

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: INDICADORES.map(i => i.rotulo),
      datasets: [
        {
          label: 'Esta Escola',
          data: dadosEscolaArr,
          backgroundColor: 'rgba(26, 86, 145, 0.2)',
          borderColor: '#1A5691',
          borderWidth: 2,
          pointBackgroundColor: '#1A5691',
        },
        {
          label: 'Media do Municipio',
          data: dadosMedia,
          backgroundColor: 'rgba(61, 163, 90, 0.1)',
          borderColor: '#3DA35A',
          borderWidth: 2,
          pointBackgroundColor: '#3DA35A',
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 13 }, usePointStyle: true },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 25,
            font: { family: 'Inter', size: 10 },
            callback: (v) => v + '%',
          },
        },
      },
    },
  });
}

/* --- Avaliacao com Haversine --- */
function configurarAvaliacao() {
  const usuario = estado.obter('usuarioAtual') || Parse.User.current();

  if (usuario) {
    estado.definir('usuarioAtual', usuario);
    _inicializarFormAvaliacao();
  } else {
    document.getElementById('avaliacao-login-msg').classList.remove('hidden');
    document.getElementById('form-avaliacao').classList.add('hidden');
  }

  estado.assinar('mudanca:usuarioAtual', (user) => {
    if (user) {
      document.getElementById('avaliacao-login-msg').classList.add('hidden');
      _inicializarFormAvaliacao();
    }
  });
}

async function _inicializarFormAvaliacao() {
  const form = document.getElementById('form-avaliacao');
  form.classList.remove('hidden');

  /* Verifica se ja avaliou */
  const existente = await FeedbackAPI.verificarAvaliacaoExistente(dadosEscola.id_escola);
  if (existente) {
    form.classList.add('hidden');
    document.getElementById('avaliacao-ja-enviada').classList.remove('hidden');
    return;
  }

  /* Estrelas */
  const estrelas = document.querySelectorAll('#estrelas-avaliacao i');
  estrelas.forEach(estrela => {
    estrela.addEventListener('click', () => {
      notaSelecionada = parseInt(estrela.dataset.nota);
      document.getElementById('avaliacao-nota').value = notaSelecionada;
      estrelas.forEach((e, i) => {
        e.classList.toggle('preenchida', i < notaSelecionada);
      });
    });
    estrela.addEventListener('mouseenter', () => {
      const n = parseInt(estrela.dataset.nota);
      estrelas.forEach((e, i) => { e.classList.toggle('preenchida', i < n); });
    });
  });

  document.getElementById('estrelas-avaliacao').addEventListener('mouseleave', () => {
    estrelas.forEach((e, i) => { e.classList.toggle('preenchida', i < notaSelecionada); });
  });

  /* Contador */
  const textarea = document.getElementById('avaliacao-comentario');
  const contador = document.getElementById('contador-avaliacao');
  textarea.addEventListener('input', () => {
    contador.textContent = textarea.value.length;
  });

  /* Haversine — tentar geolocalizacao */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!dadosEscola.latitude || !dadosEscola.longitude) return;
        const distancia = calcularDistanciaKm(
          pos.coords.latitude, pos.coords.longitude,
          dadosEscola.latitude, dadosEscola.longitude
        );
        if (distancia <= 0.5) {
          verificadoLocal = true;
          coordsEnvio = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          document.getElementById('selo-local-container').classList.remove('hidden');
        }
      },
      () => { /* Permissao negada — segue sem selo */ },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  /* Submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (notaSelecionada === 0) {
      document.getElementById('avaliacao-erro-msg').textContent = 'Selecione uma nota de 1 a 5.';
      document.getElementById('avaliacao-erro').classList.remove('hidden');
      return;
    }

    const comentario = textarea.value.trim();
    if (!comentario) {
      document.getElementById('avaliacao-erro-msg').textContent = 'Escreva um comentario.';
      document.getElementById('avaliacao-erro').classList.remove('hidden');
      return;
    }

    try {
      await FeedbackAPI.enviarAvaliacao({
        idEscola: dadosEscola.id_escola,
        nota: notaSelecionada,
        comentario,
        latitude: coordsEnvio?.latitude,
        longitude: coordsEnvio?.longitude,
        verificadoLocal,
      });

      document.getElementById('avaliacao-sucesso').classList.remove('hidden');
      document.getElementById('avaliacao-erro').classList.add('hidden');
      form.reset();
      notaSelecionada = 0;
      document.querySelectorAll('#estrelas-avaliacao i').forEach(e => e.classList.remove('preenchida'));
      contador.textContent = '0';
      document.getElementById('selo-local-container').classList.add('hidden');

      await carregarFeedbacks();
      setTimeout(() => document.getElementById('avaliacao-sucesso').classList.add('hidden'), 4000);
    } catch (erro) {
      document.getElementById('avaliacao-erro-msg').textContent = erro.message || 'Erro ao enviar.';
      document.getElementById('avaliacao-erro').classList.remove('hidden');
    }
  });
}

/* --- Feed de Feedbacks --- */
async function carregarFeedbacks() {
  const loader = document.getElementById('loader-feedbacks');
  const listaEl = document.getElementById('lista-feedbacks');
  const semFb = document.getElementById('sem-feedbacks');

  if (loader) loader.classList.remove('hidden');
  if (semFb) semFb.classList.add('hidden');
  listaEl.innerHTML = '';

  try {
    const resultados = await FeedbackAPI.listarPorEscola(dadosEscola.id_escola);
    if (loader) loader.classList.add('hidden');

    if (resultados.length === 0) {
      if (semFb) semFb.classList.remove('hidden');
      return;
    }

    const fragmento = document.createDocumentFragment();

    for (const fb of resultados) {
      const card = document.createElement('div');
      card.className = 'bg-slate-50 border border-slate-200 rounded-xl p-4';

      const data = fb.createdAt
        ? new Date(fb.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : '';

      const estrelasHtml = Array.from({ length: 5 }, (_, i) =>
        `<i class="ph-fill ph-star text-sm ${i < (fb.get('nota') || 0) ? 'text-acento' : 'text-slate-300'}"></i>`
      ).join('');

      const verificado = fb.get('verificado_local')
        ? '<span class="badge-verificado ml-2"><i class="ph-fill ph-map-pin"></i> Local Verificado</span>'
        : '';

      const usuarioAtual = estado.obter('usuarioAtual');
      const nomeAutor = fb.get('nome') || '';
      const nomeUsuario = usuarioAtual?.get('nomeExibicao') || usuarioAtual?.get('username') || '';
      const isAdmin = usuarioAtual?.get('role') === 'admin';
      const isAutor = nomeAutor === nomeUsuario;
      const podeExcluir = isAdmin || isAutor;

      const respostas = fb.get('respostas') || [];
      const temRespostas = Array.isArray(respostas) && respostas.length > 0;
      const respostasHtml = temRespostas
        ? respostas.map(r => `
            <div class="mt-2 p-3 bg-primaria/5 border border-primaria/20 rounded-lg">
              <p class="text-xs font-bold text-primaria mb-1 flex items-center gap-1">
                <i class="ph-fill ph-chat-circle-text"></i> Resposta da Gestao
              </p>
              <p class="text-sm text-slate-700">${esc(r.texto || '')}</p>
            </div>`).join('')
        : '';

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <i class="ph-fill ph-user-circle text-xl text-slate-400"></i>
              <span class="font-bold text-sm text-slate-800">${esc(nomeAutor || 'Anonimo')}</span>
              ${verificado}
              <span class="text-xs text-slate-400">${esc(data)}</span>
            </div>
            <div class="flex items-center gap-0.5 mb-2">${estrelasHtml}</div>
            <p class="text-sm text-slate-600 leading-relaxed">${esc(fb.get('mensagem') || '')}</p>
            ${respostasHtml}
            <div class="flex items-center gap-4 mt-3 pt-2 border-t border-slate-200">
              <button class="btn-curtir text-xs text-slate-400 hover:text-secundaria transition-colors flex items-center gap-1" data-review-id="${fb.id}">
                <i class="ph-bold ph-heart"></i> Apoiar
              </button>
              <button class="btn-denunciar text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1" data-review-id="${fb.id}">
                <i class="ph-bold ph-flag"></i> Denunciar
              </button>
              ${podeExcluir ? `<button class="btn-excluir-feedback text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1" data-review-id="${fb.id}"><i class="ph-bold ph-trash"></i> Excluir</button>` : ''}
              ${isAdmin ? `<button class="btn-responder-feedback text-xs text-slate-400 hover:text-primaria transition-colors flex items-center gap-1" data-review-id="${fb.id}"><i class="ph-bold ph-chat-circle-text"></i> Responder</button>` : ''}
            </div>
          </div>
        </div>`;

      fragmento.appendChild(card);
    }

    listaEl.appendChild(fragmento);

    /* Eventos de interacao */
    listaEl.querySelectorAll('.btn-curtir').forEach(btn => {
      btn.addEventListener('click', async () => {
        const usuario = estado.obter('usuarioAtual');
        if (!usuario) { alert('E necessario fazer login.'); return; }
        try {
          await FeedbackAPI.curtirAvaliacao(btn.dataset.reviewId);
          btn.classList.add('text-secundaria');
          btn.querySelector('i').classList.replace('ph-bold', 'ph-fill');
        } catch (_) { /* Silencia */ }
      });
    });

    listaEl.querySelectorAll('.btn-denunciar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const usuario = estado.obter('usuarioAtual');
        if (!usuario) { alert('E necessario fazer login.'); return; }
        if (!confirm('Denunciar este comentario?')) return;
        try {
          await FeedbackAPI.denunciarAvaliacao(btn.dataset.reviewId);
          btn.classList.add('text-red-500');
        } catch (_) { /* Silencia */ }
      });
    });

    listaEl.querySelectorAll('.btn-excluir-feedback').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir este comentario permanentemente?')) return;
        try {
          await FeedbackAPI.excluirAvaliacao(btn.dataset.reviewId);
          btn.closest('.bg-slate-50').remove();
          if (listaEl.querySelectorAll('.bg-slate-50').length === 0) {
            if (semFb) semFb.classList.remove('hidden');
          }
        } catch (_) { alert('Erro ao excluir comentario.'); }
      });
    });

    listaEl.querySelectorAll('.btn-responder-feedback').forEach(btn => {
      btn.addEventListener('click', () => {
        const resposta = prompt('Digite a resposta da gestao:');
        if (!resposta || !resposta.trim()) return;
        (async () => {
          try {
            await FeedbackAPI.responderAvaliacao(btn.dataset.reviewId, resposta.trim());
            await carregarFeedbacks();
          } catch (_) { alert('Erro ao enviar resposta.'); }
        })();
      });
    });
  } catch (erro) {
    console.error('[ESCOLA] Erro ao carregar feedbacks:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

/* --- Utilitarios --- */
function esc(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texto));
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', iniciar);
