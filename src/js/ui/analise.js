/**
 * src/js/ui/analise.js
 * Responsabilidade: Graficos comparativos Chart.js — barras, donut, delta
 *                   Chart.js carregado via Lazy Loading com IntersectionObserver
 */

import * as EscolasAPI from '../api/escolas.api.js';

Parse.initialize('pvFVnLmPwAzA0S9RG8rGmLJs5nOkus8FBfVSCOEj', 'nfwa3q9x6QEJlFOwwNZtFFI54lwU8chbBYyzJKxN');
Parse.serverURL = 'https://parseapi.back4app.com/parse/';

let chartBarras = null;
let chartDonut = null;
let chartDeltaLinha = null;
let chartDeltaRadar = null;

const LABELS = ['Internet', 'Laboratório', 'Banheiro PNE', 'Quadra', 'Acessibilidade', 'Água', 'Energia'];
const CAMPOS = ['internet', 'laboratorio', 'banheiro_pne', 'quadra', 'rampa_acessibilidade', 'agua_potavel', 'energia_eletrica'];

async function iniciar() {
  document.getElementById('filtro-analise-uf').addEventListener('change', () => {
    recarregarGraficos();
  });

  /* Lazy Loading do Chart.js via IntersectionObserver */
  const container = document.getElementById('grafico-barras')?.closest('.card');
  if (!container) return;

  const observador = new IntersectionObserver(async (entradas) => {
    if (!entradas[0].isIntersecting) return;
    observador.disconnect();

    try {
      await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js');
      document.getElementById('loader-analise').classList.add('hidden');
      await carregarTodosGraficos();
    } catch (erro) {
      console.error('[ANALISE] Erro ao carregar Chart.js:', erro);
      document.getElementById('loader-analise').innerHTML =
        '<p class="text-red-500 text-sm font-semibold">Erro ao carregar biblioteca de gráficos.</p>';
    }
  }, { threshold: 0.1 });

  observador.observe(container);
}

async function recarregarGraficos() {
  if (chartBarras) chartBarras.destroy();
  if (chartDonut) chartDonut.destroy();
  if (chartDeltaLinha) chartDeltaLinha.destroy();
  if (chartDeltaRadar) chartDeltaRadar.destroy();
  await carregarTodosGraficos();
}

async function carregarTodosGraficos() {
  const uf = document.getElementById('filtro-analise-uf').value || null;
  const agregados = await EscolasAPI.obterAgregados(uf);
  if (!agregados) return;

  const { dados2024, dados2025 } = agregados;
  renderizarBarras(dados2024, dados2025);
  renderizarDonut(dados2024, dados2025);
  renderizarDeltaLinha(dados2024, dados2025);
  renderizarDeltaRadar(dados2024, dados2025);
}

/* --- Barras Agrupadas --- */
function renderizarBarras(d24, d25) {
  const ctx = document.getElementById('grafico-barras')?.getContext('2d');
  if (!ctx) return;

  const pct = (val, total) => total > 0 ? ((val / total) * 100).toFixed(1) : 0;

  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: '2024',
          data: CAMPOS.map(c => pct(d24[c], d24.total)),
          backgroundColor: 'rgba(26, 86, 145, 0.7)',
          borderColor: '#1A5691',
          borderWidth: 1,
          borderRadius: 8,
        },
        {
          label: '2025',
          data: CAMPOS.map(c => pct(d25[c], d25.total)),
          backgroundColor: 'rgba(61, 163, 90, 0.7)',
          borderColor: '#3DA35A',
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Inter', size: 13 }, usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.raw + '%' } },
      },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%', font: { family: 'Inter' } } },
        x: { ticks: { font: { family: 'Inter', size: 11, weight: 'bold' } } },
      },
    },
  });
}

/* --- Donut Conectividade --- */
function renderizarDonut(d24, d25) {
  const ctx = document.getElementById('grafico-donut')?.getContext('2d');
  if (!ctx) return;

  const comInternet2025 = d25.internet || 0;
  const semInternet2025 = d25.total - comInternet2025;
  const ganhou = Math.max(0, (d25.internet || 0) - (d24.internet || 0));
  const perdeu = Math.max(0, (d24.internet || 0) - (d25.internet || 0));

  chartDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Com internet (2025)', 'Sem internet (2025)', 'Ganhou internet', 'Perdeu internet'],
      datasets: [{
        data: [comInternet2025, semInternet2025, ganhou, perdeu],
        backgroundColor: ['#3DA35A', '#E2E8F0', '#1A5691', '#E53E3E'],
        borderColor: '#FFFFFF',
        borderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ctx.label + ': ' + ctx.raw.toLocaleString() + ' (' + pct + '%)';
            },
          },
        },
      },
    },
  });
}

/* --- Linha de Evolucao (Delta) --- */
function renderizarDeltaLinha(d24, d25) {
  const ctx = document.getElementById('grafico-delta-linha')?.getContext('2d');
  if (!ctx) return;

  const pct = (val, total) => total > 0 ? (val / total) * 100 : 0;

  const deltas = CAMPOS.map(c =>
    parseFloat((pct(d25[c], d25.total) - pct(d24[c], d24.total)).toFixed(2))
  );

  chartDeltaLinha = new Chart(ctx, {
    type: 'line',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Crescimento Real (Delta % 2025 vs 2024)',
          data: deltas,
          backgroundColor: 'rgba(242, 153, 74, 0.2)',
          borderColor: '#F2994A',
          borderWidth: 3,
          pointBackgroundColor: '#F2994A',
          pointRadius: 5,
          tension: 0.3,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Inter', size: 13 }, usePointStyle: true } },
        tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + (ctx.raw >= 0 ? '+' : '') + ctx.raw + '%' } }
      },
      scales: {
        y: {
          ticks: { callback: (v) => (v >= 0 ? '+' : '') + v + '%', font: { family: 'Inter' } }
        },
        x: { ticks: { font: { family: 'Inter', size: 11, weight: 'bold' } } }
      }
    }
  });
}

/* --- Radar de Evolucao (Delta) --- */
function renderizarDeltaRadar(d24, d25) {
  const ctx = document.getElementById('grafico-delta-radar')?.getContext('2d');
  if (!ctx) return;

  const pct = (val, total) => total > 0 ? (val / total) * 100 : 0;

  const deltas = CAMPOS.map(c =>
    parseFloat((pct(d25[c], d25.total) - pct(d24[c], d24.total)).toFixed(2))
  );

  chartDeltaRadar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: LABELS,
      datasets: [
        {
          label: 'Evolução da Infraestrutura (Delta %)',
          data: deltas,
          backgroundColor: 'rgba(128, 90, 213, 0.2)',
          borderColor: '#805AD5',
          borderWidth: 2,
          pointBackgroundColor: '#805AD5',
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, usePointStyle: true } }
      },
      scales: {
        r: {
          ticks: { font: { family: 'Inter', size: 10 }, callback: (v) => (v >= 0 ? '+' : '') + v + '%' },
          pointLabels: { font: { family: 'Inter', size: 11, weight: '600' } }
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
