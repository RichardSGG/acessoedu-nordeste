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
import * as BrasilAPI from '../api/brasilapi.api.js';
import { mostrarAlerta, mostrarConfirmacao, mostrarPrompt } from './modal.ui.js';
import { PARSE_CONFIG } from '../core/constantes.js';

Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
Parse.serverURL = PARSE_CONFIG.SERVER_URL;

/* Estado local */
let dadosEscola = null;
let dadosComparativo = null;
let notaSelecionada = 0;
let verificadoLocal = false;
let coordsEnvio = null;
let instanciaRadar = null;
let instanciaBarras = null;
let anoRadar = 2025;

const INDICADORES = [
  { chave: 'internet', rotulo: 'Internet', icone: 'ph-wifi-high' },
  { chave: 'laboratorio', rotulo: 'Laboratório', icone: 'ph-desktop' },
  { chave: 'banheiro_pne', rotulo: 'Banheiro PNE', icone: 'ph-wheelchair' },
  { chave: 'quadra', rotulo: 'Quadra', icone: 'ph-soccer-ball' },
  { chave: 'rampa_acessibilidade', rotulo: 'Acessibilidade', icone: 'ph-stairs' },
  { chave: 'agua_potavel', rotulo: 'Água Potável', icone: 'ph-drop' },
  { chave: 'energia_eletrica', rotulo: 'Energia Elétrica', icone: 'ph-lightning' },
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
  document.getElementById('escola-uf').style.display = 'none';
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

  /* Contatos no header */
  const containerContatos = document.getElementById('contatos-header');
  const elTelHeader = document.getElementById('escola-telefone-header');
  let temContato = false;

  if (dadosEscola.telefone) {
    temContato = true;
    elTelHeader.classList.remove('hidden');
    elTelHeader.href = `tel:${dadosEscola.telefone.replace(/[^\d+]/g, '')}`;
    elTelHeader.querySelector('span').textContent = dadosEscola.telefone;
  } else {
    elTelHeader.classList.add('hidden');
  }

  if (temContato) {
    containerContatos.classList.remove('hidden');
  }
}

