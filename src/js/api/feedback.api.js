/**
 * src/js/api/feedback.api.js
 * Responsabilidade: CRUD de avaliacoes (reviews) e interacoes (likes/flags) no Back4App
 */

import estado from '../core/estado.js';

const CLASSE_AVALIACOES = 'Avaliacoes';
const CLASSE_INTERACAO = 'AvaliacaoInteracao';

/**
 * Envia uma avaliacao com verificacao de local
 */
export async function enviarAvaliacao({ idEscola, nota, comentario, latitude, longitude, verificadoLocal }) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuario nao autenticado');

  try {
    const review = new Parse.Object(CLASSE_AVALIACOES);
    review.set('id_escola', idEscola);
    review.set('nome', usuario.get('nomeExibicao') || usuario.get('username'));
    review.set('nota', nota);
    review.set('mensagem', comentario);
    review.set('verificado_local', !!verificadoLocal);
    review.set('respostas', []);
    review.set('flags_count', 0);

    if (verificadoLocal && latitude != null && longitude != null) {
      review.set('latitude_envio', latitude);
      review.set('longitude_envio', longitude);
    }

    await review.save();
    return review;
  } catch (erro) {
    console.error('[feedback.api] Erro ao enviar avaliacao:', erro);
    throw erro;
  }
}

/**
 * Lista avaliacoes de uma escola
 */
export async function listarPorEscola(idEscola) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    query.equalTo('id_escola', idEscola);
    query.descending('createdAt');
    query.limit(100);
    return await query.find();
  } catch (erro) {
    console.error('[feedback.api] Erro ao listar avaliacoes:', erro);
    return [];
  }
}

/**
 * Verifica se o usuario atual ja avaliou esta escola
 */
export async function verificarAvaliacaoExistente(idEscola) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) return null;

  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    query.equalTo('id_escola', idEscola);
    query.equalTo('nome', usuario.get('nomeExibicao') || usuario.get('username'));
    return await query.first();
  } catch (erro) {
    console.error('[feedback.api] Erro ao verificar avaliacao:', erro);
    return null;
  }
}

/**
 * Regista like em uma avaliacao
 */
export async function curtirAvaliacao(reviewId) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuario nao autenticado');

  try {
    const interacao = new Parse.Object(CLASSE_INTERACAO);
    interacao.set('review_id', reviewId);
    interacao.set('usuario_id', usuario.id);
    interacao.set('tipo', 'like');
    await interacao.save();
    return interacao;
  } catch (erro) {
    console.error('[feedback.api] Erro ao curtir:', erro);
    throw erro;
  }
}

/**
 * Denuncia uma avaliacao
 */
export async function denunciarAvaliacao(reviewId) {
  const usuario = estado.obter('usuarioAtual');
  if (!usuario) throw new Error('Usuario nao autenticado');

  try {
    const interacao = new Parse.Object(CLASSE_INTERACAO);
    interacao.set('review_id', reviewId);
    interacao.set('usuario_id', usuario.id);
    interacao.set('tipo', 'flag');
    await interacao.save();

    const query = new Parse.Query(CLASSE_AVALIACOES);
    const review = await query.get(reviewId);
    review.increment('flags_count', 1);
    await review.save();

    return interacao;
  } catch (erro) {
    console.error('[feedback.api] Erro ao denunciar:', erro);
    throw erro;
  }
}

/**
 * Exclui uma avaliacao (admin ou autor)
 */
export async function excluirAvaliacao(reviewId) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    const obj = await query.get(reviewId);
    await obj.destroy();
    return true;
  } catch (erro) {
    console.error('[feedback.api] Erro ao excluir:', erro);
    return false;
  }
}

/**
 * Responde a uma avaliacao (admin)
 */
export async function responderAvaliacao(reviewId, resposta) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    const obj = await query.get(reviewId);
    const respostas = obj.get('respostas') || [];
    respostas.push({
      texto: resposta,
      data: new Date().toISOString(),
    });
    obj.set('respostas', respostas);
    await obj.save();
    return obj;
  } catch (erro) {
    console.error('[feedback.api] Erro ao responder:', erro);
    throw erro;
  }
}

/**
 * Lista avaliacoes denunciadas (admin)
 */
export async function listarDenunciadas(limite = 50) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    query.greaterThanOrEqualTo('flags_count', 3);
    query.descending('flags_count');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[feedback.api] Erro ao listar denunciadas:', erro);
    return [];
  }
}
