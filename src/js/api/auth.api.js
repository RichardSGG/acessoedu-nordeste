/**
 * src/js/api/auth.api.js
 * Responsabilidade: Sessao do usuario — login, logout, verificacao de role
 */

import estado from '../core/estado.js';
import { PAPEIS_USUARIO } from '../core/constantes.js';

/**
 * Inicializa a sessao a partir do usuario atual do Parse
 */
export async function inicializarSessao() {
  try {
    const usuario = Parse.User.current();
    if (usuario) {
      await usuario.fetch();
      estado.definir('usuarioAtual', usuario);
      return usuario;
    }
    estado.definir('usuarioAtual', null);
    return null;
  } catch (erro) {
    console.error('[auth.api] Erro ao inicializar sessao:', erro);
    estado.definir('usuarioAtual', null);
    return null;
  }
}

/**
 * Login com email e senha
 */
export async function login(email, senha) {
  try {
    const usuario = await Parse.User.logIn(email, senha);
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    console.error('[auth.api] Erro no login:', erro);
    throw erro;
  }
}

/**
 * Login com Google OAuth
 */
export async function loginGoogle(token) {
  try {
    /* O Parse suporta logInWith para provedores configurados no Back4App */
    const usuario = await Parse.User.logInWith('google', {
      authData: { id_token: token, access_token: token }
    });
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    console.error('[auth.api] Erro no login Google:', erro);
    throw erro;
  }
}

/**
 * Registo de novo usuario
 */
export async function registar(email, senha, nomeExibicao) {
  try {
    const usuario = new Parse.User();
    usuario.set('username', email);
    usuario.set('email', email);
    usuario.set('password', senha);
    usuario.set('nomeExibicao', nomeExibicao);
    usuario.set('karmaPoints', 0);
    usuario.set('role', PAPEIS_USUARIO.USUARIO);
    await usuario.signUp();
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    console.error('[auth.api] Erro no registo:', erro);
    throw erro;
  }
}

/**
 * Logout
 */
export async function logout() {
  try {
    await Parse.User.logOut();
    estado.definir('usuarioAtual', null);
  } catch (erro) {
    console.error('[auth.api] Erro no logout:', erro);
  }
}

/**
 * Verifica se usuario atual e admin
 */
export function isAdmin() {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) return false;
  return usuario.get('role') === PAPEIS_USUARIO.ADMIN;
}

/**
 * Atualiza avatar do usuario
 */
export async function atualizarAvatar(parseFile) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuario nao autenticado');

  try {
    usuario.set('profilePhoto', parseFile);
    await usuario.save();
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    console.error('[auth.api] Erro ao atualizar avatar:', erro);
    throw erro;
  }
}

/**
 * Atualiza preferencia de tema
 */
export async function atualizarTema(modoEscuro) {
  const usuario = estado.obter('usuarioAtual');
  if (usuario) {
    try {
      usuario.set('modoEscuro', modoEscuro);
      await usuario.save();
    } catch (erro) {
      console.error('[auth.api] Erro ao salvar tema:', erro);
    }
  }
  estado.definir('modoEscuro', modoEscuro);
}
