/**
 * src/js/ui/config.js
 * Responsabilidade: Configurações do usuário — login/registo, avatar, toggle modo escuro sem FOUC
 */

import estado from '../core/estado.js';
import * as AuthAPI from '../api/auth.api.js';
import { mostrarAlerta, mostrarPrompt, mostrarFormulario, mostrarConfirmacao } from './modal.ui.js';
import { PARSE_CONFIG } from '../core/constantes.js';

Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
Parse.serverURL = PARSE_CONFIG.SERVER_URL;

async function iniciar() {
  /* Verifica sessao existente */
  const usuario = Parse.User.current();
  if (usuario) {
    estado.definir('usuarioAtual', usuario);
    mostrarSecaoLogado(usuario);
  } else {
    mostrarSecaoDeslogado();
  }

  configurarAbas();
  configurarLogin();
  configurarRegisto();
  configurarResetSenha();
  configurarToggleSenha();
}

/* --- Sessoes --- */
function mostrarSecaoDeslogado() {
  document.getElementById('secao-deslogado').classList.remove('hidden');
  document.getElementById('secao-logado').classList.add('hidden');
}

function mostrarSecaoLogado(usuario) {
  document.getElementById('secao-deslogado').classList.add('hidden');
  document.getElementById('secao-logado').classList.remove('hidden');

  document.getElementById('info-usuario-nome').textContent = usuario.get('nomeExibicao') || usuario.get('username');
  document.getElementById('info-usuario-email').textContent = usuario.get('email') || '';

  atualizarAvatar(usuario);
  configurarUploadAvatar();
  configurarRemoverAvatar(usuario);
  configurarEditarNome(usuario);
  configurarLogout();
}

/* --- Login --- */
function configurarLogin() {
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');

    try {
      const usuario = await AuthAPI.login(email, senha);
      erroEl.classList.add('hidden');
      window.location.href = 'index.html';
    } catch (erro) {
      erroEl.textContent = erro.message || 'Email ou senha inválidos.';
      erroEl.classList.remove('hidden');
    }
  });
}

/* --- Registo --- */
function configurarRegisto() {
  document.getElementById('form-registo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('registo-nome').value.trim();
    const email = document.getElementById('registo-email').value.trim();
    const senha = document.getElementById('registo-senha').value;
    const erroEl = document.getElementById('registo-erro');
    const sucessoEl = document.getElementById('registo-sucesso');

    if (senha.length < 6) {
      erroEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      erroEl.classList.remove('hidden');
      return;
    }

    try {
      const usuario = await AuthAPI.registar(email, senha, nome);
      erroEl.classList.add('hidden');
      sucessoEl.classList.remove('hidden');
      setTimeout(() => {
        sucessoEl.classList.add('hidden');
        window.location.href = 'index.html';
      }, 1500);
    } catch (erro) {
      erroEl.textContent = erro.message || 'Erro ao criar conta.';
      erroEl.classList.remove('hidden');
    }
  });
}

/* --- Logout --- */
function configurarLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await AuthAPI.logout();
    mostrarSecaoDeslogado();
  });
}

/* --- Avatar com Pica.js --- */
function atualizarAvatar(usuario) {
  const container = document.getElementById('container-avatar');
  const foto = usuario.get('profilePhoto');
  if (foto && foto.url) {
    container.innerHTML = `<img src="${foto.url()}" alt="" class="w-full h-full object-cover pointer-events-none select-none" style="-webkit-user-drag: none; user-drag: none;" oncontextmenu="return false;">`;
  } else {
    container.innerHTML = `<i class="ph-fill ph-user text-4xl text-slate-400"></i>`;
  }
}

function configurarUploadAvatar() {
  document.getElementById('btn-upload-avatar').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const btnUpload = document.getElementById('btn-upload-avatar');
      const textoOriginal = btnUpload?.innerHTML || '';
      if (btnUpload) btnUpload.innerHTML = '<i class="ph-bold ph-spinner animate-spin"></i> Enviando...';

      try {
        const croppedBlob = await _mostrarModalCropAvatar(file);
        if (!croppedBlob) {
          if (btnUpload) btnUpload.innerHTML = textoOriginal;
          return;
        }

        const parseFile = new Parse.File(`avatar-${Date.now()}.jpg`, croppedBlob);
        await AuthAPI.atualizarAvatar(parseFile);

        const usuarioAtualizado = estado.obter('usuarioAtual');
        atualizarAvatar(usuarioAtualizado);

        const btnRemover = document.getElementById('btn-remover-avatar');
        if (btnRemover) btnRemover.style.display = 'inline-flex';
      } catch (erro) {
        console.error('[CONFIG] Erro upload avatar:', erro);
        await mostrarAlerta('Erro ao processar a imagem. Tente novamente.', 'Erro');
      } finally {
        if (btnUpload) btnUpload.innerHTML = textoOriginal;
      }
    };
    input.click();
  });
}

