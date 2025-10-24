import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const authData = setupAuthUI('userInfo', '#header-actions');
    const { authHeader, userRole } = authData;

    // Inyectamos el menú lateral antes de cualquier otra lógica
    if (userRole === 'moderator') {
        document.body.innerHTML = `
            <div class="container">
                <h1>Acceso Denegado</h1>
                <p>No tienes permisos para gestionar los abonos.</p>
                <a href="/" class="back-link">&larr; Volver a Mis Bonsáis</a>
            </div>`;
        return;
    }
    
    // Crear la cabecera estándar para páginas de gestión
    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
        <a href="/" class="back-link">&larr; Volver a Mis Bonsáis</a>
        <div id="header-actions"></div> <!-- authUI inyecta aquí el user info y logout -->
    `;
    const titleHeader = document.createElement('div');
    titleHeader.className = 'header';
    titleHeader.innerHTML = `
        <h1 style="margin: 0;">Gestionar Abonos</h1>
        <button id="btnAbrirAddModal" class="nav-link">Añadir Nuevo Abono</button>
    `;

    const container = document.querySelector('.container');
    container.prepend(titleHeader);
    container.prepend(header);

    const apiUrlAbonos = "http://localhost:3000/api/abonos";
    const searchInput = document.getElementById('searchInput');
    const lista = document.getElementById('listaAbonos');

    let todosLosAbonos = []; // Caché para la búsqueda

    // Elementos del modal de añadir
    const addModal = document.getElementById('addAbonoModal');
    const formAddAbono = document.getElementById('formAddAbono');
    const btnAbrirAddModal = document.getElementById('btnAbrirAddModal');
    const closeAddModalButton = addModal.querySelector('.close-button');

    // Elementos del modal de edición
    const editModal = document.getElementById('editAbonoModal');
    const editForm = document.getElementById('formEditAbono');
    const closeModalButton = editModal.querySelector('.close-button');

    // --- Lógica de Modales ---
    btnAbrirAddModal.onclick = () => addModal.style.display = 'block';
    closeAddModalButton.onclick = () => addModal.style.display = 'none';
    closeModalButton.onclick = cerrarModalEditar;

    window.addEventListener('click', (event) => {
        if (event.target === editModal) cerrarModalEditar();
        if (event.target === addModal) addModal.style.display = 'none';
    });


    async function cargarAbonos() {
        try {
            const res = await fetch(apiUrlAbonos, { headers: authHeader });
            if (!res.ok) throw new Error('Error al cargar los abonos.');
            todosLosAbonos = await res.json();
            renderAbonos(todosLosAbonos);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function renderAbonos(abonos) {
        lista.innerHTML = '<h2>Abonos Guardados</h2>';
        if (abonos.length === 0) {
            lista.innerHTML += '<p>No hay abonos guardados.</p>';
            return;
        }

        abonos.forEach(abono => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'trabajo-item';

            const observacionesHTML = abono.observaciones ? `<p><strong>Observaciones:</strong> ${abono.observaciones}</p>` : '';

            itemDiv.innerHTML = `
                <div class="user-info-line">
                    <p class="item-nombre">${abono.nombre}</p>
                    <div class="item-actions">
                        <button class="btn-editar" data-id="${abono.id}">✏️ Editar</button>
                        <button class="btn-eliminar" data-id="${abono.id}">Eliminar</button>
                    </div>
                </div>
                <p><strong>Tipo:</strong> ${abono.tipo || 'No especificado'}</p>
                ${observacionesHTML}
            `;
            // Guardamos los datos del abono en el elemento para fácil acceso
            itemDiv.dataset.abono = JSON.stringify(abono);
            lista.appendChild(itemDiv);
        });
    }

    formAddAbono.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formAddAbono);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch(apiUrlAbonos, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const responseData = await res.json();
            if (!res.ok) throw new Error(responseData.message || 'No se pudo añadir el abono.');
            
            showToast('Abono añadido con éxito.');
            addModal.style.display = 'none'; // Cerramos el modal solo si todo fue bien
            formAddAbono.reset();
            await cargarAbonos(); // Esperamos a que la lista se recargue
        } catch (error) {
            showToast(error.message, true);
        }
    });

    lista.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-eliminar')) {
            const id = e.target.dataset.id;
            const confirmado = await showConfirm('¿Seguro que quieres eliminar este abono?');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrlAbonos}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar.');
                    showToast('Abono eliminado.');
                    cargarAbonos();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        if (e.target.classList.contains('btn-editar')) {
            const itemDiv = e.target.closest('.trabajo-item');
            const abono = JSON.parse(itemDiv.dataset.abono);
            abrirModalEditar(abono);
        }
    });

    function abrirModalEditar(abono) {
        editForm.innerHTML = `
            <input type="hidden" id="editAbonoId" name="id" value="${abono.id}">
            <div class="form-group">
                <label for="editNombreAbono">Nombre del Abono</label>
                <input type="text" id="editNombreAbono" name="nombre" required autocomplete="off" value="${abono.nombre}">
            </div>
            <div class="form-group">
                <label for="editTipoAbono">Tipo</label>
                <input type="text" id="editTipoAbono" name="tipo" autocomplete="off" value="${abono.tipo || ''}">
            </div>
            <div class="form-group">
                <label for="editObservacionesAbono">Observaciones</label>
                <textarea id="editObservacionesAbono" name="observaciones" rows="3">${abono.observaciones || ''}</textarea>
            </div>
            <button type="submit">💾 Guardar Cambios</button>
        `;
        editModal.style.display = 'block';
    }

    function cerrarModalEditar() {
        editModal.style.display = 'none';
        editForm.innerHTML = ''; // Limpiamos el contenido
    }

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editForm);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;

        if (!id) return;

        try {
            const res = await fetch(`${apiUrlAbonos}/${id}`, {
                method: 'PUT',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const responseData = await res.json();
            if (!res.ok) throw new Error(responseData.message || 'No se pudo actualizar.');
            
            showToast('Abono actualizado con éxito.');
            cerrarModalEditar();
            cargarAbonos();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // Event listener para la barra de búsqueda
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const abonosFiltrados = todosLosAbonos.filter(abono => {
            return abono.nombre.toLowerCase().includes(searchTerm) ||
                   (abono.tipo && abono.tipo.toLowerCase().includes(searchTerm));
        });
        renderAbonos(abonosFiltrados);
    });

    cargarAbonos();
});