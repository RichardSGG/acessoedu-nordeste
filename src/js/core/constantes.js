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

export const CONFIGURACOES = {
    LIMITE_CARREGAMENTO_ESCOLAS: 1000,
    RAIO_VERIFICACAO_LOCAL_KM: 0.5
};
