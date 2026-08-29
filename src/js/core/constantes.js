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

import { ENV_CONFIG } from './config.env.js';

/* Credenciais Parse/Back4App — carregadas dinamicamente via build-env.js / .env com fallback de produção */
export const PARSE_CONFIG = {
    APP_ID: ENV_CONFIG?.APP_ID || 'pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj',
    JS_KEY: ENV_CONFIG?.JS_KEY || 'IqdU5hv1lyC9WN6vFqtuvIga2sehMrRyFPjXExdo',
    SERVER_URL: ENV_CONFIG?.SERVER_URL || 'https://parseapi.back4app.com/parse/',
};

export const CONFIGURACOES = {
    LIMITE_CARREGAMENTO_ESCOLAS: 1000,
    RAIO_VERIFICACAO_LOCAL_KM: 0.5,
};
