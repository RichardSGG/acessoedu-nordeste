require('dotenv').config();
const Parse = require('parse/node');

// Configurações da API Back4App (Lidas do .env)
const APP_ID = process.env.APP_ID;
const JAVASCRIPT_KEY = process.env.JAVASCRIPT_KEY;

// Chave da API do Mapbox (Protegida)
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Inicializa a conexão com o banco de dados na Nuvem
Parse.initialize(APP_ID, JAVASCRIPT_KEY);
Parse.serverURL = 'https://parseapi.back4app.com/';

// ==========================================
// 🚨 FREIO DE MÃO DE EMERGÊNCIA (CUSTOS)
// Cota gratuita do Mapbox: 100.000 requisições / mês
// O script vai dar Fatal Error se bater 90k.
// ==========================================
const LIMITE_REQUISICOES_MAPBOX = 90000;

// Variáveis de métricas e estado global do script
let contadorRequisicoes = 0;
let metricas = {
    comSucesso: 0,
    naoEncontradas: 0,
    errosRede: 0
};

// Utilitário para pausa (Evitar rate limit extremo)
const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Função responsável por chamar a API do Mapbox e injetar a coordenada na escola
 */
async function buscarCoordenadasMapbox(escola) {
    // 🚨 REGRA CRÍTICA: PROTEÇÃO DE CARTÃO DE CRÉDITO
    if (contadorRequisicoes >= LIMITE_REQUISICOES_MAPBOX) {
        console.error(`\n🚨 ALERTA VERMELHO: O FREIO DE MÃO DE EMERGÊNCIA FOI PUXADO! 🚨`);
        console.error(`O script atingiu o limite de segurança predefinido de ${LIMITE_REQUISICOES_MAPBOX} requisições.`);
        console.error(`Para não ultrapassar a cota grátis mensal do Mapbox, a execução foi abortada IMEDIATAMENTE.`);
        process.exit(1); 
    }

    const nome = escola.get("nome");
    const cidade = escola.get("cidade");
    const uf = escola.get("uf");
    
    // Monta a string no padrão: Nome da Escola, Cidade, UF, Brasil
    const query = `${nome}, ${cidade}, ${uf}, Brasil`;
    
    // Configura a URL apontando apenas para o país BR (melhora a precisão)
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=BR&limit=1`;

    contadorRequisicoes++; // Incrementa IMEDIATAMENTE antes da requisição

    try {
        const resposta = await fetch(endpoint);
        
        if (!resposta.ok) {
            throw new Error(`Resposta HTTP ${resposta.status}: ${resposta.statusText}`);
        }

        const dados = await resposta.json();

        // O Mapbox sempre retorna um array 'features'. Se for vazio, ele não achou a escola.
        if (dados.features && dados.features.length > 0) {
            // ⚠️ ATENÇÃO: O Mapbox retorna as coordenadas invertidas no padrão [Longitude, Latitude]!
            const [lng, lat] = dados.features[0].center; 
            
            escola.set("latitude", lat);
            escola.set("longitude", lng);
            
            metricas.comSucesso++;
            return true;
        } else {
            // Se o Mapbox não souber onde fica, marcamos uma flag na escola
            // Assim o Parse não vai puxar ela de novo no próximo lote, evitando loop infinito.
            escola.set("geocodificacao_falhou", true);
            metricas.naoEncontradas++;
            return true;
        }

    } catch (erro) {
        metricas.errosRede++;
        console.error(`[Aviso] Falha de conexão ao buscar "${nome}": ${erro.message}`);
        // Retorna falso para não salvar o objeto pela metade no banco
        return false; 
    }
}

/**
 * Função Orquestradora que gerencia os lotes e a paginação do banco
 */
async function orquestrarGeocoding() {
    if (!MAPBOX_TOKEN) {
        console.error("🚨 ERRO FATAL: Variável MAPBOX_TOKEN não foi encontrada no .env!");
        console.error("Abra o arquivo .env, crie a variável MAPBOX_TOKEN=sua_chave_aqui e tente novamente.");
        process.exit(1);
    }

    console.log("\n=======================================================");
    console.log("🗺️ INICIANDO MOTOR DE GEOCODIFICAÇÃO (MAPBOX API)");
    console.log("=======================================================");
    console.log(`Lote de Processamento : 500 escolas por iteração`);
    console.log(`Freio de Segurança    : Parada forçada em ${LIMITE_REQUISICOES_MAPBOX} reqs`);
    console.log("=======================================================\n");

    const EscolasClass = Parse.Object.extend("Escolas");
    let processando = true;

    while (processando) {
        // Monta a Query limitando a memória do Node
        const query = new Parse.Query(EscolasClass);
        
        // Regra 1: Queremos APENAS quem NÃO TEM latitude salva ainda.
        // Como o script de upload salvou null explicitamente, temos que buscar por null.
        query.equalTo("latitude", null);
        
        // Regra 2: Ignorar escolas que o Mapbox já avisou que não tem no mapa (Evita gastar requisição a toa)
        query.notEqualTo("geocodificacao_falhou", true);
        
        // Lote de 500 escolas (Seguro para o Parse SDK em Node.js)
        query.limit(500);

        try {
            console.log("☁️ Buscando novo lote no Back4App...");
            const escolasLote = await query.find();

            if (escolasLote.length === 0) {
                console.log("\n✨ SUCESSO ABSOLUTO! Não há mais nenhuma escola no banco aguardando geocodificação.");
                processando = false;
                break;
            }

            console.log(`📦 Lote recebido! Mapeando ${escolasLote.length} escolas...`);
            
            // Variável temporária para segurar as escolas que deram certo (para salvar em massa depois)
            const escolasParaSalvar = [];

            for (let i = 0; i < escolasLote.length; i++) {
                const escola = escolasLote[i];
                
                // Faz a chamada para a API
                const sucesso = await buscarCoordenadasMapbox(escola);
                if (sucesso) {
                    escolasParaSalvar.push(escola);
                }

                // Feedback visual a cada 100 escolas processadas
                if ((i + 1) % 100 === 0) {
                    console.log(`   ⏳ Progresso do Lote: ${i + 1}/${escolasLote.length} (Consumo Acumulado API: ${contadorRequisicoes})`);
                }
                
                // Pausa de 25ms para aliviar a banda de rede e manter um throughput suave (40 req/segundo)
                await delay(25);
            }

            console.log(`💾 Enviando Lote finalizado de volta ao Back4App (Operação de Escrita)...`);
            // Operação atômica em massa
            await Parse.Object.saveAll(escolasParaSalvar);
            
            console.log(`\n📊 [RESUMO PARCIAL] Bateria de Métricas:`);
            console.log(`   ✅ Coordenadas Encontradas : ${metricas.comSucesso}`);
            console.log(`   ❌ Escolas Indocumentadas  : ${metricas.naoEncontradas}`);
            console.log(`   ⚠️ Erros de Rede/Timeouts  : ${metricas.errosRede}`);
            console.log(`   💰 Consumo da Cota Mapbox  : ${contadorRequisicoes} / ${LIMITE_REQUISICOES_MAPBOX}\n`);

        } catch (error) {
            console.error("\n❌ ERRO FATAL no Parse SDK. Pode ser queda de internet ou limite de lotes.");
            console.error("Detalhe do erro:", error.message);
            console.log("Tentando recuperar a operação em 5 segundos...");
            await delay(5000); // Tenta recuperar a rede antes de reiniciar o While
        }
    }
    
    console.log("\n=======================================================");
    console.log("🏁 PROCESSO GLOBAL FINALIZADO COM SEGURANÇA 🏁");
    console.log("=======================================================\n");
    // Aguarda um pequeno instante para os sockets de rede do Parse terminarem antes do exit, evitando o erro do UV_HANDLE_CLOSING
    setTimeout(() => process.exit(0), 100);
}

// Aciona a turbina
orquestrarGeocoding();
