import { setupAuthUI } from './authUI.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader } = setupAuthUI('userInfo', '#header-actions');
    const apiUrl = 'http://localhost:3000/api/perfil';

    const form = document.getElementById('formProfilePic');
    const currentProfilePic = document.getElementById('currentProfilePic');

    // Cargar la información del perfil actual
    async function loadProfile() {
        try {
            const res = await fetch(apiUrl, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudo cargar el perfil.');
            const user = await res.json();

            if (user.foto_perfil) {
                currentProfilePic.src = `http://localhost:3000${user.foto_perfil}`;
            } else {
                currentProfilePic.src = 'https://via.placeholder.com/150?text=Sin+Foto';
            }
        } catch (error) {
            showToast(error.message, true);
        }
    }

    // Manejar la subida de la nueva foto
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const { 'Content-Type': _, ...headersSinContentType } = authHeader;

        try {
            const res = await fetch(`${apiUrl}/foto`, {
                method: 'PUT',
                headers: headersSinContentType,
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al subir la foto.');

            showToast('¡Foto de perfil actualizada!');

            // Actualizar la imagen en la página y en localStorage para que se refleje en toda la app
            currentProfilePic.src = `http://localhost:3000${data.foto_perfil}`;
            localStorage.setItem('bonsai-user-foto', data.foto_perfil);

            // Redirigir a la página principal de bonsáis
            window.location.href = '/';

        } catch (error) {
            showToast(error.message, true);
        }
    });

    loadProfile();
});