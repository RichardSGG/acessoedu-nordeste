/**
 * src/js/ui/admin.js
 * Responsabilidade: Painel admin — moderacao de fotos e comentarios
 */

import estado from '../core/estado.js';
import * as FotosAPI from '../api/fotos.api.js';
import * as FeedbackAPI from '../api/feedback.api.js';
import { verificarAdmin, listarUsuarios, atualizarStatusUsuario } from '../api/auth.api.js';
import { PARSE_CONFIG } from '../core/constantes.js';

Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
Parse.serverURL = PARSE_CONFIG.SERVER_URL;

let filtrosFotos = {};
let filtrosComentarios = {};

async function iniciar() {
  const admin = await verificarAdmin();
  document.getElementById('loader-admin')?.classList.add('hidden');

  if (!admin) {
    document.getElementById('sem-permissao')?.classList.remove('hidden');
    return;
  }

  document.getElementById('conteudo-admin')?.classList.remove('hidden');

  const usuario = Parse.User.current();
  estado.definir('usuarioAtual', usuario);

  console.log('[ADMIN] Acesso autorizado:', usuario.get('username'));

  configurarAbasFotos();
  configurarAbasComentarios();
  configurarBotaoRecarregar();
  configurarFiltrosAdmin();
  configurarAbaUsuarios();
  await carregarFotosPendentes();
  await carregarTodosComentarios();
  await carregarUsuarios();
}

/* --- Abas Fotos --- */
function configurarAbasFotos() {
  const tabPendentes = document.getElementById('tab-fotos-pendentes');
  const tabAprovadas = document.getElementById('tab-fotos-aprovadas');
  const painelPendentes = document.getElementById('painel-fotos-pendentes');
  const painelAprovadas = document.getElementById('painel-fotos-aprovadas');

  if (!tabPendentes || !tabAprovadas) return;

  tabPendentes.addEventListener('click', () => {
    tabPendentes.className = 'px-4 py-1.5 bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    tabAprovadas.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    painelPendentes.classList.remove('hidden');
    painelAprovadas.classList.add('hidden');
  });

  tabAprovadas.addEventListener('click', async () => {
    tabAprovadas.className = 'px-4 py-1.5 bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    tabPendentes.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    painelPendentes.classList.add('hidden');
    painelAprovadas.classList.remove('hidden');
    await carregarFotosAprovadas();
  });
}

/* --- Abas Comentários --- */
function configurarAbasComentarios() {
  const tabTodos = document.getElementById('tab-comentarios-todos');
  const tabDenunciados = document.getElementById('tab-comentarios-denunciados');
  const tabRemovidos = document.getElementById('tab-comentarios-removidos');

  const painelTodos = document.getElementById('painel-comentarios-todos');
  const painelDenunciados = document.getElementById('painel-comentarios-denunciados');
  const painelRemovidos = document.getElementById('painel-comentarios-removidos');

  if (!tabTodos || !tabDenunciados || !tabRemovidos) return;

  tabTodos.addEventListener('click', async () => {
    tabTodos.className = 'px-4 py-1.5 bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    tabDenunciados.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    tabRemovidos.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    
    painelTodos.classList.remove('hidden');
    painelDenunciados.classList.add('hidden');
    painelRemovidos.classList.add('hidden');
    await carregarTodosComentarios();
  });

  tabDenunciados.addEventListener('click', async () => {
    tabDenunciados.className = 'px-4 py-1.5 bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    tabTodos.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    tabRemovidos.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    
    painelTodos.classList.add('hidden');
    painelDenunciados.classList.remove('hidden');
    painelRemovidos.classList.add('hidden');
    await carregarDenuncias();
  });

  tabRemovidos.addEventListener('click', async () => {
    tabRemovidos.className = 'px-4 py-1.5 bg-white rounded-full shadow-sm text-xs font-bold text-primaria transition-all duration-300';
    tabTodos.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    tabDenunciados.className = 'px-4 py-1.5 rounded-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-all duration-300';
    
    painelTodos.classList.add('hidden');
    painelDenunciados.classList.add('hidden');
    painelRemovidos.classList.remove('hidden');
    await carregarComentariosRemovidos();
  });
}

