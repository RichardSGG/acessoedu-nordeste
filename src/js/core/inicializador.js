/**
 * src/js/core/inicializador.js
 * Responsabilidade: Bootstrap da aplicação — auth UI global
 */

import estado from './estado.js';
import { verificarAdmin } from '../api/auth.api.js';

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
    }
    atualizarHeaderAuth(usuario);
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
}

async function atualizarHeaderAuth(usuario) {
  const btnLogin = document.getElementById('btn-login');
  const avatarContainer = document.getElementById('avatar-usuario');
  const linkAdmin = document.getElementById('nav-admin-link') || document.getElementById('link-admin');
  const btnLogout = document.getElementById('btn-logout-header');
  const nomeUsuario = document.getElementById('nome-usuario-header');
  if (usuario) {
    if (btnLogin) btnLogin.classList.add('hidden');
    if (avatarContainer) {
      avatarContainer.classList.remove('hidden');
      const foto = usuario.get('profilePhoto');
      if (foto && foto.url) {
        avatarContainer.innerHTML = `<img src="${foto.url()}" alt="Avatar" class="w-full h-full object-cover">`;
      }
      avatarContainer.title = usuario.get('nomeExibicao') || usuario.get('username') || '';
    }
    if (nomeUsuario) {
      nomeUsuario.textContent = usuario.get('nomeExibicao') || usuario.get('username') || '';
      nomeUsuario.classList.remove('hidden');
    }
    if (linkAdmin) {
      try {
        const isAdmin = await verificarAdmin();
        linkAdmin.style.display = isAdmin ? 'inline-block' : 'none';
      } catch (_) {
        linkAdmin.style.display = 'none';
      }
    }
    if (btnLogout) btnLogout.classList.remove('hidden');
  } else {
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (avatarContainer) avatarContainer.classList.add('hidden');
    if (nomeUsuario) nomeUsuario.classList.add('hidden');
    if (linkAdmin) linkAdmin.style.display = 'none';
    if (btnLogout) btnLogout.classList.add('hidden');
  }
}
