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
    const userFoto = localStorage.getItem('bonsai-user-foto');

    if (!userToken) {
        window.location.href = '/login.html';
        // Devolvemos un objeto vacío para evitar errores antes de la redirección
        return { authHeader: {}, userToken: null, userEmail: null, userRole: null, userId: null, userFoto: null };
    }

    const authHeader = { 'Authorization': `Bearer ${userToken}` };

    // Mostrar información del usuario
    const userInfo = document.getElementById(userInfoElementId);
    if (userInfo) {
        userInfo.innerHTML = `
            <a href="/perfil.html" class="profile-link">
                <img src="${userFoto ? 'http://localhost:3000' + userFoto : 'https://via.placeholder.com/40'}" alt="Perfil" class="profile-pic-header">
                <div class="profile-text">
                    <span>${userEmail}</span>
                    <span class="profile-role">${userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
                </div>
            </a>
        `;
    }

    // Contenedor para el botón de logout
    const actionsContainer = document.querySelector(headerActionsContainerSelector);

    if (actionsContainer) {
        // Contenedor para el icono de notificaciones
        const notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-bell';
        notificationContainer.style.cursor = 'pointer';
        notificationContainer.innerHTML = `
            <span class="bell-icon">🔔</span>
            <span class="notification-count" style="display: none;">0</span>
        `;
        actionsContainer.appendChild(notificationContainer);

        // Cargar el número de notificaciones
        fetch('http://localhost:3000/api/notifications/pending-count', { headers: authHeader })
            .then(res => res.json())
            .then(tasks => handleNotifications(tasks, notificationContainer))
            .catch(err => console.error("Error al cargar notificaciones:", err));

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
        adminLink.className = 'nav-link btn-admin';
        actionsContainer.appendChild(adminLink); // Lo añadimos al final
    }
    
    return { authHeader, userToken, userEmail, userRole, userId, userFoto };
}

/**
 * Actualiza el contador visual de notificaciones.
 * @param {number} count El número de notificaciones pendientes.
 */
function handleNotifications(tasks, container) {
    const count = tasks.length;
    const countElement = document.querySelector('.notification-count');

    if (countElement && count > 0) {
        countElement.textContent = count;
        countElement.style.display = 'inline-block';

        // Crear el modal de notificaciones pero mantenerlo oculto
        createNotificationModal(tasks);

        // Añadir el evento de clic al contenedor de la campana
        container.addEventListener('click', () => {
            const modal = document.getElementById('notificationModal');
            if (modal) modal.style.display = 'block';
        });
    } else {
        // Si no hay notificaciones, la campana no hace nada.
        container.style.cursor = 'default';
    }
}

/**
 * Crea y añade el modal de notificaciones al body.
 * @param {Array} tasks - La lista de tareas pendientes.
 */
function createNotificationModal(tasks) {
    // Evitar crear el modal si ya existe
    if (document.getElementById('notificationModal')) return;

    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content notification-modal-content';

    const taskListHTML = tasks.map(task => `
        <div class="notification-modal-item">
            <div class="notification-modal-item-info">
                <strong>${task.descripcion}</strong>
                <span>Bonsái: ${task.bonsai_nombre} | Vence: ${new Date(task.fecha_limite).toLocaleDateString()}</span>
            </div>
            <a href="/bonsai_detalle.html?id=${task.bonsai_id}" class="nav-link">Ver</a>
        </div>
    `).join('');

    modalContent.innerHTML = `
        <span class="close-button">&times;</span>
        <h2>Tareas Urgentes</h2>
        ${taskListHTML}
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Lógica para cerrar el modal
    const closeButton = modal.querySelector('.close-button');
    closeButton.onclick = () => modal.style.display = 'none';
    window.addEventListener('click', (event) => {
        if (event.target === modal) modal.style.display = 'none';
    });
}