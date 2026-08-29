/**
 * src/js/core/inicializador.js
 * Responsabilidade: Bootstrap da aplicação — auth UI global com sincronização instantânea (anti-flicker)
 */

import estado from './estado.js';
import { verificarAdmin, verificarStatusUsuario } from '../api/auth.api.js';
import { PARSE_CONFIG } from './constantes.js';

/* Inicializa o Parse SDK globalmente */
if (!Parse.applicationId) {
  Parse.initialize(PARSE_CONFIG.APP_ID, PARSE_CONFIG.JS_KEY);
  Parse.serverURL = PARSE_CONFIG.SERVER_URL;
}

/* Executa sincronização visual IMEDIATAMENTE na carga do script para evitar qualquer piscar */
_sincronizarUIRapida();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _inicializarApp);
} else {
  _inicializarApp();
}

function _inicializarApp() {
  console.log('[CORE] AcessoEdu Nordeste inicializado.');
  _sincronizarUIRapida();
  configurarAuthGlobal();
}

/* Marca o link da página atual com cor de destaque de forma instantânea */
function _marcarNavAtivo() {
  const rawPath = window.location.pathname.replace(/\/$/, '') || '/';
  const paginaAtual = (rawPath.split('/').pop() || 'index').replace(/\.html$/, '');

  /* Header desktop */
  document.querySelectorAll('.nav-header a').forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/^\//, '').replace(/\.html$/, '');
    const isHome = (href === '' || href === 'index') && (paginaAtual === '' || paginaAtual === 'index');
    if (href === paginaAtual || isHome) {
      link.classList.remove('text-slate-600', 'font-medium');
      link.classList.add('text-primaria', 'font-bold');
    } else {
      link.classList.remove('text-primaria', 'font-bold');
      link.classList.add('text-slate-600', 'font-medium');
    }
  });

  /* Menu mobile */
  const menuMobile = document.getElementById('menu-mobile');
  if (menuMobile) {
    menuMobile.querySelectorAll('a').forEach(link => {
      const href = (link.getAttribute('href') || '').replace(/^\//, '').replace(/\.html$/, '');
      const isHome = (href === '' || href === 'index') && (paginaAtual === '' || paginaAtual === 'index');
      if (href === paginaAtual || isHome) {
        link.classList.remove('text-slate-600', 'font-medium');
        link.classList.add('text-primaria', 'font-bold');
      } else {
        link.classList.remove('text-primaria', 'font-bold');
        link.classList.add('text-slate-600', 'font-medium');
      }
    });
  }
}

/* Remove .html da barra de endereço de forma limpa sem causar recarregamento ou erro de 404 */
function _limparExtensaoUrl() {
  try {
    if (window.location.pathname.endsWith('.html')) {
      const cleanPath = window.location.pathname.replace(/\.html$/, '') + window.location.search + window.location.hash;
      window.history.replaceState(null, '', cleanPath);
    }
  } catch (_) {}
}

/* Aplicação instantânea de dados em cache para eliminar flicker visual no header */
function _sincronizarUIRapida() {
  _limparExtensaoUrl();
  _marcarNavAtivo();

  try {
    const usuario = Parse.User.current();
    if (usuario) {
      const nomeCache = localStorage.getItem('acessoedu:user:nome') || usuario.get('nomeExibicao') || usuario.get('username') || '';
      const fotoUrlCache = localStorage.getItem('acessoedu:user:avatar') || (usuario.get('profilePhoto')?.url ? usuario.get('profilePhoto').url() : '');
      const isAdminCache = localStorage.getItem('acessoedu:isAdmin') === '1' || (usuario.get('role') || '').toLowerCase() === 'admin' || usuario.get('isAdmin') === true;

      _renderizarHeaderLogado({ nome: nomeCache, fotoUrl: fotoUrlCache, isAdmin: isAdminCache });
    } else {
      _aplicarUIDeslogado();
    }
  } catch (_) { /* Silencioso */ }
}