/* --- Contato e Localizacao --- */
function renderizarContato() {
  const elEndereco = document.getElementById('contato-endereco');
  const elMapa = document.getElementById('contato-mapa');
  const elTelefone = document.getElementById('contato-telefone');
  const elCep = document.getElementById('contato-cep');
  const elSemDados = document.getElementById('contato-sem-dados');

  const endereco = dadosEscola.endereco;
  const telefone = dadosEscola.telefone;
  const cep = dadosEscola.cep;
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

  const cepLimpo = cep ? cep.replace(/\D/g, '') : '';

  if (cepLimpo && cepLimpo.length === 8) {
    temDados = true;
    elCep.classList.remove('hidden');
    const cepFormatado = cepLimpo.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    document.getElementById('txt-cep').textContent = cepFormatado;

    /* Fallback: se nao tem endereco mas tem CEP, busca no BrasilAPI */
    if (!endereco) {
      BrasilAPI.buscarCep(cepLimpo).then(resultado => {
        if (resultado.ok) {
          const { logradouro, bairro, cidade, uf } = resultado.dados;
          const partes = [logradouro, bairro, cidade].filter(Boolean);
          const endViaCep = partes.length > 0
            ? partes.join(', ') + (uf ? ` - ${uf}` : '')
            : null;
          if (endViaCep) {
            elEndereco.classList.remove('hidden');
            document.getElementById('txt-endereco').textContent = endViaCep;
          }
        }
      }).catch(() => { /* Silencia */ });
    }
  } else {
    elCep.classList.add('hidden');
  }

  if (!temDados) {
    elSemDados.classList.remove('hidden');
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
      autor: f.get('autor'),
      moderadoPor: f.get('moderadoPor')
    })));
    return;
  }

  /* Cache de Foto: Verifica se já existe uma URL salva no banco de dados */
  if (dadosEscola.foto_url) {
    renderizarFotos([{
      url: dadosEscola.foto_url,
      fonte: 'Mapillary (Cache)',
    }]);
    return;
  }

  /* Etapa 2: Mapillary */
  const resultadoMapillary = await MapillaryAPI.buscarFotosDaEscola(dadosEscola.latitude, dadosEscola.longitude);
  if (resultadoMapillary.ok) {
    const fotos = resultadoMapillary.fotos.map(img => ({
      url: img.thumb_1024_url || img.thumb_512_url || '',
      fonte: 'Mapillary',
    }));
    renderizarFotos(fotos);

    const primeiraFotoUrl = fotos[0]?.url;
    if (primeiraFotoUrl && dadosEscola.id_parse && dadosEscola.classe) {
      EscolasAPI.atualizarFotoUrl(dadosEscola.id_parse, dadosEscola.classe, primeiraFotoUrl)
        .catch(err => console.error('[ESCOLA] Falha ao atualizar cache de foto_url:', err));
    }
    return;
  }

  /* Etapa 3: Placeholder */
  container.innerHTML = '';
  btnAnterior.classList.add('hidden');
  btnProximo.classList.add('hidden');
  placeholder.classList.remove('hidden');

  const placeholderMsg = document.getElementById('placeholder-foto')?.querySelector('p');
  if (placeholderMsg) {
    placeholderMsg.textContent = 'Nenhuma foto disponível para esta localização.';
  }

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
  const placeholder = document.getElementById('placeholder-foto');
  const btnAnterior = document.getElementById('btn-foto-anterior');
  const btnProximo = document.getElementById('btn-foto-proximo');
  if (placeholder) placeholder.classList.add('hidden');
  const fragmento = document.createDocumentFragment();

  const usuarioLogado = estado.obter('usuarioAtual');
  const isAdmin = usuarioLogado?.get('role') === 'admin';

  fotos.forEach((foto, idx) => {
    const slide = document.createElement('div');
    slide.className = 'flex-shrink-0 w-full sm:w-96 snap-center';

    let legenda = foto.fonte || '';
    if (foto.fonte === 'Comunidade AcessoEdu') {
      const autorObj = foto.autor;
      const nomeAutor = autorObj ? (autorObj.get('nomeExibicao') || autorObj.get('username') || 'Usuário') : '';
      if (nomeAutor) {
        legenda = `Enviada por: ${nomeAutor}`;
      } else {
        legenda = 'Comunidade AcessoEdu';
      }

      if (isAdmin) {
        const moderadorObj = foto.moderadoPor;
        const nomeModerador = moderadorObj ? (moderadorObj.get('nomeExibicao') || moderadorObj.get('username') || 'Admin') : '';
        if (nomeModerador) {
          legenda += ` | Aprovada por: ${nomeModerador}`;
        }
      }
    }

    slide.innerHTML = `
      <div class="relative rounded-xl overflow-hidden bg-slate-100 aspect-[4/3]">
        <img src="${esc(foto.url)}" alt="Foto da escola" class="w-full h-full object-cover cursor-pointer" loading="lazy"
             onclick="abrirModalFoto('${esc(foto.url)}')"
             onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center\\'><i class=\\'ph-fill ph-image text-4xl text-slate-300\\'></i></div>'">
        ${legenda ? `<span class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">${esc(legenda)}</span>` : ''}
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
  const usuario = Parse.User.current();
  if (!usuario) {
    window.location.href = 'config.html';
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      // Conta fotos que o usuario ja enviou para esta escola
      const query = new Parse.Query('SchoolPhoto');
      query.equalTo('id_escola', String(dadosEscola.id_escola));
      query.equalTo('autor', usuario);
      const contagem = await query.count();

      if (contagem >= 10) {
        await mostrarAlerta('Você atingiu o limite máximo de 10 fotos enviadas para esta escola.', 'Limite Atingido');
        return;
      }

      const restante = 10 - contagem;
      const arquivosParaEnviar = files.slice(0, restante);

      if (files.length > restante) {
        await mostrarAlerta(`Apenas ${restante} fotos serão enviadas. Você já possui ${contagem} foto(s) cadastrada(s) para esta escola, e o limite é de 10 fotos.`, 'Limite Parcial');
      }

      let enviadas = 0;
      for (const file of arquivosParaEnviar) {
        try {
          await FotosAPI.enviarFoto(dadosEscola.id_escola, file);
          enviadas++;
        } catch (erro) {
          console.error('[ESCOLA] Erro ao enviar foto:', erro);
        }
      }

      if (enviadas > 0) {
        await mostrarAlerta(`${enviadas} foto(s) enviada(s) para moderação. Obrigado pela contribuição!`, 'Sucesso');
      }
    } catch (erro) {
      console.error('[ESCOLA] Erro ao validar limite de fotos:', erro);
      await mostrarAlerta('Erro ao validar limite de fotos. Tente novamente.', 'Erro');
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
      else { evolucao = 'Estável'; corEvolucao = 'text-slate-400'; }
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
  const v = (valor !== null && valor !== undefined) ? Number(valor) : null;
  if (v === 1) {
    return '<i class="ph-fill ph-check-circle text-secundaria text-lg" title="Possui"></i>';
  }
  if (v === 0) {
    return '<i class="ph-fill ph-x-circle text-red-400 text-lg" title="Não possui"></i>';
  }
  return '<span class="inline-flex items-center gap-1 text-slate-400 text-xs"><i class="ph-fill ph-minus-circle text-slate-300 text-lg"></i> Sem Informação</span>';
}

/* --- Grafico Radar (Lazy Loading Chart.js) --- */
function configurarRadar() {
  const container = document.getElementById('container-radar');
  if (!container) return;

  const btn2024 = document.getElementById('toggle-radar-2024');
  const btn2025 = document.getElementById('toggle-radar-2025');

  const aplicarEstiloToggle = (ano) => {
    const ativo = 'bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    const inativo = 'rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    if (ano === 2025) {
      btn2025.className = `px-4 py-1.5 ${ativo}`;
      btn2024.className = `px-4 py-1.5 ${inativo}`;
    } else {
      btn2024.className = `px-4 py-1.5 ${ativo}`;
      btn2025.className = `px-4 py-1.5 ${inativo}`;
    }
  };

  if (btn2024) {
    btn2024.addEventListener('click', async () => {
      if (anoRadar === 2024) return;
      anoRadar = 2024;
      aplicarEstiloToggle(2024);
      await renderizarRadar(2024);
      await renderizarBarrasEscola(2024);
    });
  }

  if (btn2025) {
    btn2025.addEventListener('click', async () => {
      if (anoRadar === 2025) return;
      anoRadar = 2025;
      aplicarEstiloToggle(2025);
      await renderizarRadar(2025);
      await renderizarBarrasEscola(2025);
    });
  }

  const observador = new IntersectionObserver(async (entradas) => {
    if (!entradas[0].isIntersecting) return;
    observador.disconnect();

    try {
      await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
      await renderizarRadar(anoRadar);
      await renderizarBarrasEscola(anoRadar);
    } catch (erro) {
      console.error('[ESCOLA] Erro ao carregar Chart.js:', erro);
    }
  }, { threshold: 0.1 });

  observador.observe(container);
}

async function renderizarRadar(ano) {
  const ctx = document.getElementById('grafico-radar')?.getContext('2d');
  if (!ctx) return;

  /* Destroi instancia anterior */
  if (instanciaRadar) {
    instanciaRadar.destroy();
    instanciaRadar = null;
  }

  if (!dadosEscola) return;

  /* Dados da escola para o ano selecionado */
  let dadosAno = dadosEscola;
  if (ano === 2024 && dadosComparativo?.dados2024) {
    dadosAno = dadosComparativo.dados2024;
  }

  const dadosEscolaArr = INDICADORES.map(ind => dadosAno[ind.chave] === 1 ? 100 : 0);

  /* Estatisticas agregadas (municipio, estado, regiao) */
  const uf = dadosEscola.uf || dadosAno.uf || '';
  const municipio = dadosEscola.cidade || dadosAno.cidade || '';
  const estatisticas = await EscolasAPI.obterEstatisticas(uf, municipio);

  const mapearIndicadores = (fonte) => {
    if (!fonte) return INDICADORES.map(() => 0);
    const mapaChaves = {
      internet: 'internet',
      laboratorio: 'lab_informatica',
      banheiro_pne: 'banheiro_acessivel',
      quadra: 'quadra_esportes',
      rampa_acessibilidade: 'rampas',
      agua_potavel: 'agua_potavel',
      energia_eletrica: 'energia_eletrica'
    };
    return INDICADORES.map(ind => {
      const chaveFonte = mapaChaves[ind.chave];
      return fonte[chaveFonte] ?? 0;
    });
  };

  const dadosMunicipio = mapearIndicadores(estatisticas?.municipio);
  const dadosEstado = mapearIndicadores(estatisticas?.estado);
  const dadosRegiao = mapearIndicadores(estatisticas?.regiao);

  instanciaRadar = new Chart(ctx, {
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
          pointRadius: 4,
        },
        {
          label: 'Média do Município',
          data: dadosMunicipio,
          backgroundColor: 'rgba(61, 163, 90, 0.1)',
          borderColor: '#3DA35A',
          borderWidth: 2,
          pointBackgroundColor: '#3DA35A',
          borderDash: [4, 4],
        },
        {
          label: 'Média do Estado',
          data: dadosEstado,
          backgroundColor: 'rgba(242, 153, 74, 0.1)',
          borderColor: '#F2994A',
          borderWidth: 2,
          pointBackgroundColor: '#F2994A',
          borderDash: [6, 3],
        },
        {
          label: 'Média da Região (Nordeste)',
          data: dadosRegiao,
          backgroundColor: 'rgba(128, 90, 213, 0.08)',
          borderColor: '#805AD5',
          borderWidth: 2,
          pointBackgroundColor: '#805AD5',
          borderDash: [2, 2],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            padding: 16,
          },
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
          pointLabels: {
            font: { family: 'Inter', size: 11, weight: '600' },
          },
        },
      },
    },
  });
}

