const Parse = require('parse/node');

// Inicialize com as chaves do seu painel do Back4App
Parse.initialize("SEU_APP_ID", "SUA_JAVASCRIPT_KEY");
Parse.serverURL = 'https://parseapi.back4app.com/';

async function salvarAvaliacaoExemplo() {
    // 1. Instancia a classe 'Avaliacoes'
    const AvaliacoesClass = Parse.Object.extend("Avaliacoes");
    const avaliacao = new AvaliacoesClass();

    // 2. Preenche os dados da auditoria cidadã
    avaliacao.set("id_escola", "12345678"); 
    avaliacao.set("autor_avaliacao", "João Silva");
    avaliacao.set("categoria_problema", "Falta de Água");
    avaliacao.set("comentario", "A escola está sem água potável nos bebedouros há 3 dias.");
    avaliacao.set("nota_atribuida", 1); 
    avaliacao.set("possui_evidencia", true);
    avaliacao.set("status_resolucao", "Aberto"); 
    
    // Campos de rastreio antifraude definidos pelo PLAN.md:
    avaliacao.set("latitude_envio", -8.047562);
    avaliacao.set("longitude_envio", -34.877002);
    avaliacao.set("verificado_local", true); 

    try {
        console.log("Enviando auditoria cidadã para o Back4App...");
        const result = await avaliacao.save();
        console.log(`✅ Avaliação salva com sucesso! ID no banco: ${result.id}`);
        console.log(`📅 Data da auditoria: ${result.createdAt}`);
    } catch (error) {
        console.error("❌ Erro ao salvar avaliação:", error.message);
    }
}

salvarAvaliacaoExemplo();
