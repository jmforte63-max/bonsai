import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader } = setupAuthUI('userInfo', '#header-actions');
    const usersList = document.getElementById('pendingUsersList');
    const statsDiv = document.getElementById('adminStats');
    const apiUrl = 'http://localhost:3000/api/admin';

    // Usamos delegación de eventos para manejar los clics y cambios
    usersList.addEventListener('click', async (e) => {
        const button = e.target;
        if (button.tagName !== 'BUTTON' || !button.dataset.id) return;

        const userId = button.dataset.id;
        const action = button.dataset.action;

        if (action === 'delete') {
            const confirmado = await showConfirm('¿Seguro que quieres eliminar a este usuario? Esta acción es irreversible.');
            if (confirmado) {
                usersList.style.pointerEvents = 'none';
                try {
                    const res = await fetch(`${apiUrl}/user/${userId}`, {
                        method: 'DELETE',
                        headers: authHeader
                    });
                    if (!res.ok) {
                        const errText = await res.text();
                        let message = 'No se pudo eliminar el usuario.';
                        try {
                            // Intentamos parsear como JSON
                            message = JSON.parse(errText).message || message;
                        } catch (jsonError) {
                            // Si falla, es probable que no sea JSON, usamos el texto.
                        }
                        throw new Error(message);
                    }
                    const updatedUsers = await res.json();
                    renderUsers(updatedUsers, false);
                    showToast('Usuario eliminado correctamente.');
                } catch (error) {
                    showToast(error.message, true);
                } finally {
                    usersList.style.pointerEvents = 'auto';
                }
            }
        } else if (action === 'update-status') {
            usersList.style.pointerEvents = 'none';
            button.disabled = true;
            const newStatus = button.dataset.status;

            try {
                const res = await fetch(`${apiUrl}/user-status/${userId}`, {
                    method: 'PUT',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.message || 'Error al actualizar el estado.');
                }

                const updatedUsers = await res.json();
                renderUsers(updatedUsers, false);
                showToast('Estado del usuario actualizado con éxito.');
            } catch (error) {
                showToast(error.message, true);
                await loadUsers();
            } finally {
                usersList.style.pointerEvents = 'auto';
            }
        }
    });

    usersList.addEventListener('change', async (e) => {
        const selector = e.target;
        if (selector.classList.contains('role-selector') && !selector.disabled) {
            usersList.style.pointerEvents = 'none'; // Deshabilitar clics en toda la lista
            selector.disabled = true; // Deshabilitar el selector específico
            const userId = selector.dataset.id;
            const newRole = selector.value;

            try {
                const res = await fetch(`${apiUrl}/user-role/${userId}`, {
                    method: 'PUT', 
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: newRole })
                });

                if (!res.ok) {
                    const errData = await res.text(); // Usamos text() por si la respuesta no es JSON
                    throw new Error(JSON.parse(errData).message || 'Error al cambiar el rol.');
                }
                const updatedUsers = await res.json();
                renderUsers(updatedUsers, false); // No reordenar la lista para evitar saltos visuales
                showToast('Rol actualizado con éxito.');
            } catch (error) {
                showToast(error.message, true);
                await loadUsers(); // Si hay un error, recargamos para restaurar el estado visual
            } finally {
                usersList.style.pointerEvents = 'auto';
            }
        }
    });

    function renderUsers(users, shouldSort = true) {
        if (shouldSort) {
            // Ordenamos: primero los pendientes, luego los aprobados
            users.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                return a.email.localeCompare(b.email); // Orden alfabético como secundario
            });
        }

        usersList.innerHTML = '';

        if (users.length === 0) {
            usersList.innerHTML = '<p>No hay otros usuarios registrados en el sistema.</p>';
            return;
        }
        users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'trabajo-item';

            // Lógica para determinar el texto y estilo del botón
            const isApproved = user.status === 'approved';
            const statusText = isApproved ? 'Aprobado' : 'Pendiente';
            const buttonText = isApproved ? 'Revocar Aprobación' : 'Aprobar Usuario';
            const buttonClass = isApproved ? 'btn-revoke' : 'btn-approve';
            const newStatus = isApproved ? 'pending' : 'approved';

            // El botón de eliminar solo aparece para roles que no sean 'admin'
            const deleteButton = user.role !== 'admin'
                ? `<button class="btn-eliminar" data-id="${user.id}" data-action="delete">Eliminar</button>`
                : '';

            // Creamos el HTML para cada usuario
            // El rol de 'admin' no se puede cambiar, así que lo deshabilitamos.
            const roles = ['user', 'moderator', 'admin'];
            const roleSelector = `
                <select class="role-selector" data-id="${user.id}" ${user.role === 'admin' ? 'disabled' : ''}>
                    ${roles.map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role.charAt(0).toUpperCase() + role.slice(1)}</option>`).join('')}
                </select>
            `;

            userDiv.innerHTML = `
                <div class="user-info-line">
                    <p><strong>Email:</strong> ${user.email}</p>
                    <div class="user-status">
                        <strong>Rol:</strong> ${roleSelector}
                    </div>
                </div>
                <div class="user-info-line">
                    <p><strong>Estado:</strong> <span class="user-status-text ${isApproved ? 'status-approved' : 'status-pending'}">${statusText}</span></p>
                    <div class="user-actions">
                        <button class="${buttonClass}" data-id="${user.id}" data-action="update-status" data-status="${newStatus}">${buttonText}</button>
                        ${deleteButton}
                    </div>
                </div>
            `;
            usersList.appendChild(userDiv);
        });
    }

    async function loadStats() {
        try {
            const res = await fetch(`${apiUrl}/stats`, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar las estadísticas.');
            
            const stats = await res.json();
            
            statsDiv.innerHTML = `
                <div style="display: flex; justify-content: space-around; text-align: center;">
                    <div>
                        <h3>Total de Usuarios</h3>
                        <p style="font-size: 2em; margin: 0;">${stats.totalUsers}</p>
                    </div>
                    <div>
                        <h3>Total de Bonsáis</h3>
                        <p style="font-size: 2em; margin: 0;">${stats.totalBonsais}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            statsDiv.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    async function loadUsers() {
        try {
            const res = await fetch(`${apiUrl}/users`, { headers: authHeader }); // Llamada a la nueva API
            if (res.status === 403) {
                document.body.innerHTML = '<h1>Acceso Denegado</h1><p>No tienes permisos para ver esta página.</p><a href="/">Volver</a>';
                return;
            }
            if (!res.ok) throw new Error('No se pudieron cargar los usuarios.');

            const users = await res.json();
            renderUsers(users);

        } catch (error) {
            showToast(error.message, true); // Mostramos un error si algo falla
        }
    }

    loadStats();
    loadUsers();
});