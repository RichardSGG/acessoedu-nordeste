const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');

// Puxando as credenciais de forma segura do ambiente global
const APP_ID = process.env.BACK4APP_APP_ID;
const MASTER_KEY = process.env.BACK4APP_MASTER_KEY;

if (!APP_ID || !MASTER_KEY) {
    console.error("❌ Erro fatal: As chaves do arquivo .env não foram carregadas corretamente!");
    process.exit(1);
}

const ARQUIVO_CSV = path.resolve(__dirname, 'dados', 'escolas_pronto_b4app.csv');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function rodarImportacaoDefinitiva() {
    console.log("⏳ Lendo arquivo CSV da pasta dados...");
    const todasEscolas = [];

    await new Promise((resolve, reject) => {
        fs.createReadStream(ARQUIVO_CSV)
            .pipe(csv.parse({ headers: true }))
            .on('data', (row) => {
                const escola = { ...row };
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
    console.log("🚀 Iniciando envio seguro com MASTER KEY via variáveis de ambiente...");

    const TAMANHO_LOTE = 50;
    let importadas = 0;

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
                    'X-Parse-Master-Key': MASTER_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests })
            });

            if (response.ok) {
                const resultadoInterno = await response.json();
                
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

        await sleep(1500); 
    }

    console.log("\n🎉 PARABÉNS! BANCO DE DADOS POPULADO COM SUCESSO!");
}

rodarImportacaoDefinitiva();