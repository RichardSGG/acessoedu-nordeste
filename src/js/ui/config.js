/**
 * src/js/ui/config.js
 * Responsabilidade: Configurações do usuário — login/registo, avatar (Pica.js),
 *                   barra de karma, toggle modo escuro sem FOUC
 */

import estado from '../core/estado.js';
import * as AuthAPI from '../api/auth.api.js';
import { mostrarAlerta, mostrarPrompt, mostrarFormulario } from './modal.ui.js';

Parse.initialize('pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj', 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN');
Parse.serverURL = 'https://parseapi.back4app.com/parse/';

const NIVEIS_KARMA = [
  { nome: 'Iniciante', max: 99 },
  { nome: 'Colaborador', max: 499 },
  { nome: 'Guardiao', max: 999 },
  { nome: 'Embaixador', max: Infinity },
];

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
  atualizarKarma(usuario);
  configurarUploadAvatar();
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
      mostrarSecaoLogado(usuario);
    } catch (erro) {
      erroEl.textContent = erro.message || 'Email ou senha invalidos.';
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
        mostrarSecaoLogado(usuario);
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
    container.innerHTML = `<img src="${foto.url()}" alt="Avatar" class="w-full h-full object-cover">`;
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

      try {
        /* Redimensiona com Pica.js */
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((resolve) => { img.onload = resolve; });

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;

        const pica = window.pica();
        await pica.resize(img, canvas);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        const parseFile = new Parse.File(`avatar-${Date.now()}.jpg`, blob);

        await AuthAPI.atualizarAvatar(parseFile);
        atualizarAvatar(estado.obter('usuarioAtual'));
      } catch (erro) {
        console.error('[CONFIG] Erro upload avatar:', erro);
        await mostrarAlerta('Erro ao processar imagem.', 'Erro');
      }
    };
    input.click();
  });
}

/* --- Karma Points --- */
function atualizarKarma(usuario) {
  const pontos = usuario.get('karmaPoints') || 0;
  let nivelAtual = NIVEIS_KARMA[0];
  let nivelProximo = NIVEIS_KARMA[1];
  let progresso = 0;

  for (let i = 0; i < NIVEIS_KARMA.length; i++) {
    if (pontos <= NIVEIS_KARMA[i].max) {
      nivelAtual = NIVEIS_KARMA[i];
      nivelProximo = NIVEIS_KARMA[i + 1] || NIVEIS_KARMA[i];
      const minimo = i === 0 ? 0 : NIVEIS_KARMA[i - 1].max + 1;
      const intervalo = NIVEIS_KARMA[i].max - minimo + 1;
      progresso = intervalo > 0 ? ((pontos - minimo) / intervalo) * 100 : 100;
      break;
    }
  }

  document.getElementById('karma-pontos').textContent = pontos.toLocaleString();
  document.getElementById('karma-nivel').textContent = `Nivel: ${nivelAtual.nome}`;
  document.getElementById('barra-karma').style.width = `${Math.min(100, Math.max(0, progresso))}%`;
  document.getElementById('karma-proximo').textContent =
    nivelProximo && nivelProximo.nome !== nivelAtual.nome
      ? `Proximo nivel: ${nivelProximo.nome} (${nivelProximo.max + 1} pontos)`
      : 'Nivel maximo alcancado';
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
      await mostrarAlerta('Informe um e-mail valido.', 'E-mail Invalido');
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
