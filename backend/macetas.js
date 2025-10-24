import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');
    const apiUrl = 'http://localhost:3000/api/macetas';

    const listaMacetasDiv = document.getElementById('listaMacetas');
    const modal = document.getElementById('macetaModal');
    const btnAbrirModal = document.getElementById('btnAbrirModal');
    const spanCerrar = modal.querySelector('.close-button');
    const form = document.getElementById('formMaceta');
    const modalTitle = document.getElementById('modalTitle');

    let modoEdicion = false;
    let idEditar = null;
    let macetasCargadas = []; // Almacenamos las macetas aquí para no recargarlas

    // --- Lógica del Modal ---
    function abrirModal() { modal.style.display = 'block'; }
    function cerrarModal() {
        modal.style.display = 'none';
        form.reset();
        modoEdicion = false;
        idEditar = null;
    }

    if (userRole === 'moderator') {
        btnAbrirModal.style.display = 'none';
    }

    btnAbrirModal.onclick = () => {
        modoEdicion = false;
        modalTitle.textContent = 'Añadir Maceta';
        form.querySelector('button[type="submit"]').textContent = '➕ Añadir Maceta';
        abrirModal();
    };
    spanCerrar.onclick = cerrarModal;
    window.onclick = (event) => {
        if (event.target == modal) cerrarModal();
    };

    // --- Cargar y Renderizar Macetas ---
    async function cargarMacetas() {
        try {
            const res = await fetch(apiUrl, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar las macetas.');
            macetasCargadas = await res.json(); // Guardamos las macetas en la variable
            renderMacetas(macetasCargadas);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function renderMacetas(macetas) {
        listaMacetasDiv.innerHTML = '';
        if (macetas.length === 0) {
            listaMacetasDiv.innerHTML = '<p>No tienes ninguna maceta registrada.</p>';
            return;
        }

        macetas.forEach(maceta => {
            const macetaDiv = document.createElement('div');
            macetaDiv.className = 'trabajo-item'; // Reutilizamos el estilo de lista
            macetaDiv.innerHTML = `
                <div class="user-info-line">
                    <div class="maceta-info">
                        <img src="${maceta.foto ? 'http://localhost:3000' + maceta.foto : 'https://via.placeholder.com/80x80.png?text=Sin+Foto'}" alt="Maceta" class="maceta-thumb" />
                        <div>
                            <p><strong>Medidas:</strong> ${maceta.ancho}cm (ancho) x ${maceta.largo}cm (largo) x ${maceta.profundo}cm (profundo)</p>
                            <p><strong>Estado:</strong> 
                                <span class="user-status-text ${maceta.libre ? 'status-approved' : 'status-pending'}">
                                    ${maceta.libre ? 'Libre' : 'Ocupada'}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-editar" data-id="${maceta.id}">✏️ Editar</button>
                        <button class="btn-eliminar" data-id="${maceta.id}">❌ Eliminar</button>
                    </div>
                </div>
            `;
            listaMacetasDiv.appendChild(macetaDiv);
        });
    }

    // --- Lógica de Formulario (Crear/Editar) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const { 'Content-Type': _, ...headersSinContentType } = authHeader;

        try {
            let res;
            let successMessage;

            if (modoEdicion && idEditar) {
                res = await fetch(`${apiUrl}/${idEditar}`, {
                    method: 'PUT',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Maceta actualizada correctamente.';
            } else {
                res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Maceta añadida correctamente.';
            }

            if (!res.ok) throw new Error('Ocurrió un error al guardar la maceta.');

            cerrarModal();
            await cargarMacetas();
            showToast(successMessage);
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // --- Delegación de Eventos (Editar/Eliminar) ---
    listaMacetasDiv.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('btn-eliminar')) {
            const confirmado = await showConfirm('¿Seguro que quieres eliminar esta maceta?');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrl}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar la maceta.');
                    showToast('Maceta eliminada.');
                    await cargarMacetas();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        if (target.classList.contains('btn-editar')) {
            // Buscamos la maceta en la lista que ya tenemos cargada
            const macetaAEditar = macetasCargadas.find(m => m.id == id);

            if (macetaAEditar) {
                modoEdicion = true;
                idEditar = id;
                modalTitle.textContent = 'Editar Maceta';
                form.querySelector('button[type="submit"]').textContent = '💾 Guardar Cambios';

                form.ancho.value = macetaAEditar.ancho;
                form.largo.value = macetaAEditar.largo;
                form.profundo.value = macetaAEditar.profundo;

                abrirModal();
            }
        }
    });

    // Carga inicial
    cargarMacetas();
});