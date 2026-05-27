/**
 * src/js/api/auth.api.js
 * Responsabilidade: Sessão do usuário — login, logout, verificação de role
 */

import estado from '../core/estado.js';
import { PAPEIS_USUARIO } from '../core/constantes.js';

const ERROS_PT = {
  'Invalid username/password.': 'Usuario ou senha invalidos.',
  'Invalid username/password': 'Usuario ou senha invalidos.',
  'Account already exists for this username.': 'Ja existe uma conta com este e-mail.',
  'Account already exists for this username': 'Ja existe uma conta com este e-mail.',
  'The email address is invalid.': 'O endereco de email e invalido.',
  'The email address is invalid': 'O endereco de email e invalido.',
  'Password must be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
  'Password must be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'Invalid email address.': 'Email invalido.',
  'Invalid email address': 'Email invalido.',
  'Network request failed': 'Erro de conexao. Verifique sua internet.',
};

function traduzirErro(erro) {
  const mensagem = erro?.message || '';
  if (ERROS_PT[mensagem]) {
    erro.message = ERROS_PT[mensagem];
  } else if (erro?.code === 101) {
    erro.message = 'Usuario ou senha invalidos.';
  } else if (erro?.code === 202) {
    erro.message = 'Ja existe uma conta com este e-mail.';
  } else if (erro?.code === 125) {
    erro.message = 'O endereco de email e invalido.';
  } else if (erro?.code === 100) {
    erro.message = 'Erro de conexao. Verifique sua internet.';
  }
  return erro;
}

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
    throw traduzirErro(erro);
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
    throw traduzirErro(erro);
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
 * Verifica se o usuario atual pertence a role 'admin' via Parse.Role.
 * Diferente de isAdmin(), esta funcao consulta o servidor e valida
 * membership real na Role, nao apenas o campo 'role' no objeto usuario.
 * @returns {Promise<boolean>}
 */
export async function verificarAdmin() {
  try {
    const usuario = Parse.User.current();
    if (!usuario) return false;

    /* Garante sessao valida */
    await usuario.fetch();

    /* Query na tabela interna de roles do Parse */
    const roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', 'admin');
    roleQuery.equalTo('users', usuario);

    const role = await roleQuery.first({ useMasterKey: false });
    return !!role;
  } catch (erro) {
    console.error('[auth.api] Erro ao verificar admin via Parse.Role:', erro);
    return false;
  }
}

/**
 * Solicita redefinicao de senha via email.
 * @param {string} email - Email da conta a recuperar
 * @returns {Promise<{sucesso: boolean, mensagem: string}>}
 */
export async function solicitarRedefinicaoSenha(email) {
  if (!email || !email.includes('@')) {
    return { sucesso: false, mensagem: 'Informe um endereco de email valido.' };
  }

  try {
    await Parse.User.requestPasswordReset(email.trim());
    return {
      sucesso: true,
      mensagem: 'Email de redefinicao enviado. Verifique sua caixa de entrada e spam.',
    };
  } catch (erro) {
    console.error('[auth.api] Erro ao solicitar redefinicao de senha:', erro);
    if (erro.code === 205) {
      return { sucesso: false, mensagem: 'Nenhuma conta encontrada com este email.' };
    }
    return { sucesso: false, mensagem: erro.message || 'Erro ao processar a solicitacao.' };
  }
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

