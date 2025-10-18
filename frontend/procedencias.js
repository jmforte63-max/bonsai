import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Configura la autenticación y protege la página
    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');

    // Esta página es solo para administradores
    if (userRole !== 'admin') {
        document.body.innerHTML = `
            <div class="container">
                <h1>Acceso Denegado</h1>
                <p>No tienes permisos para gestionar las procedencias.</p>
                <a href="/" class="back-link">&larr; Volver a Mis Bonsáis</a>
            </div>`;
        return;
    }

    const apiUrlProcedencias = "http://localhost:3000/api/procedencias";
    const form = document.getElementById('formProcedencia');
    const lista = document.getElementById('listaProcedencias');
    const nombreInput = document.getElementById('nombreProcedencia');

    // Elementos del modal de edición
    const editModal = document.getElementById('editProcedenciaModal');
    const editForm = document.getElementById('formEditProcedencia');
    const editInput = document.getElementById('editNombreProcedencia');
    const editIdInput = document.getElementById('editProcedenciaId');
    const closeModalButton = editModal.querySelector('.close-button');

    /**
     * Carga y renderiza la lista de procedencias desde la API.
     */
    async function cargarProcedencias() {
        try {
            const res = await fetch(apiUrlProcedencias, { headers: authHeader });
            if (!res.ok) throw new Error('Error al cargar las procedencias.');
            
            const procedencias = await res.json();
            renderProcedencias(procedencias);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    /**
     * Dibuja la lista de procedencias en el DOM.
     * @param {Array} procedencias - El array de procedencias a mostrar.
     */
    function renderProcedencias(procedencias) {
        lista.innerHTML = '<h2>Procedencias Existentes</h2>';
        if (procedencias.length === 0) {
            lista.innerHTML += '<p>No hay procedencias guardadas.</p>';
            return;
        }

        procedencias.forEach(p => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'trabajo-item'; // Reutilizamos el estilo
            itemDiv.innerHTML = `
                <div class="user-info-line">
                    <p class="item-nombre">${p.nombre}</p>
                    <div class="item-actions">
                        <button class="btn-editar" data-id="${p.id}" data-nombre="${p.nombre}">✏️ Editar</button>
                        <button class="btn-eliminar" data-id="${p.id}">Eliminar</button>
                    </div>
                </div>
            `;
            lista.appendChild(itemDiv);
        });
    }

    // Manejar el envío del formulario para añadir una nueva procedencia
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = nombreInput.value.trim();
        if (!nombre) return;

        try {
            const res = await fetch(apiUrlProcedencias, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'No se pudo añadir la procedencia.');
            
            showToast('Procedencia añadida con éxito.');
            form.reset();
            cargarProcedencias(); // Recargar la lista
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // Delegación de eventos para los botones de eliminar
    // Delegación de eventos para los botones de acción (editar y eliminar)
    lista.addEventListener('click', async (e) => {
        // --- Lógica para Eliminar ---
        if (e.target.classList.contains('btn-eliminar')) {
            const id = e.target.dataset.id;
            const confirmado = await showConfirm('¿Seguro que quieres eliminar esta procedencia? No se podrá usar en nuevos bonsáis.');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrlProcedencias}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar.');
                    showToast('Procedencia eliminada.');
                    cargarProcedencias();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        // --- Lógica para Editar ---
        if (e.target.classList.contains('btn-editar')) {
            const id = e.target.dataset.id;
            const nombreActual = e.target.dataset.nombre;
            abrirModalEditar(id, nombreActual);
        }
    });

    // --- Lógica del Modal de Edición ---

    function abrirModalEditar(id, nombre) {
        editIdInput.value = id;
        editInput.value = nombre;
        editModal.style.display = 'block';
    }

    function cerrarModalEditar() {
        editModal.style.display = 'none';
        editForm.reset();
    }

    closeModalButton.onclick = cerrarModalEditar;

    window.addEventListener('click', (event) => {
        if (event.target === editModal) {
            cerrarModalEditar();
        }
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editIdInput.value;
        const nuevoNombre = editInput.value.trim();

        if (!nuevoNombre || !id) return;

        try {
            const res = await fetch(`${apiUrlProcedencias}/${id}`, {
                method: 'PUT',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: nuevoNombre })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'No se pudo actualizar.');
            
            showToast('Procedencia actualizada con éxito.');
            cerrarModalEditar();
            cargarProcedencias(); // Recargar la lista
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // Carga inicial
    cargarProcedencias();
});