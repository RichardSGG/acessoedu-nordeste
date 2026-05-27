/**
 * src/js/ui/admin.js
 * Responsabilidade: Painel admin — moderacao de fotos e comentarios denunciados
 *                   Verificacao de role === 'admin' na primeira linha
 */

import estado from '../core/estado.js';
import * as FotosAPI from '../api/fotos.api.js';
import * as FeedbackAPI from '../api/feedback.api.js';

Parse.initialize('8uIloIhmnqIK0y8P2vghyDGk20EX5wwnbBTxYAhk', 'o4wIFtX6xdbhdYX8PRfD57oOzN8ZkoLrA18Jxb93');
Parse.serverURL = 'https://parseapi.back4app.com';

async function iniciar() {
  /* Verificacao de role — primeira instrucao */
  const usuario = Parse.User.current();
  if (!usuario || usuario.get('role') !== 'admin') {
    window.location.href = 'index.html';
    return;
  }
  estado.definir('usuarioAtual', usuario);

  console.log('[ADMIN] Acesso autorizado:', usuario.get('username'));
  await carregarFotosPendentes();
  await carregarDenuncias();
}

/* --- Fotos Pendentes --- */
async function carregarFotosPendentes() {
  const loader = document.getElementById('loader-fotos');
  const tabela = document.getElementById('tabela-fotos');
  const tbody = document.getElementById('tabela-fotos-body');
  const semFotos = document.getElementById('sem-fotos');

  try {
    const fotos = await FotosAPI.listarPendentes();
    loader.classList.add('hidden');

    if (fotos.length === 0) {
      semFotos.classList.remove('hidden');
      return;
    }

    tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    fotos.forEach(foto => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-3 text-sm font-medium text-slate-700">${esc(foto.get('id_escola') || '--')}</td>
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

    tbody.innerHTML = '';
    tbody.appendChild(fragmento);

    /* Eventos */
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
  } catch (erro) {
    console.error('[ADMIN] Erro fotos:', erro);
    loader.classList.add('hidden');
  }
}

/* --- Comentarios Denunciados --- */
async function carregarDenuncias() {
  const loader = document.getElementById('loader-denuncias');
  const tabela = document.getElementById('tabela-denuncias');
  const tbody = document.getElementById('tabela-denuncias-body');
  const semDenuncias = document.getElementById('sem-denuncias');

  try {
    const denuncias = await FeedbackAPI.listarDenunciadas();
    loader.classList.add('hidden');

    if (denuncias.length === 0) {
      semDenuncias.classList.remove('hidden');
      return;
    }

    tabela.classList.remove('hidden');
    const fragmento = document.createDocumentFragment();

    denuncias.forEach(d => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100';
      tr.innerHTML = `
        <td class="py-3 px-3 text-sm text-slate-700 max-w-xs truncate">${esc(d.get('mensagem') || '')}</td>
        <td class="py-3 px-3 text-sm text-slate-500">${esc(d.get('nome') || '--')}</td>
        <td class="py-3 px-3 text-center">
          <span class="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-bold">${d.get('flags_count') || 0}</span>
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
      btn.addEventListener('click', () => {
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
    loader.classList.add('hidden');
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

document.addEventListener('DOMContentLoaded', iniciar);
