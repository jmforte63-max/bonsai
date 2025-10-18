/**
 * Gestiona el envío de formularios de autenticación (login y registro).
 * @param {HTMLFormElement} form - El formulario a gestionar.
 * @param {string} url - La URL del endpoint de la API.
 * @param {function} onSuccess - Callback a ejecutar en caso de éxito.
 */
async function handleAuth(form, url, onSuccess) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const errorElement = form.nextElementSibling; // El <p> de error

        errorElement.style.display = 'none'; // Ocultar errores previos

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData.message || 'Ocurrió un error.');
            }

            onSuccess(responseData);

        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    });
}

// Se ejecuta cada vez que la página se muestra (incluyendo navegación atrás/adelante)
window.addEventListener('pageshow', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    // Limpiamos los formularios para evitar el autocompletado del navegador al navegar
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
});

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        handleAuth(registerForm, 'http://localhost:3000/api/register', () => {
            alert('¡Registro exitoso! Tu cuenta está pendiente de aprobación por un administrador.');
            window.location.href = '/login.html';
        });
    }

    if (loginForm) {
        handleAuth(loginForm, 'http://localhost:3000/api/login', (data) => {
            if(data.role) localStorage.setItem('bonsai-user-role', data.role);
            if(data.id) localStorage.setItem('bonsai-user-id', data.id); // Guardamos el ID
            localStorage.setItem('bonsai-token', data.token);
            localStorage.setItem('bonsai-user-email', data.email); // Guardamos el email
            window.location.href = '/'; // Redirigir a la página principal
        });
    }
});