// Inicialização do SDK do Back4App no Navegador
// ⚠️ ATENÇÃO: As chaves públicas podem ficar no JS frontend sem problemas (apenas a MASTER KEY deve ficar protegida).
Parse.initialize("8uIloIhmnqIK0y8P2vghyDGk20EX5wwnbBTxYAhk", "o4wIFtX6xdbhdYX8PRfD57oOzN8ZkoLrA18Jxb93");
Parse.serverURL = 'https://parseapi.back4app.com/';

// Inicializa o Mapa focado no Nordeste
const map = L.map('map').setView([-8.0, -38.0], 6);

// Adiciona a camada visual do OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Cria o grupo de agrupamento de marcadores (Crucial para performance de 51k pontos)
const markersCluster = L.markerClusterGroup();

async function carregarMapaEscolas() {
    console.log("Buscando escolas cadastradas na nuvem...");
    const EscolasClass = Parse.Object.extend("Escolas");
    const query = new Parse.Query(EscolasClass);
    
    // Limitamos inicialmente em 1000 registros para o mapa abrir instantaneamente nos testes
    query.limit(1000); 
    
    try {
        const resultados = await query.find();
        resultados.forEach(escola => {
            const lat = escola.get("latitude");
            const lng = escola.get("longitude");
            const nome = escola.get("nome");
            const cidade = escola.get("cidade");
            const notaInfra = escola.get("nota_infraestrutura");

            if (lat && lng) {
                const marker = L.marker([lat, lng]);
                marker.bindPopup(`
                    <div style="font-size: 14px;">
                        <strong>${nome}</strong><br>
                        <span>📍 ${cidade}</span><br>
                        <strong style="color: #2b6cb0;">🛠️ Nota Infraestrutura: ${notaInfra.toFixed(1)}/10</strong>
                    </div>
                `);
                markersCluster.addLayer(marker);
            }
        });
        map.addLayer(markersCluster);
        console.log("✔ Mapa renderizado com sucesso!");
    } catch (error) {
        console.error("❌ Erro ao baixar dados do mapa:", error.message);
    }
}

carregarMapaEscolas();
