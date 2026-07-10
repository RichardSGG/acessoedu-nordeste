/**
 * src/js/core/inicializador.js
 * Responsabilidade: Bootstrap da aplicação — auth UI global
 */

import estado from './estado.js';
import { verificarAdmin, verificarStatusUsuario } from '../api/auth.api.js';
import { PARSE_CONFIG } from './constantes.js';

/* Inicializa o Parse SDK globalmente para todas as páginas (inclui documentacao.html) */
if (!Parse.applicationId) {
  Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
  Parse.serverURL = PARSE_CONFIG.SERVER_URL;
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[CORE] AcessoEdu Nordeste inicializado.');

  /* Destaca link ativo no header desktop e mobile */
  _marcarNavAtivo();

  /* Auth UI global */
  configurarAuthGlobal();
});

/* Marca o link da página atual com cor de destaque */
function _marcarNavAtivo() {
  const pagina = window.location.pathname.split('/').pop() || 'index.html';

  /* Header desktop */
  document.querySelectorAll('.nav-header a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === pagina || (pagina === '' && href === 'index.html')) {
      link.classList.remove('text-slate-600', 'font-medium');
      link.classList.add('text-primaria', 'font-bold');
    }
  });

  /* Menu mobile */
  const menuMobile = document.getElementById('menu-mobile');
  if (menuMobile) {
    menuMobile.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === pagina || (pagina === '' && href === 'index.html')) {
        link.classList.remove('text-slate-600', 'font-medium');
        link.classList.add('text-primaria', 'font-bold');
      } else {
        link.classList.remove('text-primaria', 'font-bold');
        link.classList.add('text-slate-600', 'font-medium');
      }
    });
  }
}

function configurarAuthGlobal() {
  try {
    const usuario = Parse.User.current();
    if (usuario) {
      estado.definir('usuarioAtual', usuario);

      /* Aplica imediatamente do cache local — sem esperar fetch — para evitar flicker */
      _aplicarUILogado(usuario, _lerCacheAdmin());

      usuario.fetch().then(async (u) => {
        estado.definir('usuarioAtual', u);
        const isAdmin = await _verificarECachearAdmin();
        _aplicarUILogado(u, isAdmin);
      }).catch(err => {
        console.error('[CORE] Erro ao sincronizar usuario:', err);
      });
    } else {
      _limparCacheAdmin();
      _aplicarUIDeslogado();
    }
  } catch (_) { /* Parse pode nao estar carregado ainda */ }

  estado.assinar('mudanca:usuarioAtual', async (u) => {
    if (u) {
      const isAdmin = await _verificarECachearAdmin();
      _aplicarUILogado(u, isAdmin);
    } else {
      _limparCacheAdmin();
      _aplicarUIDeslogado();
    }
  });

  /* Logout header desktop */
  const btnLogout = document.getElementById('btn-logout-header');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        window.location.href = 'index.html';
      } catch (_) { /* Silencia */ }
    });
  }

  /* Logout mobile */
  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', async () => {
      try {
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        window.location.href = 'index.html';
      } catch (_) { /* Silencia */ }
    });
  }

  /* Controle do menu hamburguer */
  const btnHamburguer = document.getElementById('btn-hamburguer');
  const menuMobile = document.getElementById('menu-mobile');
  if (btnHamburguer && menuMobile) {
    btnHamburguer.addEventListener('click', (e) => {
      e.stopPropagation();
      menuMobile.classList.toggle('aberto');
    });

    document.addEventListener('click', (e) => {
      if (!menuMobile.contains(e.target) && !btnHamburguer.contains(e.target)) {
        menuMobile.classList.remove('aberto');
      }
    });

    menuMobile.querySelectorAll('a, button').forEach(el => {
      el.addEventListener('click', () => {
        menuMobile.classList.remove('aberto');
      });
    });
  }
}

/* ─── Cache de admin no localStorage para link Admin sem piscar ─── */

function _lerCacheAdmin() {
  try { return localStorage.getItem('acessoedu:isAdmin') === '1'; } catch (_) { return false; }
}