function _mostrarModalCropAvatar(file) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.85);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    document.body.appendChild(modal);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    let zoomVal = 1.0;
    let offsetValX = 0;
    let offsetValY = 0;
    let isDragging = false;
    let startX = 0, startY = 0;

    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:400px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);display:flex;flex-direction:column;gap:16px;user-select:none;" onclick="event.stopPropagation()">
        <h3 style="font-family:'Poppins',sans-serif;font-weight:700;font-size:18px;color:#1e293b;margin:0;">Ajustar Foto de Perfil</h3>
        <p style="font-size:12px;color:#64748b;margin:0;">Arraste para reposicionar. Use o zoom para ajustar o enquadramento:</p>
        <div id="crop-preview-wrap" style="position:relative;width:100%;aspect-ratio:1/1;background:#0f172a;border-radius:12px;overflow:hidden;cursor:move;border:2px solid #e2e8f0;">
          <canvas id="crop-canvas-avatar" style="width:100%;height:100%;display:block;pointer-events:none;"></canvas>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <label style="font-size:11px;font-weight:600;color:#64748b;display:flex;justify-content:space-between;">Zoom <span id="zoom-val-txt">100%</span></label>
          <input type="range" id="crop-zoom-slider" min="1" max="3" step="0.05" value="1" style="width:100%;cursor:pointer;">
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;">
          <button id="crop-cancelar" style="padding:8px 18px;background:none;border:none;font-size:14px;font-weight:600;color:#64748b;cursor:pointer;border-radius:999px;">Cancelar</button>
          <button id="crop-confirmar" style="padding:8px 20px;background:#1A5691;color:#fff;border:none;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;">Confirmar</button>
        </div>
      </div>
    `;

    const wrap = modal.querySelector('#crop-preview-wrap');
    const canvas = modal.querySelector('#crop-canvas-avatar');
    const ctx = canvas.getContext('2d');
    const slider = modal.querySelector('#crop-zoom-slider');
    const zoomTxt = modal.querySelector('#zoom-val-txt');

    const render = () => {
      if (!img.naturalWidth) return;
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const cropSize = lado / zoomVal;
      const maxOff = (Math.min(img.naturalWidth, img.naturalHeight) - cropSize) / 2;
      const clampedX = Math.max(-maxOff, Math.min(maxOff, ((img.naturalWidth - cropSize) / 2) + offsetValX));
      const clampedY = Math.max(-maxOff, Math.min(maxOff, ((img.naturalHeight - cropSize) / 2) + offsetValY));
      canvas.width = 512; canvas.height = 512;
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(img, clampedX, clampedY, cropSize, cropSize, 0, 0, 512, 512);
    };

    img.onload = render;

    slider.oninput = (ev) => {
      zoomVal = parseFloat(ev.target.value);
      zoomTxt.textContent = `${Math.round(zoomVal * 100)}%`;
      render();
    };

    wrap.addEventListener('mousedown', (ev) => { isDragging = true; startX = ev.clientX; startY = ev.clientY; ev.preventDefault(); });
    window.addEventListener('mousemove', (ev) => {
      if (!isDragging) return;
      const scale = img.naturalWidth / wrap.offsetWidth;
      offsetValX -= (ev.clientX - startX) * scale / zoomVal;
      offsetValY -= (ev.clientY - startY) * scale / zoomVal;
      startX = ev.clientX; startY = ev.clientY;
      render();
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Touch support
    wrap.addEventListener('touchstart', (ev) => { isDragging = true; startX = ev.touches[0].clientX; startY = ev.touches[0].clientY; ev.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', (ev) => {
      if (!isDragging) return;
      const scale = img.naturalWidth / wrap.offsetWidth;
      offsetValX -= (ev.touches[0].clientX - startX) * scale / zoomVal;
      offsetValY -= (ev.touches[0].clientY - startY) * scale / zoomVal;
      startX = ev.touches[0].clientX; startY = ev.touches[0].clientY;
      render();
    }, { passive: true });
    window.addEventListener('touchend', () => { isDragging = false; });

    modal.querySelector('#crop-cancelar').onclick = () => { URL.revokeObjectURL(objectUrl); modal.remove(); resolve(null); };
    modal.querySelector('#crop-confirmar').onclick = () => {
      canvas.toBlob((blob) => { URL.revokeObjectURL(objectUrl); modal.remove(); resolve(blob); }, 'image/jpeg', 0.9);
    };
  });
}

function configurarRemoverAvatar(usuario) {
  const btnRemover = document.getElementById('btn-remover-avatar');
  if (!btnRemover) return;

  const foto = usuario.get('profilePhoto');
  btnRemover.style.display = (foto && foto.url) ? 'inline-flex' : 'none';

  // Remove listeners anteriores
  const novoBtn = btnRemover.cloneNode(true);
  btnRemover.parentNode.replaceChild(novoBtn, btnRemover);

  novoBtn.addEventListener('click', async () => {
    const confirmou = await mostrarConfirmacao('Tem certeza de que deseja remover sua foto de perfil?', 'Remover Foto');
    if (confirmou) {
      try {
        await AuthAPI.removerAvatar();
        atualizarAvatar(estado.obter('usuarioAtual'));
        novoBtn.style.display = 'none';
        await mostrarAlerta('Foto de perfil removida com sucesso!', 'Sucesso');
      } catch (erro) {
        console.error('[CONFIG] Erro ao remover avatar:', erro);
        await mostrarAlerta('Erro ao remover a foto de perfil.', 'Erro');
      }
    }
  });
}

function configurarEditarNome(usuario) {
  const btnEditar = document.getElementById('btn-editar-nome');
  if (!btnEditar) return;

  // Remove listeners anteriores
  const novoBtn = btnEditar.cloneNode(true);
  btnEditar.parentNode.replaceChild(novoBtn, btnEditar);

  novoBtn.addEventListener('click', async () => {
    const nomeAtual = usuario.get('nomeExibicao') || usuario.get('username') || '';
    const novoNome = await mostrarPrompt('Digite seu novo nome de exibição:', 'Editar Nome', nomeAtual);
    if (novoNome !== null) {
      const nomeLimpo = novoNome.trim();
      if (!nomeLimpo) {
        await mostrarAlerta('O nome não pode ficar vazio.', 'Aviso');
        return;
      }
      try {
        usuario.set('nomeExibicao', nomeLimpo);
        await usuario.save();
        document.getElementById('info-usuario-nome').textContent = nomeLimpo;
        estado.definir('usuarioAtual', usuario);
        await mostrarAlerta('Nome atualizado com sucesso!', 'Sucesso');
      } catch (erro) {
        console.error('[CONFIG] Erro ao salvar nome:', erro);
        await mostrarAlerta('Erro ao salvar o nome.', 'Erro');
      }
    }
  });
}

/* --- Abas (Criar Conta / Entrar) --- */
function configurarAbas() {
  const tabCriar = document.getElementById('tab-criar-conta');
  const tabEntrar = document.getElementById('tab-entrar');
  const painelCriar = document.getElementById('painel-criar-conta');
  const painelEntrar = document.getElementById('painel-entrar');

  if (!tabCriar || !tabEntrar || !painelCriar || !painelEntrar) return;

  tabCriar.addEventListener('click', () => {
    painelCriar.classList.remove('hidden');
    painelEntrar.classList.add('hidden');
    tabCriar.classList.add('bg-white', 'shadow-sm', 'text-primaria');
    tabCriar.classList.remove('text-slate-500', 'hover:text-slate-700');
    tabEntrar.classList.remove('bg-white', 'shadow-sm', 'text-primaria');
    tabEntrar.classList.add('text-slate-500', 'hover:text-slate-700');
  });

  tabEntrar.addEventListener('click', () => {
    painelEntrar.classList.remove('hidden');
    painelCriar.classList.add('hidden');
    tabEntrar.classList.add('bg-white', 'shadow-sm', 'text-primaria');
    tabEntrar.classList.remove('text-slate-500', 'hover:text-slate-700');
    tabCriar.classList.remove('bg-white', 'shadow-sm', 'text-primaria');
    tabCriar.classList.add('text-slate-500', 'hover:text-slate-700');
  });
}

/* --- Esqueci a Senha --- */
function configurarResetSenha() {
  const link = document.getElementById('link-esqueci-senha');
  if (!link) return;

  link.addEventListener('click', async (e) => {
    e.preventDefault();

    const email = await mostrarFormulario(
      'Informe seu e-mail de cadastro',
      'email',
      'Redefinir Senha'
    );

    if (!email) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      await mostrarAlerta('Informe um e-mail válido.', 'E-mail Inválido');
      return;
    }

    const resultado = await AuthAPI.solicitarRedefinicaoSenha(email.trim());

    if (resultado.sucesso) {
      await mostrarAlerta('E-mail de redefinicao enviado com sucesso.', 'Sucesso');
    } else {
      await mostrarAlerta(resultado.mensagem, 'Erro');
    }
  });
}

/* --- Toggle Visibilidade de Senha --- */
function configurarToggleSenha() {
  const botoes = document.querySelectorAll('.toggle-senha');
  botoes.forEach(btn => {
    btn.addEventListener('click', () => {
      const alvoId = btn.getAttribute('data-alvo');
      const input = document.getElementById(alvoId);
      if (!input) return;

      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';

      const icone = btn.querySelector('i');
      if (icone) {
        icone.className = mostrar ? 'ph-bold ph-eye-slash' : 'ph-bold ph-eye';
      }
      btn.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
