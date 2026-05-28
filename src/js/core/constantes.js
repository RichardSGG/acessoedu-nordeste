/**
 * src/js/core/constantes.js
 * Responsabilidade: Armazenar enumerações, chaves de eventos e configurações globais
 */

export const EVENTOS = {
    ESCOLAS_CARREGADAS: 'mudanca:escolas',
    ESCOLA_SELECIONADA: 'mudanca:escolaSelecionada',
    FILTROS_ATUALIZADOS: 'mudanca:filtros',
    USUARIO_ATUALIZADO: 'mudanca:usuarioAtual',
    MODO_ESCURO: 'mudanca:modoEscuro',
    CARREGANDO: 'mudanca:carregando',
    NOTIFICACAO: 'notificacao:nova'
};

export const PAPEIS_USUARIO = {
    ADMIN: 'admin',
    USUARIO: 'user'
};

export const STATUS_FOTO = {
    PENDENTE: 'pending',
    APROVADA: 'approved',
    REJEITADA: 'rejected'
};

/* Credenciais Parse/Back4App — apenas App ID e JS Key (sem Master Key no frontend) */
export const PARSE_CONFIG = {
    APP_ID: 'pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj',
    JS_KEY: 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN',
    SERVER_URL: 'https://parseapi.back4app.com/parse/',
};

export const CONFIGURACOES = {
    LIMITE_CARREGAMENTO_ESCOLAS: 1000,
    RAIO_VERIFICACAO_LOCAL_KM: 0.5,
};
