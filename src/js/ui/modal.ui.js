/**
 * src/js/ui/modal.ui.js
 * Responsabilidade: Modais personalizados — substitutos para alert(), confirm() e prompt()
 */

let container = null;

function garantirContainer() {
  if (container) return container;

  container = document.createElement('div');
  container.innerHTML = `
    <div id="modal-custom" class="modal-overlay">
      <div class="modal-conteudo w-full max-w-md">
        <h3 id="modal-custom-titulo" class="font-display font-bold text-lg mb-3" style="color: var(--cor-texto-principal);"></h3>
        <p id="modal-custom-mensagem" class="text-sm mb-5 leading-relaxed" style="color: var(--cor-texto-secundario);"></p>
        <div id="modal-custom-input-area" class="hidden mb-4">
          <input type="text" id="modal-custom-input" class="input-padrao" />
        </div>
        <div class="flex gap-3 justify-end">
          <button id="modal-custom-cancelar" class="botao-secundario hidden">Cancelar</button>
          <button id="modal-custom-confirmar" class="botao-primario">OK</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(container.firstElementChild);
  container = document.getElementById('modal-custom');
  return container;
}

function fechar() {
  const el = document.getElementById('modal-custom');
  if (el) el.classList.remove('aberto');
}

/**
 * Substituto de alert()
 * @param {string} mensagem
 * @param {string} [titulo='Aviso']
 * @returns {Promise<void>}
 */
export function mostrarAlerta(mensagem, titulo = 'Aviso') {
  return new Promise((resolve) => {
    garantirContainer();
    const overlay = document.getElementById('modal-custom');
    const tituloEl = document.getElementById('modal-custom-titulo');
    const msgEl = document.getElementById('modal-custom-mensagem');
    const inputArea = document.getElementById('modal-custom-input-area');
    const btnCancelar = document.getElementById('modal-custom-cancelar');
    const btnConfirmar = document.getElementById('modal-custom-confirmar');

    tituloEl.textContent = titulo;
    msgEl.textContent = mensagem;
    inputArea.classList.add('hidden');
    btnCancelar.classList.add('hidden');
    btnConfirmar.textContent = 'OK';
    btnConfirmar.className = 'botao-primario';

    const handler = () => {
      fechar();
      btnConfirmar.removeEventListener('click', handler);
      resolve();
    };

    btnConfirmar.addEventListener('click', handler);
    overlay.classList.add('aberto');
  });
}

/**
 * Substituto de confirm()
 * @param {string} mensagem
 * @param {string} [titulo='Confirmação']
 * @returns {Promise<boolean>}
 */
export function mostrarConfirmacao(mensagem, titulo = 'Confirmação') {
  return new Promise((resolve) => {
    garantirContainer();
    const overlay = document.getElementById('modal-custom');
    const tituloEl = document.getElementById('modal-custom-titulo');
    const msgEl = document.getElementById('modal-custom-mensagem');
    const inputArea = document.getElementById('modal-custom-input-area');
    const btnCancelar = document.getElementById('modal-custom-cancelar');
    const btnConfirmar = document.getElementById('modal-custom-confirmar');

    tituloEl.textContent = titulo;
    msgEl.textContent = mensagem;
    inputArea.classList.add('hidden');
    btnCancelar.classList.remove('hidden');
    btnConfirmar.textContent = 'Confirmar';
    btnConfirmar.className = 'botao-primario';

    const resolver = (valor) => {
      fechar();
      btnConfirmar.removeEventListener('click', onConfirmar);
      btnCancelar.removeEventListener('click', onCancelar);
      resolve(valor);
    };

    const onConfirmar = () => resolver(true);
    const onCancelar = () => resolver(false);

    btnConfirmar.addEventListener('click', onConfirmar);
    btnCancelar.addEventListener('click', onCancelar);
    overlay.classList.add('aberto');
  });
}

/**
 * Substituto de prompt()
 * @param {string} mensagem
 * @param {string} [titulo='Informe']
 * @param {string} [valorPadrao='']
 * @returns {Promise<string|null>}
 */
export function mostrarPrompt(mensagem, titulo = 'Informe', valorPadrao = '') {
  return new Promise((resolve) => {
    garantirContainer();
    const overlay = document.getElementById('modal-custom');
    const tituloEl = document.getElementById('modal-custom-titulo');
    const msgEl = document.getElementById('modal-custom-mensagem');
    const inputArea = document.getElementById('modal-custom-input-area');
    const input = document.getElementById('modal-custom-input');
    const btnCancelar = document.getElementById('modal-custom-cancelar');
    const btnConfirmar = document.getElementById('modal-custom-confirmar');

    tituloEl.textContent = titulo;
    msgEl.textContent = mensagem;
    inputArea.classList.remove('hidden');
    input.type = 'text';
    input.value = valorPadrao;
    btnCancelar.classList.remove('hidden');
    btnConfirmar.textContent = 'Confirmar';
    btnConfirmar.className = 'botao-primario';

    const resolver = (valor) => {
      fechar();
      btnConfirmar.removeEventListener('click', onConfirmar);
      btnCancelar.removeEventListener('click', onCancelar);
      input.removeEventListener('keydown', onEnter);
      resolve(valor);
    };

    const onConfirmar = () => resolver(input.value);
    const onCancelar = () => resolver(null);
    const onEnter = (e) => { if (e.key === 'Enter') resolver(input.value); };

    btnConfirmar.addEventListener('click', onConfirmar);
    btnCancelar.addEventListener('click', onCancelar);
    input.addEventListener('keydown', onEnter);
    overlay.classList.add('aberto');

    setTimeout(() => input.focus(), 100);
  });
}

/**
 * Abre um modal com campo de formulario para capturar um valor do usuario.
 * Substituto semantico de mostrarPrompt para contexto de formularios.
 * @param {string} mensagem - Instrucao exibida ao usuario
 * @param {string} [tipo='text'] - Tipo do input (email, text, etc.)
 * @param {string} [titulo='Informe'] - Titulo do modal
 * @returns {Promise<string|null>}
 */
export function mostrarFormulario(mensagem, tipo = 'text', titulo = 'Informe') {
  return new Promise((resolve) => {
    garantirContainer();
    const overlay = document.getElementById('modal-custom');
    const tituloEl = document.getElementById('modal-custom-titulo');
    const msgEl = document.getElementById('modal-custom-mensagem');
    const inputArea = document.getElementById('modal-custom-input-area');
    const input = document.getElementById('modal-custom-input');
    const btnCancelar = document.getElementById('modal-custom-cancelar');
    const btnConfirmar = document.getElementById('modal-custom-confirmar');

    tituloEl.textContent = titulo;
    msgEl.textContent = mensagem;
    inputArea.classList.remove('hidden');
    input.type = tipo;
    input.value = '';
    btnCancelar.classList.remove('hidden');
    btnConfirmar.textContent = 'Confirmar';
    btnConfirmar.className = 'botao-primario';

    const resolver = (valor) => {
      fechar();
      btnConfirmar.removeEventListener('click', onConfirmar);
      btnCancelar.removeEventListener('click', onCancelar);
      input.removeEventListener('keydown', onEnter);
      resolve(valor);
    };

    const onConfirmar = () => resolver(input.value);
    const onCancelar = () => resolver(null);
    const onEnter = (e) => { if (e.key === 'Enter') resolver(input.value); };

    btnConfirmar.addEventListener('click', onConfirmar);
    btnCancelar.addEventListener('click', onCancelar);
    input.addEventListener('keydown', onEnter);
    overlay.classList.add('aberto');

    setTimeout(() => input.focus(), 100);
  });
}
