/**
 * src/js/core/estado.js
 * Responsabilidade: Event Bus global da aplicação (Pub/Sub)
 */

const _estado = {
    escolas: [],
    escolaSelecionada: null,
    usuarioAtual: null,
    filtros: { estado: null, municipio: null, ano: 2025 },
    modoEscuro: false,
    carregando: false,
};

const _ouvintes = {};

const estado = {
    /**
     * Obtém um valor do estado global
     * @param {string} chave - A chave do estado
     * @returns {*}
     */
    obter(chave) {
        return _estado[chave];
    },

    /**
     * Define um valor no estado e emite o evento correspondente
     * @param {string} chave - A chave a ser atualizada
     * @param {*} valor - O novo valor
     */
    definir(chave, valor) {
        _estado[chave] = valor;
        this.emitir(`mudanca:${chave}`, valor);
    },

    /**
     * Emite um evento para todos os assinantes
     * @param {string} evento - O nome do evento
     * @param {*} dados - Dados opcionais a serem enviados
     */
    emitir(evento, dados) {
        if (!_ouvintes[evento]) return;
        _ouvintes[evento].forEach((callback) => callback(dados));
    },

    /**
     * Assina um evento para escutar as mudanças
     * @param {string} evento - O nome do evento
     * @param {Function} callback - A função a ser executada
     * @returns {Function} Função para cancelar a assinatura
     */
    assinar(evento, callback) {
        if (!_ouvintes[evento]) _ouvintes[evento] = [];
        _ouvintes[evento].push(callback);
        
        return () => {
            _ouvintes[evento] = _ouvintes[evento].filter((cb) => cb !== callback);
        };
    }
};

export default estado;
