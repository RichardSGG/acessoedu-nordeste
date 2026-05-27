/**
 * src/js/api/fotos.api.js
 * Responsabilidade: Gestao de upload e consulta de fotos comunitarias no Back4App
 */

const CLASSE_FOTO = 'SchoolPhoto';

/**
 * Lista fotos aprovadas para uma escola
 * @param {string} idEscola - id_escola (codigo INEP)
 * @returns {Promise<Array>}
 */
export async function listarAprovadas(idEscola) {
  try {
    const query = new Parse.Query(CLASSE_FOTO);
    query.equalTo('id_escola', String(idEscola));
    query.equalTo('status', 'approved');
    query.descending('createdAt');
    query.limit(30);
    return await query.find();
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
export async function listarPendentes(limite = 50) {
  try {
    const query = new Parse.Query(CLASSE_FOTO);
    query.equalTo('status', 'pending');
    query.include('id_escola');
    query.descending('createdAt');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[fotos.api] Erro ao listar pendentes:', erro);
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
    await foto.save();
    return foto;
  } catch (erro) {
    console.error('[fotos.api] Erro ao moderar foto:', erro);
    throw erro;
  }
}
