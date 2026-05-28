/**
 * src/js/api/feedback.api.js
 * Responsabilidade: CRUD de avaliações (reviews) e interações (likes/flags) no Back4App
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
    review.set('usuario', usuario);

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
 * Lista avaliacoes de uma escola (exclui as removidas pelo admin)
 */
export async function listarPorEscola(idEscola) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    query.equalTo('id_escola', idEscola);
    query.notEqualTo('removido', true);
    query.include('usuario');
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
    const queryInteracao = new Parse.Query(CLASSE_INTERACAO);
    queryInteracao.equalTo('review_id', reviewId);
    queryInteracao.equalTo('usuario_id', usuario.id);
    queryInteracao.equalTo('tipo', 'like');
    const existente = await queryInteracao.first();
    if (existente) {
      throw new Error('Você já apoiou este comentário.');
    }

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
    const queryInteracao = new Parse.Query(CLASSE_INTERACAO);
    queryInteracao.equalTo('review_id', reviewId);
    queryInteracao.equalTo('usuario_id', usuario.id);
    queryInteracao.equalTo('tipo', 'flag');
    const existente = await queryInteracao.first();
    if (existente) {
      throw new Error('Você já enviou uma denúncia para este comentário.');
    }

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
 * Remove uma avaliacao definitivamente (apenas admin — pelo painel)
 * Usa soft-delete: marca como removido para manter historico no painel
 */
export async function excluirAvaliacao(reviewId) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    const obj = await query.get(reviewId);
    obj.set('removido', true);
    obj.set('removidoEm', new Date().toISOString());
    const adminAtual = Parse.User.current();
    if (adminAtual) {
      obj.set('removidoPor', adminAtual.get('nomeExibicao') || adminAtual.get('username'));
    }
    await obj.save();
    return true;
  } catch (erro) {
    console.error('[feedback.api] Erro ao remover avaliacao:', erro);
    return false;
  }
}

/**
 * Lista avaliações removidas pelo admin (soft-deleted)
 */
export async function listarRemovidos(limite = 100) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    query.equalTo('removido', true);
    query.descending('removidoEm');
    query.limit(limite);
    return await query.find();
  } catch (erro) {
    console.error('[feedback.api] Erro ao listar removidos:', erro);
    return [];
  }
}

/**
 * Restaura uma avaliação removida (desfaz soft-delete)
 */
export async function restaurarAvaliacao(reviewId) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    const obj = await query.get(reviewId);
    obj.unset('removido');
    obj.unset('removidoEm');
    obj.unset('removidoPor');
    await obj.save();
    return true;
  } catch (erro) {
    console.error('[feedback.api] Erro ao restaurar avaliacao:', erro);
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

/**
 * Mantém uma avaliação denunciada, limpando as denúncias e definindo o moderador
 */
export async function manterAvaliacao(reviewId) {
  try {
    const query = new Parse.Query(CLASSE_AVALIACOES);
    const obj = await query.get(reviewId);
    obj.set('flags_count', 0);
    
    const adminAtual = Parse.User.current();
    if (adminAtual) {
      obj.set('moderadoPor', adminAtual);
    }
    
    await obj.save();
    return true;
  } catch (erro) {
    console.error('[feedback.api] Erro ao manter avaliacao:', erro);
    return false;
  }
}
