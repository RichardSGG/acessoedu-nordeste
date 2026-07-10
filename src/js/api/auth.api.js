/**
 * src/js/api/auth.api.js
 * Responsabilidade: Sessão do usuário — login, logout, verificação de role
 */

import estado from '../core/estado.js';
import { PAPEIS_USUARIO } from '../core/constantes.js';

const ERROS_PT = {
  'Invalid username/password.': 'Usuário ou senha inválidos.',
  'Invalid username/password': 'Usuário ou senha inválidos.',
  'Account already exists for this username.': 'Já existe uma conta com este e-mail.',
  'Account already exists for this username': 'Já existe uma conta com este e-mail.',
  'The email address is invalid.': 'O endereço de email é inválido.',
  'The email address is invalid': 'O endereço de email é inválido.',
  'Password must be at least 6 characters.': 'A senha deve ter pelo menos 6 caracteres.',
  'Password must be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'Invalid email address.': 'Email inválido.',
  'Invalid email address': 'Email inválido.',
  'Network request failed': 'Erro de conexão. Verifique sua internet.',
};

function traduzirErro(erro) {
  const mensagem = erro?.message || '';
  if (ERROS_PT[mensagem]) {
    erro.message = ERROS_PT[mensagem];
  } else if (erro?.code === 101) {
    erro.message = 'Usuário ou senha inválidos.';
  } else if (erro?.code === 202) {
    erro.message = 'Já existe uma conta com este e-mail.';
  } else if (erro?.code === 125) {
    erro.message = 'O endereço de email é inválido.';
  } else if (erro?.code === 100) {
    erro.message = 'Erro de conexão. Verifique sua internet.';
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
    return { sucesso: false, mensagem: 'Informe um endereço de email válido.' };
  }

  try {
    await Parse.User.requestPasswordReset(email.trim());
    return {
      sucesso: true,
      mensagem: 'Email de redefinição enviado. Verifique sua caixa de entrada e spam.',
    };
  } catch (erro) {
    console.error('[auth.api] Erro ao solicitar redefinição de senha:', erro);
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
  if (!usuario) throw new Error('Usuário não autenticado');

  try {
    await parseFile.save();
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
 * Remove o avatar do usuario
 */
export async function removerAvatar() {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuário não autenticado');

  try {
    usuario.unset('profilePhoto');
    await usuario.save();
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    console.error('[auth.api] Erro ao remover avatar:', erro);
    throw erro;
  }
}

/**
 * Lista usuarios do Parse com suporte a busca
 */
export async function listarUsuarios(busca = '', limite = 50) {
  try {
    const query = new Parse.Query(Parse.User);
    if (busca) {
      const queryUsername = new Parse.Query(Parse.User);
      queryUsername.matches('username', busca, 'i');
      
      const queryEmail = new Parse.Query(Parse.User);
      queryEmail.matches('email', busca, 'i');
      
      const queryNome = new Parse.Query(Parse.User);
      queryNome.matches('nomeExibicao', busca, 'i');
      
      const mainQuery = Parse.Query.or(queryUsername, queryEmail, queryNome);
      mainQuery.descending('createdAt');
      mainQuery.limit(limite);
      return await mainQuery.find();
    }
    query.descending('createdAt');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[auth.api] Erro ao listar usuarios:', erro);
    return [];
  }
}

/**
 * Altera o status de moderacao de um usuario na tabela UserModeration
 */
export async function atualizarStatusUsuario(userId, status) {
  try {
    const userPointer = Parse.User.createWithoutData(userId);
    const query = new Parse.Query('UserModeration');
    query.equalTo('user', userPointer);
    let mod = await query.first();
    
    if (!mod) {
      mod = new Parse.Object('UserModeration');
      mod.set('user', userPointer);
    }
    mod.set('status', status);
    await mod.save();
    return true;
  } catch (erro) {
    console.error('[auth.api] Erro ao alterar status do usuario:', erro);
    return false;
  }
}

/**
 * Verifica o status de moderacao do usuario logado
 */
export async function verificarStatusUsuario(usuario) {
  if (!usuario) return 'active';
  try {
    const query = new Parse.Query('UserModeration');
    query.equalTo('user', usuario);
    const mod = await query.first();
    return mod ? mod.get('status') || 'active' : 'active';
  } catch (_) {
    return 'active';
  }
}