async function renderizarBarrasEscola(ano) {
  const ctx = document.getElementById('grafico-barras-escola')?.getContext('2d');
  if (!ctx) return;

  /* Destroi instancia anterior */
  if (instanciaBarras) {
    instanciaBarras.destroy();
    instanciaBarras = null;
  }

  if (!dadosEscola) return;

  /* Dados da escola para o ano selecionado */
  let dadosAno = dadosEscola;
  if (ano === 2024 && dadosComparativo?.dados2024) {
    dadosAno = dadosComparativo.dados2024;
  }

  const dadosEscolaArr = INDICADORES.map(ind => dadosAno[ind.chave] === 1 ? 100 : 0);

  instanciaBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: INDICADORES.map(i => i.rotulo),
      datasets: [
        {
          label: 'Percentual Atendido (%)',
          data: dadosEscolaArr,
          backgroundColor: 'rgba(26, 86, 145, 0.7)',
          borderColor: '#1A5691',
          borderWidth: 1,
          borderRadius: 8,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw + '%' } }
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%', font: { family: 'Inter' } } },
        x: { ticks: { font: { family: 'Inter', size: 10, weight: 'bold' } } }
      }
    }
  });
}

/* --- Avaliacao com Haversine ---
   Fluxo Pub/Sub:
   1. Verifica Parse.User.current() (sessao nativa do Back4App)
   2. Se logado, sincroniza com estado global e exibe o form
   3. Se deslogado, exibe mensagem "Faca login"
   4. Assina mudanca:usuarioAtual para reagir a login/logout em tempo real */
