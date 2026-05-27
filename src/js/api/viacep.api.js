/**
 * src/js/api/viacep.api.js
 * Responsabilidade: Consulta de endereco por CEP via API publica ViaCEP
 */

/**
 * Busca endereco a partir de um CEP.
 * @param {string} cepRaw - CEP com ou sem mascara
 * @returns {Promise<{ok: boolean, dados?: object, mensagem?: string}>}
 */
export async function buscarCep(cepRaw) {
  const cep = cepRaw.replace(/\D/g, '');

  if (!/^\d{8}$/.test(cep)) {
    return { ok: false, mensagem: 'CEP invalido. Informe 8 digitos numericos.' };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    if (response.status === 400) {
      return { ok: false, mensagem: 'Formato de CEP invalido.' };
    }

    const dados = await response.json();

    if (dados.erro) {
      return { ok: false, mensagem: 'CEP nao encontrado na base de dados.' };
    }

    return {
      ok: true,
      dados: {
        cidade: dados.localidade || '',
        uf: (dados.uf || '').toUpperCase(),
        logradouro: dados.logradouro || '',
        bairro: dados.bairro || '',
      },
    };
  } catch (err) {
    return { ok: false, mensagem: 'Erro ao conectar com o ViaCEP. Verifique sua conexao.' };
  }
}
