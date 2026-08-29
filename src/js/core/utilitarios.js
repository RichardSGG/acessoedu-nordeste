/**
 * src/js/core/utilitarios.js
 * Responsabilidade: Funções utilitárias agnósticas (debounce, throttle, etc)
 */

/**
 * Cria uma função debounce que adia a execução até que o tempo de espera passe
 * sem novas invocações.
 * @param {Function} funcao - A função a ser debounced
 * @param {number} espera - O tempo de espera em milissegundos
 * @returns {Function}
 */
export function debounce(funcao, espera = 400) {
    let temporizador;
    return function (...args) {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcao.apply(this, args), espera);
    };
}

/**
 * Cria uma função throttle que limita a taxa de execução da função original.
 * @param {Function} funcao - A função a ser limitada
 * @param {number} limite - O limite de tempo em milissegundos
 * @returns {Function}
 */
export function throttle(funcao, limite = 200) {
    let ultimaExecucao = 0;
    return function (...args) {
        const agora = Date.now();
        if (agora - ultimaExecucao >= limite) {
            ultimaExecucao = agora;
            funcao.apply(this, args);
        }
    };
}

/**
 * Calcula a distância em quilômetros entre duas coordenadas (Fórmula de Haversine).
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distância em km
 */
export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const raioTerra = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return raioTerra * c;
}

/**
 * Escapa caracteres especiais de Expressão Regular para prevenir ReDoS e erros de sintaxe.
 * @param {string} texto
 * @returns {string} Texto sanitizado
 */
export function escaparRegex(texto) {
    if (!texto || typeof texto !== 'string') return '';
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sistema de Rate Limiting e Cooldowns no armazenamento local para proteção de endpoints e formulários.
 */
export const RateLimiter = {
    /**
     * Verifica se uma ação atingiu o limite de tentativas no período.
     * @param {string} chave - Identificador da ação (ex: 'login:tentativas', 'feedback:envio')
     * @param {number} maxTentativas - Número máximo permitido
     * @param {number} janelaMs - Janela de tempo em milissegundos
     * @returns {{ permitido: boolean, tempoRestanteMs: number, tentativasRestantes: number }}
     */
    verificar(chave, maxTentativas = 5, janelaMs = 60000) {
        try {
            const agora = Date.now();
            const dadosStr = localStorage.getItem(`acessoedu:rl:${chave}`);
            if (!dadosStr) {
                return { permitido: true, tempoRestanteMs: 0, tentativasRestantes: maxTentativas };
            }

            const dados = JSON.parse(dadosStr);
            const tentativasValidas = (dados.historico || []).filter(t => agora - t < janelaMs);

            if (tentativasValidas.length >= maxTentativas) {
                const maisAntiga = Math.min(...tentativasValidas);
                const tempoRestanteMs = Math.max(0, janelaMs - (agora - maisAntiga));
                return {
                    permitido: false,
                    tempoRestanteMs,
                    tentativasRestantes: 0
                };
            }

            return {
                permitido: true,
                tempoRestanteMs: 0,
                tentativasRestantes: maxTentativas - tentativasValidas.length
            };
        } catch (_) {
            return { permitido: true, tempoRestanteMs: 0, tentativasRestantes: maxTentativas };
        }
    },

    /**
     * Registra uma nova tentativa/execução de ação.
     */
    registrar(chave, janelaMs = 60000) {
        try {
            const agora = Date.now();
            const chaveCompleta = `acessoedu:rl:${chave}`;
            const dadosStr = localStorage.getItem(chaveCompleta);
            let historico = [];
            if (dadosStr) {
                const dados = JSON.parse(dadosStr);
                historico = (dados.historico || []).filter(t => agora - t < janelaMs);
            }
            historico.push(agora);
            localStorage.setItem(chaveCompleta, JSON.stringify({ historico }));
        } catch (_) {}
    },

    /**
     * Limpa o histórico de uma ação (ex: após login bem-sucedido).
     */
    limpar(chave) {
        try {
            localStorage.removeItem(`acessoedu:rl:${chave}`);
        } catch (_) {}
    }
};

/**
 * Validação rigorosa de arquivos de imagem no cliente (tipo e tamanho).
 * @param {File} arquivo
 * @param {number} tamanhoMaximoMB
 * @returns {{ valido: boolean, erro?: string }}
 */
export function validarArquivoImagem(arquivo, tamanhoMaximoMB = 5) {
    if (!arquivo) {
        return { valido: false, erro: 'Nenhum arquivo selecionado.' };
    }

    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(arquivo.type.toLowerCase())) {
        return {
            valido: false,
            erro: 'Formato inválido. Apenas imagens JPG, PNG ou WebP são permitidas.'
        };
    }

    const maxBytes = tamanhoMaximoMB * 1024 * 1024;
    if (arquivo.size > maxBytes) {
        return {
            valido: false,
            erro: `O arquivo excede o limite máximo de ${tamanhoMaximoMB}MB (tamanho atual: ${(arquivo.size / (1024 * 1024)).toFixed(1)}MB).`
        };
    }

    return { valido: true };
}

