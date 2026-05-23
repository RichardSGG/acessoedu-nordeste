const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

// Extraindo as credenciais das variáveis de ambiente (injetadas via --env-file)
const APP_ID = process.env.APP_ID;
const MASTER_KEY = process.env.MASTER_KEY;

if (!APP_ID || !MASTER_KEY) {
    console.error("❌ ERRO: Credenciais não encontradas. Certifique-se de usar a flag --env-file=.env");
    process.exit(1);
}

// Caminho apontando para a pasta dados
const ARQUIVO_CSV = path.resolve(__dirname, 'dados', 'escolas_pronto_b4app.csv');

// Função para pausar o script (freio para não derrubar o Back4App)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function rodarImportacaoDefinitiva() {
    console.log("⏳ Lendo arquivo CSV da pasta dados...");
    const todasEscolas = [];

    // Lê o arquivo todo antes de começar a enviar
    await new Promise((resolve, reject) => {
        fs.createReadStream(ARQUIVO_CSV)
            .pipe(csv.parse({ headers: true }))
            .on('data', (row) => {
                const escola = { ...row };
                // Conversão de textos para números (0 ou 1)
                Object.keys(escola).forEach(key => {
                    if (key.startsWith('possui_') || key.startsWith('sinalizacao_') || 
                        key.includes('acessivel') || key.includes('especial') || 
                        key === 'status_funcionamento' || key === 'id_dependencia') {
                        escola[key] = parseInt(escola[key]) || 0;
                    }
                });
                todasEscolas.push(escola);
            })
            .on('end', resolve)
            .on('error', reject);
    });

    console.log(`✅ Arquivo lido com sucesso! Total: ${todasEscolas.length} escolas.`);
    console.log("🚀 Iniciando envio cadenciado com MASTER KEY (Lotes de 50 com pausa de 1.5s)...");

    const TAMANHO_LOTE = 50;
    let importadas = 0;

    // Loop que envia os dados respeitando o limite do servidor
    for (let i = 0; i < todasEscolas.length; i += TAMANHO_LOTE) {
        const lote = todasEscolas.slice(i, i + TAMANHO_LOTE);
        
        const requests = lote.map(escola => ({
            method: "POST",
            path: "/classes/Escola", 
            body: escola
        }));

        try {
            const response = await fetch('https://parseapi.back4app.com/batch', {
                method: 'POST',
                headers: {
                    'X-Parse-Application-Id': APP_ID,
                    'X-Parse-Master-Key': MASTER_KEY, // <-- Autenticação master ativada
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests })
            });

            if (response.ok) {
                const resultadoInterno = await response.json();
                
                // Checa se houve erro dentro do batch
                if (resultadoInterno[0] && resultadoInterno[0].error) {
                    console.error("\n🚨 ERRO INTERNO DO BANCO:");
                    console.error(resultadoInterno[0].error);
                    return;
                }

                importadas += lote.length;
                console.log(`📦 [SUCESSO REAL] Lote gravado na nuvem. Total: ${importadas} de ${todasEscolas.length}`);
            } else {
                console.error("❌ Erro HTTP:", await response.text());
                return;
            }
        } catch (error) {
            console.error("💥 Erro de rede:", error.message);
            return;
        }

        // O SEGREDO: Pausa de 1.5 segundos antes do próximo envio para respeitar o limite grátis!
        await sleep(1500); 
    }

    console.log("\n🎉 IMPORTAÇÃO COMPLETA FINALIZADA COM SUCESSO!");
}

rodarImportacaoDefinitiva();