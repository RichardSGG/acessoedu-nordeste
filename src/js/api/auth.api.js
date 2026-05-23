/**
 * src/js/api/auth.api.js
 * Responsabilidade: Gerenciamento de sessão e integração OAuth
 */

import estado from '../core/estado.js';

/**
 * Realiza login utilizando o Google Identity Services
 * @param {string} token - Token OAuth recebido do Google
 */
export async function loginGoogle(token) {
    try {
        // TODO: Implementar Parse.User.logInWith('google', ...)
        console.log('Stub: Login com Google', token);
        estado.definir('usuarioAtual', { id: 'fake_user' });
    } catch (erro) {
        console.error('Erro ao autenticar com Google:', erro);
    }
}

/**
 * Encerra a sessão do utilizador atual
 */
export async function logout() {
    try {
        // TODO: Implementar Parse.User.logOut()
        console.log('Stub: Logout efetuado');
        estado.definir('usuarioAtual', null);
    } catch (erro) {
        console.error('Erro ao sair:', erro);
    }
}

/**
 * Obtém os dados do utilizador atualmente autenticado, se existir
 */
export async function obterUsuarioAtual() {
    try {
        // TODO: Implementar Parse.User.current()
        console.log('Stub: Obter usuário atual');
        return null;
    } catch (erro) {
        console.error('Erro ao verificar sessão:', erro);
        return null;
    }
}