/* --- Fotos Pendentes --- */
async function carregarFotosPendentes() {
  const loader = document.getElementById('loader-fotos');
  const tabela = document.getElementById('tabela-fotos');
  const tbody = document.getElementById('tabela-fotos-body');
  const semFotos = document.getElementById('sem-fotos');

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semFotos) semFotos.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';

    const fotos = await FotosAPI.listarPendentes(filtrosFotos);
    if (loader) loader.classList.add('hidden');

    if (fotos.length === 0) {
      if (semFotos) semFotos.classList.remove('hidden');
      return;
    }

    if (tabela) tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    fotos.forEach(foto => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      const url = foto.get('arquivo')?.url();
      const idEscola = foto.get('id_escola') || '';

      tr.innerHTML = `
        <td class="py-3 px-3">
          ${url ? `<img src="${esc(url)}" alt="Miniatura" class="w-16 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer" onclick="abrirModalFoto('${esc(url)}')" loading="lazy">` : '<span class="text-xs text-slate-400">--</span>'}
        </td>
        <td class="py-3 px-3 text-sm font-medium text-slate-700">
          ${esc(idEscola)}
          <a href="detalhes.html?id=${esc(idEscola)}" target="_blank" class="block text-xs text-primaria hover:underline mt-0.5">
            <i class="ph-bold ph-arrow-square-out"></i> Olhar perfil
          </a>
        </td>
        <td class="py-3 px-3 text-sm text-slate-500">${_formatarData(foto.createdAt)}</td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button class="btn-aprovar px-3 py-1.5 bg-green-50 text-secundaria rounded-full text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1" data-foto-id="${foto.id}">
              <i class="ph-bold ph-check"></i> Aprovar
            </button>
            <button class="btn-rejeitar px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1" data-foto-id="${foto.id}">
              <i class="ph-bold ph-x"></i> Rejeitar
            </button>
          </div>
        </td>`;
      fragmento.appendChild(tr);
    });

    if (tbody) {
      tbody.innerHTML = '';
      tbody.appendChild(fragmento);

      tbody.querySelectorAll('.btn-aprovar').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FotosAPI.moderarFoto(btn.dataset.fotoId, 'approved');
          btn.closest('tr').remove();
          if (tbody.children.length === 0) { tabela.classList.add('hidden'); semFotos.classList.remove('hidden'); }
        });
      });

      tbody.querySelectorAll('.btn-rejeitar').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FotosAPI.moderarFoto(btn.dataset.fotoId, 'rejected');
          btn.closest('tr').remove();
          if (tbody.children.length === 0) { tabela.classList.add('hidden'); semFotos.classList.remove('hidden'); }
        });
      });
    }
  } catch (erro) {
    console.error('[ADMIN] Erro fotos:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

/* --- Fotos Aprovadas --- */
async function carregarFotosAprovadas() {
  const loader = document.getElementById('loader-fotos-aprovadas');
  const tabela = document.getElementById('tabela-fotos-aprovadas');
  const tbody = document.getElementById('tabela-fotos-aprovadas-body');
  const semFotos = document.getElementById('sem-fotos-aprovadas');

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semFotos) semFotos.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';

    const fotos = await FotosAPI.listarAprovadasAdmin(filtrosFotos);
    if (loader) loader.classList.add('hidden');

    if (fotos.length === 0) {
      if (semFotos) semFotos.classList.remove('hidden');
      return;
    }

    if (tabela) tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    fotos.forEach(foto => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      const url = foto.get('arquivo')?.url();
      const idEscola = foto.get('id_escola') || '';

      tr.innerHTML = `
        <td class="py-3 px-3">
          ${url ? `<img src="${esc(url)}" alt="Miniatura" class="w-16 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer" onclick="abrirModalFoto('${esc(url)}')" loading="lazy">` : '<span class="text-xs text-slate-400">--</span>'}
        </td>
        <td class="py-3 px-3 text-sm font-medium text-slate-700">
          ${esc(idEscola)}
          <a href="detalhes.html?id=${esc(idEscola)}" target="_blank" class="block text-xs text-primaria hover:underline mt-0.5">
            <i class="ph-bold ph-arrow-square-out"></i> Olhar perfil
          </a>
        </td>
        <td class="py-3 px-3 text-sm text-slate-500">${_formatarData(foto.updatedAt)}</td>
        <td class="py-3 px-3 text-center">
          <button class="btn-remover-foto px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1" data-foto-id="${foto.id}">
            <i class="ph-bold ph-trash"></i> Remover
          </button>
        </td>`;
      fragmento.appendChild(tr);
    });

    if (tbody) {
      tbody.innerHTML = '';
      tbody.appendChild(fragmento);

      tbody.querySelectorAll('.btn-remover-foto').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FotosAPI.moderarFoto(btn.dataset.fotoId, 'rejected');
          btn.closest('tr').remove();
          if (tbody.children.length === 0) { tabela.classList.add('hidden'); semFotos.classList.remove('hidden'); }
        });
      });
    }
  } catch (erro) {
    console.error('[ADMIN] Erro fotos aprovadas:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

/* --- Todos os Comentários --- */
async function carregarTodosComentarios() {
  const loader = document.getElementById('loader-comentarios-todos');
  const tabela = document.getElementById('tabela-comentarios-todos');
  const tbody = document.getElementById('tabela-comentarios-todos-body');
  const semComentarios = document.getElementById('sem-comentarios-todos');

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semComentarios) semComentarios.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';

    const comentarios = await FeedbackAPI.listarTodos(filtrosComentarios);
    if (loader) loader.classList.add('hidden');

    if (comentarios.length === 0) {
      if (semComentarios) semComentarios.classList.remove('hidden');
      return;
    }

    if (tabela) tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    comentarios.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      const idEscola = c.get('id_escola') || '';

      tr.innerHTML = `
        <td class="py-3 px-3 text-sm text-slate-700 max-w-xs truncate">${esc(c.get('mensagem') || '')}</td>
        <td class="py-3 px-3 text-sm text-slate-500">${esc(c.get('nome') || '--')}</td>
        <td class="py-3 px-3 text-sm text-slate-500">
          ${idEscola ? `<a href="detalhes.html?id=${esc(idEscola)}" target="_blank" class="text-xs text-primaria hover:underline flex items-center gap-1"><i class="ph-bold ph-arrow-square-out"></i> ${esc(idEscola)}</a>` : '<span class="text-xs text-slate-400">--</span>'}
        </td>
        <td class="py-3 px-3 text-center">
          <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">${c.get('flags_count') || 0}</span>
        </td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button class="btn-manter px-3 py-1.5 bg-green-50 text-secundaria rounded-full text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1" data-review-id="${c.id}">
              <i class="ph-bold ph-check"></i> Manter
            </button>
            <button class="btn-remover px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1" data-review-id="${c.id}">
              <i class="ph-bold ph-trash"></i> Remover
            </button>
          </div>
        </td>`;
      fragmento.appendChild(tr);
    });

    if (tbody) {
      tbody.innerHTML = '';
      tbody.appendChild(fragmento);

      tbody.querySelectorAll('.btn-manter').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FeedbackAPI.manterAvaliacao(btn.dataset.reviewId);
          btn.closest('tr').remove();
          if (tbody.children.length === 0) { tabela.classList.add('hidden'); semComentarios.classList.remove('hidden'); }
        });
      });

      tbody.querySelectorAll('.btn-remover').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FeedbackAPI.excluirAvaliacao(btn.dataset.reviewId);
          btn.closest('tr').remove();
          if (tbody.children.length === 0) { tabela.classList.add('hidden'); semComentarios.classList.remove('hidden'); }
        });
      });
    }
  } catch (erro) {
    console.error('[ADMIN] Erro ao carregar todos os comentarios:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

/* --- Comentarios Denunciados --- */
async function carregarDenuncias() {
  const loader = document.getElementById('loader-denuncias');
  const tabela = document.getElementById('tabela-denuncias');
  const tbody = document.getElementById('tabela-denuncias-body');
  const semDenuncias = document.getElementById('sem-denuncias');

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semDenuncias) semDenuncias.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';

    const denuncias = await FeedbackAPI.listarDenunciadas(filtrosComentarios);
    if (loader) loader.classList.add('hidden');

    if (denuncias.length === 0) {
      semDenuncias.classList.remove('hidden');
      return;
    }

    tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    denuncias.forEach(d => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      const idEscola = d.get('id_escola') || '';

      tr.innerHTML = `
        <td class="py-3 px-3 text-sm text-slate-700 max-w-xs truncate">${esc(d.get('mensagem') || '')}</td>
        <td class="py-3 px-3 text-sm text-slate-500">${esc(d.get('nome') || '--')}</td>
        <td class="py-3 px-3 text-center">
          <span class="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-bold">${d.get('flags_count') || 0}</span>
        </td>
        <td class="py-3 px-3 text-center">
          ${idEscola ? `<a href="detalhes.html?id=${esc(idEscola)}" target="_blank" class="text-xs text-primaria hover:underline flex items-center justify-center gap-1"><i class="ph-bold ph-arrow-square-out"></i> Olhar comentários</a>` : '<span class="text-xs text-slate-400">--</span>'}
        </td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button class="btn-manter px-3 py-1.5 bg-green-50 text-secundaria rounded-full text-xs font-bold hover:bg-green-100 transition-colors flex items-center gap-1" data-review-id="${d.id}">
              <i class="ph-bold ph-check"></i> Manter
            </button>
            <button class="btn-remover px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-bold hover:bg-red-100 transition-colors flex items-center gap-1" data-review-id="${d.id}">
              <i class="ph-bold ph-trash"></i> Remover
            </button>
          </div>
        </td>`;
      fragmento.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(fragmento);

    tbody.querySelectorAll('.btn-manter').forEach(btn => {
      btn.addEventListener('click', async () => {
        await FeedbackAPI.manterAvaliacao(btn.dataset.reviewId);
        btn.closest('tr').remove();
        if (tbody.children.length === 0) { tabela.classList.add('hidden'); semDenuncias.classList.remove('hidden'); }
      });
    });

    tbody.querySelectorAll('.btn-remover').forEach(btn => {
      btn.addEventListener('click', async () => {
        await FeedbackAPI.excluirAvaliacao(btn.dataset.reviewId);
        btn.closest('tr').remove();
        if (tbody.children.length === 0) { tabela.classList.add('hidden'); semDenuncias.classList.remove('hidden'); }
      });
    });
  } catch (erro) {
    console.error('[ADMIN] Erro denuncias:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

function _formatarData(d) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function esc(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(texto));
  return div.innerHTML;
}

/* --- Modal de Foto Ampliada com Desfoque --- */
window.abrirModalFoto = function (url) {
  let modal = document.getElementById('modal-foto-admin');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-foto-admin';
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
};

function configurarBotaoRecarregar() {
  const btnRecarregar = document.getElementById('btn-recarregar-admin');
  if (btnRecarregar) {
    btnRecarregar.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

/* --- Comentarios Removidos (soft-delete) --- */
async function carregarComentariosRemovidos() {
  const loader = document.getElementById('loader-removidos');
  const tabela = document.getElementById('tabela-removidos');
  const tbody = document.getElementById('tabela-removidos-body');
  const semRemovidos = document.getElementById('sem-removidos');

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semRemovidos) semRemovidos.classList.add('hidden');
    if (tbody) tbody.innerHTML = '';

    const removidos = await FeedbackAPI.listarRemovidos(filtrosComentarios);
    if (loader) loader.classList.add('hidden');

    if (!removidos || removidos.length === 0) {
      if (semRemovidos) semRemovidos.classList.remove('hidden');
      return;
    }

    if (tabela) tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    removidos.forEach(d => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      const idEscola = d.get('id_escola') || '';
      const removidoPor = d.get('removidoPor') || 'Admin';
      const removidoEm = d.get('removidoEm') ? new Date(d.get('removidoEm')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

      tr.innerHTML = `
        <td class="py-3 px-3 text-sm text-slate-700 max-w-xs">
          <span class="line-through text-slate-400">${esc(d.get('mensagem') || '--')}</span>
        </td>
        <td class="py-3 px-3 text-sm text-slate-500">${esc(d.get('nome') || '--')}</td>
        <td class="py-3 px-3 text-sm text-slate-500">
          ${idEscola ? `<a href="detalhes.html?id=${esc(idEscola)}" target="_blank" class="text-xs text-primaria hover:underline flex items-center gap-1"><i class="ph-bold ph-arrow-square-out"></i> ${esc(idEscola)}</a>` : '<span class="text-xs text-slate-400">--</span>'}
        </td>
        <td class="py-3 px-3 text-center">
          <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">${esc(removidoPor)}</span>
        </td>
        <td class="py-3 px-3 text-center text-sm text-slate-400">${removidoEm}</td>
        <td class="py-3 px-3 text-center">
          <button class="btn-restaurar px-3 py-1.5 bg-blue-50 text-primaria rounded-full text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1 mx-auto" data-review-id="${d.id}">
            <i class="ph-bold ph-arrow-counter-clockwise"></i> Restaurar
          </button>
        </td>`;
      fragmento.appendChild(tr);
    });

    if (tbody) {
      tbody.innerHTML = '';
      tbody.appendChild(fragmento);

      tbody.querySelectorAll('.btn-restaurar').forEach(btn => {
        btn.addEventListener('click', async () => {
          await FeedbackAPI.restaurarAvaliacao(btn.dataset.reviewId);
          btn.closest('tr').remove();
          if (tbody.children.length === 0) {
            if (tabela) tabela.classList.add('hidden');
            if (semRemovidos) semRemovidos.classList.remove('hidden');
          }
        });
      });
    }
  } catch (erro) {
    console.error('[ADMIN] Erro comentarios removidos:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

function configurarFiltrosAdmin() {
  // Fotos Filtros
  const btnFiltroFoto = document.getElementById('btn-filtro-foto');
  const btnLimparFoto = document.getElementById('btn-limpar-foto');
  
  if (btnFiltroFoto && btnLimparFoto) {
    btnFiltroFoto.addEventListener('click', async () => {
      filtrosFotos = {
        idEscola: document.getElementById('filtro-foto-escola').value.trim(),
        autor: document.getElementById('filtro-foto-usuario').value.trim(),
        dataInicio: document.getElementById('filtro-foto-inicio').value,
        dataFim: document.getElementById('filtro-foto-fim').value
      };
      // Reload both tab lists
      await carregarFotosPendentes();
      await carregarFotosAprovadas();
    });
    
    btnLimparFoto.addEventListener('click', async () => {
      document.getElementById('filtro-foto-escola').value = '';
      document.getElementById('filtro-foto-usuario').value = '';
      document.getElementById('filtro-foto-inicio').value = '';
      document.getElementById('filtro-foto-fim').value = '';
      filtrosFotos = {};
      await carregarFotosPendentes();
      await carregarFotosAprovadas();
    });
  }

  // Comentarios Filtros
  const btnFiltroComentario = document.getElementById('btn-filtro-comentario');
  const btnLimparComentario = document.getElementById('btn-limpar-comentario');

  if (btnFiltroComentario && btnLimparComentario) {
    btnFiltroComentario.addEventListener('click', async () => {
      filtrosComentarios = {
        idEscola: document.getElementById('filtro-comentario-escola').value.trim(),
        autor: document.getElementById('filtro-comentario-usuario').value.trim(),
        dataInicio: document.getElementById('filtro-comentario-inicio').value,
        dataFim: document.getElementById('filtro-comentario-fim').value
      };
      await carregarTodosComentarios();
      await carregarDenuncias();
      await carregarComentariosRemovidos();
    });

    btnLimparComentario.addEventListener('click', async () => {
      document.getElementById('filtro-comentario-escola').value = '';
      document.getElementById('filtro-comentario-usuario').value = '';
      document.getElementById('filtro-comentario-inicio').value = '';
      document.getElementById('filtro-comentario-fim').value = '';
      filtrosComentarios = {};
      await carregarTodosComentarios();
      await carregarDenuncias();
      await carregarComentariosRemovidos();
    });
  }
}

function configurarAbaUsuarios() {
  const btnBusca = document.getElementById('btn-busca-usuarios');
  const campoBusca = document.getElementById('busca-usuarios');
  if (btnBusca && campoBusca) {
    btnBusca.addEventListener('click', async () => {
      await carregarUsuarios(campoBusca.value.trim());
    });
    campoBusca.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await carregarUsuarios(campoBusca.value.trim());
      }
    });
  }
}

async function carregarUsuarios(busca = '') {
  const loader = document.getElementById('loader-usuarios');
  const tabela = document.getElementById('tabela-usuarios');
  const tbody = document.getElementById('tabela-usuarios-body');
  const semUsuarios = document.getElementById('sem-usuarios');

  if (!tbody) return;

  try {
    if (loader) loader.classList.remove('hidden');
    if (tabela) tabela.classList.add('hidden');
    if (semUsuarios) semUsuarios.classList.add('hidden');
    tbody.innerHTML = '';

    const usuarios = await listarUsuarios(busca);
    
    // Obter os status de moderacao correspondentes a cada usuario
    const queryMod = new Parse.Query('UserModeration');
    queryMod.containedIn('user', usuarios);
    const moderacoes = await queryMod.find();
    
    const mapaStatus = {};
    moderacoes.forEach(m => {
      const uPtr = m.get('user');
      if (uPtr) {
        mapaStatus[uPtr.id] = m.get('status') || 'active';
      }
    });

    if (loader) loader.classList.add('hidden');

    if (usuarios.length === 0) {
      if (semUsuarios) semUsuarios.classList.remove('hidden');
      return;
    }

    if (tabela) tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    usuarios.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      
      const nome = u.get('nomeExibicao') || 'Sem Nome';
      const email = u.get('email') || u.get('username') || '--';
      const cargo = u.get('role') || 'usuario';
      const cadastro = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '--';
      const status = mapaStatus[u.id] || 'active';
      
      let badgeStatus = '';
      if (status === 'blocked') {
        badgeStatus = '<span class="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Bloqueado</span>';
      } else if (status === 'suspended') {
        badgeStatus = '<span class="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Suspenso</span>';
      } else {
        badgeStatus = '<span class="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Ativo</span>';
      }

      tr.innerHTML = `
        <td class="py-3 px-3">
          <div class="font-semibold text-slate-800">${esc(nome)}</div>
          <div class="text-xs text-slate-400">${esc(email)}</div>
        </td>
        <td class="py-3 px-3 text-sm text-slate-500 uppercase font-bold text-xs">${esc(cargo)}</td>
        <td class="py-3 px-3 text-sm text-slate-500">${cadastro}</td>
        <td class="py-3 px-3 text-center">${badgeStatus}</td>
        <td class="py-3 px-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            ${status !== 'active' ? `
              <button class="btn-usuario-acao px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-bold hover:bg-green-100 transition-colors" data-user-id="${u.id}" data-action="active">
                Reativar
              </button>
            ` : `
              <button class="btn-usuario-acao px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-xs font-bold hover:bg-amber-100 transition-colors" data-user-id="${u.id}" data-action="suspended">
                Suspender
              </button>
              <button class="btn-usuario-acao px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-bold hover:bg-red-100 transition-colors" data-user-id="${u.id}" data-action="blocked">
                Bloquear
              </button>
            `}
          </div>
        </td>
      `;
      fragmento.appendChild(tr);
    });

    tbody.appendChild(fragmento);

    // Configurar cliques nas acoes de moderacao do usuario
    tbody.querySelectorAll('.btn-usuario-acao').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userId;
        const acao = btn.dataset.action;
        
        let confirmacao = false;
        if (acao === 'blocked') {
          confirmacao = confirm('Tem certeza que deseja BLOQUEAR este usuário? Ele será deslogado imediatamente.');
        } else if (acao === 'suspended') {
          confirmacao = confirm('Tem certeza que deseja SUSPENDER temporariamente este usuário? Ele será deslogado imediatamente.');
        } else {
          confirmacao = confirm('Deseja reativar esta conta de usuário?');
        }

        if (confirmacao) {
          const ok = await atualizarStatusUsuario(userId, acao);
          if (ok) {
            await carregarUsuarios(busca);
          } else {
            alert('Falha ao atualizar o status do usuário.');
          }
        }
      });
    });

  } catch (erro) {
    console.error('[ADMIN] Erro ao carregar usuarios:', erro);
    if (loader) loader.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
