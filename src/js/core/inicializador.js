/**
 * src/js/core/inicializador.js
 * Responsabilidade: Bootstrap da aplicação — auth UI global
 */

import estado from './estado.js';
import { verificarAdmin, verificarStatusUsuario } from '../api/auth.api.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('[CORE] AcessoEdu Nordeste inicializado.');

  /* Auth UI global */
  configurarAuthGlobal();
});

function configurarAuthGlobal() {
  try {
    const usuario = Parse.User.current();
    if (usuario) {
      estado.definir('usuarioAtual', usuario);
      usuario.fetch().then((u) => {
        estado.definir('usuarioAtual', u);
        atualizarHeaderAuth(u);
      }).catch(err => {
        console.error('[CORE] Erro ao sincronizar usuario:', err);
        atualizarHeaderAuth(usuario);
      });
    } else {
      atualizarHeaderAuth(null);
    }
  } catch (_) { /* Parse pode nao estar carregado ainda */ }

  estado.assinar('mudanca:usuarioAtual', atualizarHeaderAuth);

  /* Configura logout global */
  const btnLogout = document.getElementById('btn-logout-header');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        atualizarHeaderAuth(null);
        window.location.href = 'index.html';
      } catch (_) { /* Silencia */ }
    });
  }

  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  if (btnLogoutMobile) {
    btnLogoutMobile.addEventListener('click', async () => {
      try {
        await Parse.User.logOut();
        estado.definir('usuarioAtual', null);
        atualizarHeaderAuth(null);
        window.location.href = 'index.html';
      } catch (_) { /* Silencia */ }
    });
  }

  /* Controle do menu hamburguer */
  const btnHamburguer = document.getElementById('btn-hamburguer');
  const menuMobile = document.getElementById('menu-mobile');
  if (btnHamburguer && menuMobile) {
    // Destacar o link ativo no menu mobile
    const path = window.location.pathname;
    const paginaAtual = path.split('/').pop() || 'index.html';
    
    menuMobile.querySelectorAll('a').forEach(link => {
      const href = link.getAttribute('href');
      if (href === paginaAtual || (paginaAtual === '' && href === 'index.html')) {
        link.classList.remove('text-slate-600', 'font-medium');
        link.classList.add('text-primaria', 'font-bold');
      } else {
        link.classList.remove('text-primaria', 'font-bold');
        link.classList.add('text-slate-600', 'font-medium');
      }
    });

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

async function atualizarHeaderAuth(usuario) {
  const btnLogin = document.getElementById('btn-login');
  const avatarContainer = document.getElementById('avatar-usuario');
  const linkAdmin = document.getElementById('nav-admin-link') || document.getElementById('link-admin');
  const linkAdminMobile = document.getElementById('nav-admin-link-mobile') || document.getElementById('link-admin-mobile');
  const btnLogout = document.getElementById('btn-logout-header');
  const btnLogoutMobile = document.getElementById('btn-logout-mobile');
  const nomeUsuario = document.getElementById('nome-usuario-header');

  if (usuario) {
    // Verificar se o usuário está suspenso ou bloqueado
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
    
    // Mobile Auth UI
    if (btnLogoutMobile) btnLogoutMobile.classList.remove('hidden');

    try {
      const isAdmin = await verificarAdmin();
      if (linkAdmin) linkAdmin.style.display = isAdmin ? 'inline-block' : 'none';
      if (linkAdminMobile) linkAdminMobile.style.display = isAdmin ? 'block' : 'none';
    } catch (_) {
      if (linkAdmin) linkAdmin.style.display = 'none';
      if (linkAdminMobile) linkAdminMobile.style.display = 'none';
    }
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (avatarContainer) avatarContainer.classList.add('hidden');
    if (nomeUsuario) nomeUsuario.classList.add('hidden');
    if (linkAdmin) linkAdmin.style.display = 'none';
    if (linkAdminMobile) linkAdminMobile.style.display = 'none';
    if (btnLogout) btnLogout.classList.add('hidden');
    
    // Mobile Auth UI
    if (btnLogoutMobile) btnLogoutMobile.classList.add('hidden');
  }
}
