/**
 * src/js/api/brasilapi.api.js
 * Responsabilidade: Consulta de endereco por CEP via BrasilAPI
 */

export async function buscarCep(cepRaw) {
  const cep = cepRaw.replace(/\D/g, '');

  if (!/^\d{8}$/.test(cep)) {
    return { ok: false, mensagem: 'CEP inválido. Informe 8 dígitos numéricos.' };
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);

    if (response.status === 404) {
      return { ok: false, mensagem: 'CEP não encontrado na base de dados.' };
    }

    if (!response.ok) {
      return { ok: false, mensagem: 'Erro na API do BrasilAPI.' };
    }

    const dados = await response.json();

    return {
      ok: true,
      dados: {
        cidade: dados.city || '',
        uf: (dados.state || '').toUpperCase(),
        logradouro: dados.street || '',
        bairro: dados.neighborhood || '',
      },
    };
  } catch (err) {
    return { ok: false, mensagem: 'Erro ao conectar com a BrasilAPI. Verifique sua conexão.' };
  }
}
