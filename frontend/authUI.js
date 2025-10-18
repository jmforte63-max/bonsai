/**
 * Configura el encabezado de la página con información del usuario y botón de logout.
 * También verifica la autenticación y redirige si no está autenticado.
 * @param {string} userInfoElementId - El ID del elemento para mostrar la info del usuario.
 * @param {string} headerActionsContainerSelector - El selector del contenedor para los botones de acción.
 * @returns {{authHeader: object, userToken: string, userEmail: string, userRole: string, userId: number}} - Objeto con datos de autenticación.
 */
export function setupAuthUI(userInfoElementId, headerActionsContainerSelector) {
    const userToken = localStorage.getItem('bonsai-token');
    const userEmail = localStorage.getItem('bonsai-user-email');
    const userRole = localStorage.getItem('bonsai-user-role');
    const userId = parseInt(localStorage.getItem('bonsai-user-id'), 10);

    if (!userToken) {
        window.location.href = '/login.html';
        // Devolvemos un objeto vacío para evitar errores antes de la redirección
        return { authHeader: {}, userToken: null, userEmail: null, userRole: null, userId: null };
    }

    const authHeader = { 'Authorization': `Bearer ${userToken}` };

    // Mostrar información del usuario
    const userInfo = document.getElementById(userInfoElementId);
    if (userInfo && userEmail && userRole) {
        const roleText = userRole.charAt(0).toUpperCase() + userRole.slice(1);
        userInfo.textContent = `Hola, ${userEmail} (${roleText})`;
    }

    // Contenedor para el botón de logout
    const actionsContainer = document.querySelector(headerActionsContainerSelector);

    if (actionsContainer) {
        // Añadir botón de logout
        const logoutButton = document.createElement('button');
        logoutButton.textContent = 'Cerrar Sesión';
        logoutButton.className = 'nav-link btn-logout';
        logoutButton.style.border = 'none';
        logoutButton.onclick = () => {
            localStorage.clear();
            window.location.href = '/login.html';
        };
        actionsContainer.appendChild(logoutButton);
    }

    // Añadir enlace al panel de admin si el usuario es admin (después del de logout)
    if (userRole === 'admin' && actionsContainer && window.location.pathname !== '/admin.html') {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin.html';
        adminLink.textContent = 'Panel Admin';
        adminLink.className = 'nav-link';
        actionsContainer.appendChild(adminLink); // Lo añadimos al final
    }
    
    return { authHeader, userToken, userEmail, userRole, userId };
}