function configurarAvaliacao() {
  _resolverEstadoAuth();
  estado.assinar('mudanca:usuarioAtual', (user) => {
    if (user) {
      document.getElementById('avaliacao-login-msg').classList.add('hidden');
      _inicializarFormAvaliacao();
    } else {
      document.getElementById('avaliacao-login-msg').classList.remove('hidden');
      document.getElementById('form-avaliacao').classList.add('hidden');
      document.getElementById('avaliacao-ja-enviada').classList.add('hidden');
    }
  });
}

async function _resolverEstadoAuth() {
  let usuario = estado.obter('usuarioAtual');

  /* Tenta recuperar sessao nativa do Parse caso o estado ainda nao tenha */
  if (!usuario) {
    try {
      const sessao = Parse.User.current();
      if (sessao) {
        await sessao.fetch(); /* Valida token contra o Back4App */
        estado.definir('usuarioAtual', sessao);
        usuario = sessao;
      }
    } catch (_) {
      /* Sessão expirada ou inválida — trata como deslogado */
      estado.definir('usuarioAtual', null);
      usuario = null;
    }
  }

  if (usuario) {
    document.getElementById('avaliacao-login-msg').classList.add('hidden');
    _inicializarFormAvaliacao();
  } else {
    document.getElementById('avaliacao-login-msg').classList.remove('hidden');
    document.getElementById('form-avaliacao').classList.add('hidden');
  }
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
      document.getElementById('avaliacao-erro-msg').textContent = 'Escreva um comentário.';
      document.getElementById('avaliacao-erro').classList.remove('hidden');
      return;
    }

    if (contemTermosOfensivos(comentario)) {
      await mostrarAlerta(
        'Sua avaliação contém palavras ofensivas, preconceituosas ou impróprias que violam as regras da nossa comunidade. Por favor, reescreva com respeito e cooperação.',
        'Comportamento Inadequado'
      );
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
                <i class="ph-fill ph-chat-circle-text"></i> Resposta da Gestão
              </p>
              <p class="text-sm text-slate-700">${esc(r.texto || '')}</p>
            </div>`).join('')
        : '';

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <i class="ph-fill ph-user-circle text-xl text-slate-400"></i>
              <span class="font-bold text-sm text-slate-800">${esc(nomeAutor || 'Anônimo')}</span>
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
        if (!usuario) { await mostrarAlerta('É necessário fazer login.', 'Aviso'); return; }
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
        if (!usuario) { await mostrarAlerta('É necessário fazer login.', 'Aviso'); return; }

        const chaveDenuncia = 'denunciou_' + btn.dataset.reviewId;
        if (localStorage.getItem(chaveDenuncia)) {
          await mostrarAlerta('Você já enviou uma denúncia para este comentário.', 'Aviso');
          return;
        }

        if (!await mostrarConfirmacao('Denunciar este comentário?')) return;
        try {
          await FeedbackAPI.denunciarAvaliacao(btn.dataset.reviewId);
          localStorage.setItem(chaveDenuncia, 'true');
          btn.classList.add('text-red-500');
        } catch (_) { /* Silencia */ }
      });
    });

    listaEl.querySelectorAll('.btn-excluir-feedback').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!await mostrarConfirmacao('Excluir este comentário permanentemente?')) return;
        try {
          await FeedbackAPI.excluirAvaliacao(btn.dataset.reviewId);
          btn.closest('.bg-slate-50').remove();
          if (listaEl.querySelectorAll('.bg-slate-50').length === 0) {
            if (semFb) semFb.classList.remove('hidden');
          }
        } catch (_) { await mostrarAlerta('Erro ao excluir comentário.', 'Erro'); }
      });
    });

    listaEl.querySelectorAll('.btn-responder-feedback').forEach(btn => {
      btn.addEventListener('click', async () => {
        const resposta = await mostrarPrompt('Digite a resposta da gestão:', 'Resposta da Gestão');
        if (!resposta || !resposta.trim()) return;
        (async () => {
          try {
            await FeedbackAPI.responderAvaliacao(btn.dataset.reviewId, resposta.trim());
            await carregarFeedbacks();
          } catch (_) { await mostrarAlerta('Erro ao enviar resposta.', 'Erro'); }
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

/* --- Modal de Foto Ampliada --- */
function contemTermosOfensivos(texto) {
  const textoMinusculo = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const termos = [
    'porra', 'caralho', 'puta', 'merda', 'bosta', 'viado', 'fdp', 'arrombado', 
    'filho da puta', 'babaca', 'otario', 'imbecil', 'vagabundo', 'nazista', 
    'fascista', 'racista', 'putaria', 'cacete', 'buceta', 'retardado', 'retardada',
    'macaco', 'bicha', 'corno', 'pqp' 
  ];
  return termos.some(termo => {
    const regex = new RegExp('\\b' + termo + '\\b', 'i');
    return regex.test(textoMinusculo);
  });
}

window.abrirModalFoto = function (url) {
  let modal = document.getElementById('modal-foto');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-foto';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    modal.addEventListener('click', () => modal.remove());
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <button style="position:absolute;top:16px;right:16px;color:#fff;background:none;border:none;font-size:32px;cursor:pointer;opacity:0.8;" onclick="this.parentElement.remove()">
      <i class="ph-bold ph-x"></i>
    </button>
    <img src="${url}" alt="Foto ampliada" style="max-width:90vw;max-height:85vh;object-fit:contain;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.15);" onclick="event.stopPropagation()">
  `;
}

document.addEventListener('DOMContentLoaded', iniciar);
