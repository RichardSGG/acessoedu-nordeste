/**
 * src/js/api/auth.api.js
 * Responsabilidade: Sessão do usuário — login, logout, verificação de role
 */

import estado from '../core/estado.js';
import { PAPEIS_USUARIO } from '../core/constantes.js';
import { escaparRegex, RateLimiter, validarArquivoImagem } from '../core/utilitarios.js';

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
 * Login com email e senha com proteção contra força bruta
 */
export async function login(email, senha) {
  const checagemRateLimit = RateLimiter.verificar('login', 5, 300000); // 5 tentativas por 5 minutos
  if (!checagemRateLimit.permitido) {
    const segundosRestantes = Math.ceil(checagemRateLimit.tempoRestanteMs / 1000);
    throw new Error(`Muitas tentativas falhas. Por segurança, aguarde ${segundosRestantes} segundos antes de tentar novamente.`);
  }

  try {
    const usuario = await Parse.User.logIn(email.trim(), senha);
    RateLimiter.limpar('login');
    estado.definir('usuarioAtual', usuario);
    return usuario;
  } catch (erro) {
    RateLimiter.registrar('login', 300000);
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
 * Registo de novo usuario com rate limit
 */
export async function registar(email, senha, nomeExibicao) {
  const checagemRateLimit = RateLimiter.verificar('cadastro', 3, 60000);
  if (!checagemRateLimit.permitido) {
    throw new Error('Muitas tentativas de cadastro recentes. Aguarde 1 minuto.');
  }

  try {
    const usuario = new Parse.User();
    usuario.set('username', email.trim());
    usuario.set('email', email.trim());
    usuario.set('password', senha);
    usuario.set('nomeExibicao', (nomeExibicao || '').trim());
    usuario.set('role', PAPEIS_USUARIO.USUARIO);
    await usuario.signUp();
    RateLimiter.registrar('cadastro', 60000);
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
 * Verifica se o usuario atual possui perfil de administrador.
 * Valida a coluna 'role', 'isAdmin', 'tipo' diretamente no _User e
 * faz fallback para a tabela Parse.Role com timeout de segurança.
 * @returns {Promise<boolean>}
 */
export async function verificarAdmin() {
  try {
    const usuario = Parse.User.current();
    if (!usuario) return false;

    /* 1. Checagem direta e imediata nos atributos do objeto _User */
    const roleAttr = (usuario.get('role') || '').toLowerCase();
    const tipoAttr = (usuario.get('tipo') || '').toLowerCase();
    const isAdminAttr = usuario.get('isAdmin') === true || usuario.get('admin') === true;

    if (roleAttr === 'admin' || roleAttr === PAPEIS_USUARIO.ADMIN || tipoAttr === 'admin' || isAdminAttr) {
      return true;
    }

    /* 2. Tenta sincronizar os atributos do servidor caso tenha sido alterado recentemente */
    try {
      await Promise.race([
        usuario.fetch(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      const roleAtualizada = (usuario.get('role') || '').toLowerCase();
      const tipoAtualizado = (usuario.get('tipo') || '').toLowerCase();
      const isAdminAtualizado = usuario.get('isAdmin') === true || usuario.get('admin') === true;

      if (roleAtualizada === 'admin' || roleAtualizada === PAPEIS_USUARIO.ADMIN || tipoAtualizado === 'admin' || isAdminAtualizado) {
        return true;
      }
    } catch (_) { /* Timeout ou falha de rede silenciosa */ }

    /* 3. Checagem na tabela Parse.Role com timeout */
    try {
      const roleQuery = new Parse.Query(Parse.Role);
      roleQuery.equalTo('name', 'admin');
      roleQuery.equalTo('users', usuario);

      const role = await Promise.race([
        roleQuery.first({ useMasterKey: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      return !!role;
    } catch (_) {
      return false;
    }
  } catch (erro) {
    console.error('[auth.api] Erro ao verificar admin:', erro);
    const u = Parse.User.current();
    if (u && (u.get('role') === 'admin' || u.get('isAdmin') === true)) return true;
    return false;
  }
}

/**
 * Solicita redefinicao de senha via email com cooldown contra spam de e-mails.
 * @param {string} email - Email da conta a recuperar
 * @returns {Promise<{sucesso: boolean, mensagem: string}>}
 */
export async function solicitarRedefinicaoSenha(email) {
  if (!email || !email.includes('@')) {
    return { sucesso: false, mensagem: 'Informe um endereço de email válido.' };
  }

  const checagemRateLimit = RateLimiter.verificar('reset_senha', 1, 60000);
  if (!checagemRateLimit.permitido) {
    const segundos = Math.ceil(checagemRateLimit.tempoRestanteMs / 1000);
    return { sucesso: false, mensagem: `Aguarde ${segundos}s antes de solicitar outro email de redefinição.` };
  }

  try {
    await Parse.User.requestPasswordReset(email.trim());
    RateLimiter.registrar('reset_senha', 60000);
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
 * Atualiza avatar do usuario com validação estrita de imagem
 */
export async function atualizarAvatar(arquivo) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuário não autenticado');

  if (arquivo instanceof File) {
    const validacao = validarArquivoImagem(arquivo, 2); // max 2MB
    if (!validacao.valido) {
      throw new Error(validacao.erro);
    }
  }

  try {
    const parseFile = arquivo instanceof Parse.File ? arquivo : new Parse.File('avatar.jpg', arquivo);
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
 * Lista usuarios do Parse com suporte a busca segura contra ReDoS
 */
export async function listarUsuarios(busca = '', limite = 500) {
  try {
    const usuarioAtual = Parse.User.current();
    const opts = usuarioAtual ? { sessionToken: usuarioAtual.getSessionToken() } : {};

    if (busca) {
      const termoEscapado = escaparRegex(busca.trim());
      const queryUsername = new Parse.Query(Parse.User);
      queryUsername.matches('username', new RegExp(termoEscapado, 'i'));

      const queryEmail = new Parse.Query(Parse.User);
      queryEmail.matches('email', new RegExp(termoEscapado, 'i'));

      const queryNome = new Parse.Query(Parse.User);
      queryNome.matches('nomeExibicao', new RegExp(termoEscapado, 'i'));

      const mainQuery = Parse.Query.or(queryUsername, queryEmail, queryNome);
      mainQuery.descending('createdAt');
      mainQuery.limit(limite);
      return await mainQuery.find(opts);
    }

    const query = new Parse.Query(Parse.User);
    query.descending('createdAt');
    query.limit(limite);
    return await query.find(opts);
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