function _limparCacheAdmin() {
  try { localStorage.removeItem('acessoedu:isAdmin'); } catch (_) {}
}

async function _verificarECachearAdmin() {
  try {
    const isAdmin = await verificarAdmin();
    try { localStorage.setItem('acessoedu:isAdmin', isAdmin ? '1' : '0'); } catch (_) {}
    return isAdmin;
  } catch (_) {
    return _lerCacheAdmin();
  }
}

/* ─── Funções de UI ─── */

function _aplicarUILogado(usuario, isAdmin) {
  const btnLogin         = document.getElementById('btn-login');
  const avatarContainer  = document.getElementById('avatar-usuario');
  const linkAdmin        = document.getElementById('nav-admin-link') || document.getElementById('link-admin');
  const linkAdminMobile  = document.getElementById('nav-admin-link-mobile') || document.getElementById('link-admin-mobile');
  const btnLogout        = document.getElementById('btn-logout-header');
  const btnLogoutMobile  = document.getElementById('btn-logout-mobile');
  const nomeUsuario      = document.getElementById('nome-usuario-header');

  /* Verificar suspensão/bloqueio em background */
  verificarStatusUsuario(usuario).then(async (status) => {
    if (status === 'suspended' || status === 'blocked') {
      await Parse.User.logOut();
      estado.definir('usuarioAtual', null);
      alert(status === 'blocked'
        ? 'Esta conta foi bloqueada por um administrador.'
        : 'Esta conta está temporariamente suspensa.');
      window.location.href = 'index.html';
    }
  });

  if (btnLogin) btnLogin.classList.add('hidden');

  if (avatarContainer) {
    avatarContainer.classList.remove('hidden');
    const foto = usuario.get('profilePhoto');
    if (foto && foto.url) {
      avatarContainer.innerHTML = `<img src="${foto.url()}" alt="" class="w-full h-full object-cover pointer-events-none select-none" style="-webkit-user-drag: none; user-drag: none;" oncontextmenu="return false;">`;
    } else {
      avatarContainer.innerHTML = `<i class="ph-fill ph-user text-xl text-slate-500"></i>`;
    }
    avatarContainer.title = usuario.get('nomeExibicao') || usuario.get('username') || '';
  }

  if (nomeUsuario) {
    nomeUsuario.textContent = usuario.get('nomeExibicao') || usuario.get('username') || '';
    nomeUsuario.classList.remove('hidden');
    nomeUsuario.classList.add('hidden', 'lg:inline-block');
  }

  if (btnLogout) {
    btnLogout.classList.remove('hidden');
    btnLogout.classList.add('hidden', 'lg:flex');
  }

  if (btnLogoutMobile) btnLogoutMobile.classList.remove('hidden');

  /* Admin — já disponível do cache, atualiza silenciosamente */
  if (linkAdmin)       linkAdmin.style.display       = isAdmin ? 'inline-block' : 'none';
  if (linkAdminMobile) linkAdminMobile.style.display = isAdmin ? 'block'        : 'none';
}

function _aplicarUIDeslogado() {
  const btnLogin         = document.getElementById('btn-login');
  const avatarContainer  = document.getElementById('avatar-usuario');
  const linkAdmin        = document.getElementById('nav-admin-link') || document.getElementById('link-admin');
  const linkAdminMobile  = document.getElementById('nav-admin-link-mobile') || document.getElementById('link-admin-mobile');
  const btnLogout        = document.getElementById('btn-logout-header');
  const btnLogoutMobile  = document.getElementById('btn-logout-mobile');
  const nomeUsuario      = document.getElementById('nome-usuario-header');

  if (btnLogin)         btnLogin.classList.remove('hidden');
  if (avatarContainer)  avatarContainer.classList.add('hidden');
  if (nomeUsuario)      nomeUsuario.classList.add('hidden');
  if (linkAdmin)        linkAdmin.style.display = 'none';
  if (linkAdminMobile)  linkAdminMobile.style.display = 'none';
  if (btnLogout)        btnLogout.classList.add('hidden');
  if (btnLogoutMobile)  btnLogoutMobile.classList.add('hidden');
}