function configurarAuthGlobal() {
  try {
    const usuario = Parse.User.current();
    if (usuario) {
      estado.definir('usuarioAtual', usuario);

      _sincronizarUIRapida();

      /* Atualiza dados do usuário em background */
      usuario.fetch().then(async (u) => {
        estado.definir('usuarioAtual', u);
        const isAdmin = await _verificarECachearAdmin();
        _aplicarUILogado(u, isAdmin);
      }).catch(err => {
        console.error('[CORE] Erro ao sincronizar usuario:', err);
      });
    } else {
      _limparCacheUsuario();
      _aplicarUIDeslogado();
    }
  } catch (_) { /* Silencioso */ }

  estado.assinar('mudanca:usuarioAtual', async (u) => {
    if (u) {
      const isAdmin = await _verificarECachearAdmin();
      _aplicarUILogado(u, isAdmin);
    } else {
      _limparCacheUsuario();
      _aplicarUIDeslogado();
    }
  });

  /* Logout header desktop */
  const btnLogout = document.getElementById('btn-logout-header');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        _limparCacheUsuario();
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        window.location.href = '/';
      } catch (_) { /* Silencia */ }
    });
  }

  /* Logout mobile */
  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', async () => {
      try {
        _limparCacheUsuario();
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        window.location.href = '/';
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

/* ─── Cache no localStorage para eliminação de flicker ─── */

function _lerCacheAdmin() {
  try { return localStorage.getItem('acessoedu:isAdmin') === '1'; } catch (_) { return false; }
}

function _limparCacheUsuario() {
  try {
    localStorage.removeItem('acessoedu:isAdmin');
    localStorage.removeItem('acessoedu:user:nome');
    localStorage.removeItem('acessoedu:user:avatar');
  } catch (_) {}
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

function _renderizarHeaderLogado({ nome, fotoUrl, isAdmin }) {
  const btnLogin         = document.getElementById('btn-login');
  const avatarContainer  = document.getElementById('avatar-usuario');
  const linkAdmin        = document.getElementById('nav-admin-link') || document.getElementById('link-admin');
  const linkAdminMobile  = document.getElementById('nav-admin-link-mobile') || document.getElementById('link-admin-mobile');
  const btnLogout        = document.getElementById('btn-logout-header');
  const btnLogoutMobile  = document.getElementById('btn-logout-mobile');
  const nomeUsuario      = document.getElementById('nome-usuario-header');

  if (btnLogin) btnLogin.classList.add('hidden');

  if (avatarContainer) {
    avatarContainer.classList.remove('hidden');
    if (fotoUrl) {
      avatarContainer.innerHTML = `<img src="${fotoUrl}" alt="" class="w-full h-full object-cover pointer-events-none select-none" style="-webkit-user-drag: none; user-drag: none;" oncontextmenu="return false;">`;
    } else {
      avatarContainer.innerHTML = `<i class="ph-fill ph-user text-xl text-slate-500"></i>`;
    }
    avatarContainer.title = nome;
  }

  if (nomeUsuario) {
    nomeUsuario.textContent = nome;
    nomeUsuario.classList.remove('hidden');
    nomeUsuario.classList.add('hidden', 'lg:inline-block');
  }

  if (btnLogout) {
    btnLogout.classList.remove('hidden');
    btnLogout.classList.add('hidden', 'lg:flex');
  }

  if (btnLogoutMobile) btnLogoutMobile.classList.remove('hidden');

  if (linkAdmin)       linkAdmin.style.display       = isAdmin ? 'inline-block' : 'none';
  if (linkAdminMobile) linkAdminMobile.style.display = isAdmin ? 'block'        : 'none';
}

function _aplicarUILogado(usuario, isAdmin) {
  const nome = usuario.get('nomeExibicao') || usuario.get('username') || '';
  const foto = usuario.get('profilePhoto');
  const fotoUrl = foto && foto.url ? foto.url() : '';

  try {
    localStorage.setItem('acessoedu:user:nome', nome);
    if (fotoUrl) localStorage.setItem('acessoedu:user:avatar', fotoUrl);
  } catch (_) {}

  _renderizarHeaderLogado({ nome, fotoUrl, isAdmin });

  /* Verificar suspensão/bloqueio em background */
  verificarStatusUsuario(usuario).then(async (status) => {
    if (status === 'suspended' || status === 'blocked') {
      await Parse.User.logOut();
      _limparCacheUsuario();
      estado.definir('usuarioAtual', null);
      alert(status === 'blocked'
        ? 'Esta conta foi bloqueada por um administrador.'
        : 'Esta conta está temporariamente suspensa.');
      window.location.href = '/';
    }
  });
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
