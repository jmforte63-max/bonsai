/**
 * Muestra un mensaje emergente (toast) en la pantalla.
 * @param {string} message El mensaje a mostrar.
 * @param {boolean} isError Si es true, muestra el toast con estilo de error.
 */
export function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    if (isError) {
        toast.classList.add('error');
    }
    toast.textContent = message;
    document.body.appendChild(toast);

    // Pequeño delay para que la transición CSS se active
    setTimeout(() => toast.classList.add('show'), 100);

    // Ocultar y eliminar el toast después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        // Esperar a que termine la transición de opacidad para eliminar el elemento
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

/**
 * Muestra un modal de confirmación.
 * @param {string} message El mensaje de confirmación.
 * @returns {Promise<boolean>} Resuelve a `true` si el usuario confirma, `false` si cancela.
 */
export function showConfirm(message, confirmText = 'Sí, eliminar') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';

        overlay.innerHTML = `
            <div class="confirm-modal-content">
                <p>${message}</p>
                <div class="confirm-modal-buttons">
                    <button id="confirmBtn">${confirmText}</button>
                    <button id="cancelBtn" class="btn-eliminar">Cancelar</button>
                </div>
            </div>
        `;

        const confirmBtn = overlay.querySelector('#confirmBtn');
        const cancelBtn = overlay.querySelector('#cancelBtn');

        const removeOverlay = () => document.body.removeChild(overlay);

        confirmBtn.onclick = () => {
            removeOverlay();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            removeOverlay();
            resolve(false);
        };

        document.body.appendChild(overlay);
    });
}