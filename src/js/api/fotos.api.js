/**
 * src/js/api/fotos.api.js
 * Responsabilidade: Gestão de upload e consulta de fotos comunitárias no Back4App
 */

const CLASSE_FOTO = 'SchoolPhoto';

/**
 * Lista fotos aprovadas para uma escola
 * @param {string} idEscola - id_escola (codigo INEP)
 * @returns {Promise<Array>}
 */
export async function listarAprovadas(idEscola) {
  try {
    const queryApproved = new Parse.Query(CLASSE_FOTO);
    queryApproved.equalTo('id_escola', String(idEscola));
    queryApproved.equalTo('status', 'approved');

    const usuarioLogado = Parse.User.current();
    if (usuarioLogado) {
      const queryPendingOwn = new Parse.Query(CLASSE_FOTO);
      queryPendingOwn.equalTo('id_escola', String(idEscola));
      queryPendingOwn.equalTo('status', 'pending');
      queryPendingOwn.equalTo('autor', usuarioLogado);

      const mainQuery = Parse.Query.or(queryApproved, queryPendingOwn);
      mainQuery.include('autor');
      mainQuery.include('moderadoPor');
      mainQuery.descending('createdAt');
      mainQuery.limit(30);
      return await mainQuery.find();
    } else {
      queryApproved.include('autor');
      queryApproved.include('moderadoPor');
      queryApproved.descending('createdAt');
      queryApproved.limit(30);
      return await queryApproved.find();
    }
  } catch (erro) {
    console.error('[fotos.api] Erro ao listar aprovadas:', erro);
    return [];
  }
}

/**
 * Submete nova foto para moderacao
 * @param {string} idEscola
 * @param {File} arquivoImagem
 */
export async function enviarFoto(idEscola, arquivoImagem) {
  try {
    const parseFile = new Parse.File(arquivoImagem.name, arquivoImagem);
    await parseFile.save();

    const foto = new Parse.Object(CLASSE_FOTO);
    foto.set('id_escola', String(idEscola));
    foto.set('arquivo', parseFile);
    foto.set('status', 'pending');

    const autor = Parse.User.current();
    if (autor) {
      foto.set('autor', autor);
    }

    await foto.save();

    return foto;
  } catch (erro) {
    console.error('[fotos.api] Erro ao enviar foto:', erro);
    throw erro;
  }
}

/**
 * Lista fotos pendentes de aprovacao (admin)
 */
export async function listarPendentes(filtros = {}, limite = 50) {
  try {
    const query = new Parse.Query(CLASSE_FOTO);
    query.equalTo('status', 'pending');
    query.include('autor');
    
    if (filtros.idEscola) {
      query.equalTo('id_escola', String(filtros.idEscola));
    }
    if (filtros.autor) {
      const innerQuery = new Parse.Query(Parse.User);
      innerQuery.matches('username', filtros.autor, 'i');
      query.matchesQuery('autor', innerQuery);
    }
    if (filtros.dataInicio) {
      query.greaterThanOrEqualTo('createdAt', new Date(filtros.dataInicio));
    }
    if (filtros.dataFim) {
      const dataAte = new Date(filtros.dataFim);
      dataAte.setHours(23, 59, 59, 999);
      query.lessThanOrEqualTo('createdAt', dataAte);
    }

    query.descending('createdAt');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[fotos.api] Erro ao listar pendentes:', erro);
    return [];
  }
}

/**
 * Lista fotos aprovadas (admin — historico)
 */
export async function listarAprovadasAdmin(filtros = {}, limite = 50) {
  try {
    const query = new Parse.Query(CLASSE_FOTO);
    query.equalTo('status', 'approved');
    query.include('autor');
    query.include('moderadoPor');

    if (filtros.idEscola) {
      query.equalTo('id_escola', String(filtros.idEscola));
    }
    if (filtros.autor) {
      const innerQuery = new Parse.Query(Parse.User);
      innerQuery.matches('username', filtros.autor, 'i');
      query.matchesQuery('autor', innerQuery);
    }
    if (filtros.dataInicio) {
      query.greaterThanOrEqualTo('createdAt', new Date(filtros.dataInicio));
    }
    if (filtros.dataFim) {
      const dataAte = new Date(filtros.dataFim);
      dataAte.setHours(23, 59, 59, 999);
      query.lessThanOrEqualTo('createdAt', dataAte);
    }

    query.descending('createdAt');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[fotos.api] Erro ao listar aprovadas admin:', erro);
    return [];
  }
}

/**
 * Aprova ou rejeita uma foto (admin)
 */
export async function moderarFoto(fotoId, status) {
  try {
    const query = new Parse.Query(CLASSE_FOTO);
    const foto = await query.get(fotoId);
    foto.set('status', status);

    const adminAtual = Parse.User.current();
    if (adminAtual) {
      foto.set('moderadoPor', adminAtual);
    }

    await foto.save();
    return foto;
  } catch (erro) {
    console.error('[fotos.api] Erro ao moderar foto:', erro);
    throw erro;
  }
}
