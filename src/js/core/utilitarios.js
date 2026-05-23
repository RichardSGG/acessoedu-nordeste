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
