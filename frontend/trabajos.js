import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');

    if (userRole === 'moderator') {
        document.body.innerHTML = `
            <div class="container">
                <h1>Acceso Denegado</h1>
                <p>No tienes permisos para gestionar las técnicas de bonsái.</p>
                <a href="/" class="back-link">&larr; Volver a Mis Bonsáis</a>
            </div>`;
        return;
    }

    const apiUrlTrabajos = "http://localhost:3000/api/trabajos";
    const form = document.getElementById('formTrabajo');
    const lista = document.getElementById('listaTrabajos');
    const nombreInput = document.getElementById('tipo_trabajo');
    const searchInput = document.getElementById('searchInput');

    // Modal de edición (lo mantenemos para editar)
    const editModal = document.createElement('div');
    editModal.id = 'editTrabajoModal';
    editModal.className = 'modal';
    editModal.innerHTML = `
        <div class="modal-content">
            <span class="close-button">&times;</span>
            <h2 id="editModalTitle">Editar Técnica</h2>
            <form id="formEditTrabajo">
                <input type="hidden" id="editTrabajoId">
                <div class="form-group">
                    <label for="editNombreTrabajo">Nuevo Nombre</label>
                    <input type="text" id="editNombreTrabajo" name="nombre" required autocomplete="off">
                </div>
                <button type="submit">💾 Guardar Cambios</button>
            </form>
        </div>
    `;
    document.body.appendChild(editModal);

    const editForm = document.getElementById('formEditTrabajo');
    const editInput = document.getElementById('editNombreTrabajo');
    const editIdInput = document.getElementById('editTrabajoId');
    const closeModalButton = editModal.querySelector('.close-button');

    let todosLosTrabajos = [];

    async function cargarTrabajos() {
        try {
            const res = await fetch(apiUrlTrabajos, { headers: authHeader });
            if (!res.ok) throw new Error('Error al cargar las técnicas.');
            todosLosTrabajos = await res.json();
            renderTrabajos(todosLosTrabajos);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function renderTrabajos(trabajos) {
        lista.innerHTML = '<h2>Técnicas Existentes</h2>';
        if (trabajos.length === 0) {
            lista.innerHTML += '<p>No hay técnicas guardadas.</p>';
            return;
        }

        trabajos.forEach(t => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'trabajo-item';

            let actionButtons = '';
            if (userRole === 'admin') {
                actionButtons = `
                    <div class="item-actions">
                        <button class="btn-editar" data-id="${t.id}" data-nombre="${t.tipo_trabajo}">✏️ Editar</button>
                        <button class="btn-eliminar" data-id="${t.id}">Eliminar</button>
                    </div>`;
            } else if (userRole === 'user') {
                actionButtons = `
                    <div class="item-actions">
                        <button class="btn-editar" data-id="${t.id}" data-nombre="${t.tipo_trabajo}">✏️ Editar</button>
                    </div>`;
            }

            itemDiv.innerHTML = `
                <div class="user-info-line">
                    <p class="item-nombre">${t.tipo_trabajo}</p>
                    ${actionButtons}
                </div>
            `;
            lista.appendChild(itemDiv);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = nombreInput.value.trim();
        if (!nombre) return;

        try {
            const res = await fetch(apiUrlTrabajos, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo_trabajo: nombre, fecha: new Date().toISOString().split('T')[0] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'No se pudo añadir la técnica.');
            
            showToast('Técnica añadida con éxito.');
            nombreInput.value = ''; // Limpiamos el campo de texto
            cargarTrabajos();
        } catch (error) {
            showToast(error.message, true);
            // Si el error es por duplicado, limpiamos el campo
            if (error.message.includes('ya existe')) {
                nombreInput.value = '';
            }
        }
    });

    lista.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-eliminar')) {
            const id = e.target.dataset.id;
            const confirmado = await showConfirm('¿Seguro que quieres eliminar esta técnica?');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrlTrabajos}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar.');
                    showToast('Técnica eliminada.');
                    cargarTrabajos();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        if (e.target.classList.contains('btn-editar')) {
            abrirModalEditar(e.target.dataset.id, e.target.dataset.nombre);
        }
    });

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
        if (event.target === editModal) cerrarModalEditar();
    });

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editIdInput.value;
        const nuevoNombre = editInput.value.trim();
        if (!nuevoNombre || !id) return;

        try {
            const res = await fetch(`${apiUrlTrabajos}/${id}`, {
                method: 'PUT',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo_trabajo: nuevoNombre, fecha: new Date().toISOString().split('T')[0] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'No se pudo actualizar.');
            
            showToast('Técnica actualizada con éxito.');
            cerrarModalEditar();
            cargarTrabajos();
        } catch (error) {
            showToast(error.message, true);
            // Si el error es por duplicado, limpiamos el campo del modal
            if (error.message.includes('ya está en uso')) {
                editInput.value = '';
            }
        }
    });

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const trabajosFiltrados = todosLosTrabajos.filter(t =>
            t.tipo_trabajo.toLowerCase().includes(searchTerm)
        );
        renderTrabajos(trabajosFiltrados);
    });

    cargarTrabajos();
});