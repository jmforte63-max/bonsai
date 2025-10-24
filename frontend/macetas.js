import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');
    const apiUrlMacetas = 'http://localhost:3000/api/macetas';
    const apiUrlBonsais = 'http://localhost:3000/api/bonsais';

    const listaMacetasDiv = document.getElementById('listaMacetas');
    const modal = document.getElementById('macetaModal');
    const btnAbrirModal = document.getElementById('btnAbrirModal');
    const spanCerrar = modal.querySelector('.close-button');
    const form = document.getElementById('formMaceta');
    const modalTitle = document.getElementById('modalTitle');
    const selectBonsai = document.getElementById('selectBonsai');

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

    // --- Cargar Bonsáis para el Select ---
    async function cargarBonsaisParaSelect() {
        try {
            const res = await fetch(apiUrlBonsais, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar los bonsáis.');
            const bonsais = await res.json();
            
            const sinAsignarOption = selectBonsai.options[0];
            selectBonsai.innerHTML = '';
            selectBonsai.appendChild(sinAsignarOption);

            bonsais.forEach(bonsai => {
                selectBonsai.add(new Option(bonsai.nombre, bonsai.id));
            });
        } catch (error) {
            showToast(error.message, true);
        }
    }

    // --- Cargar y Renderizar Macetas ---
    async function cargarMacetas() {
        try {
            const res = await fetch(apiUrlMacetas, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar las macetas.');
            macetasCargadas = await res.json();
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
            macetaDiv.className = 'trabajo-item';

            const estadoHTML = maceta.libre
                ? `<span class="user-status-text status-approved">Libre</span>`
                : `<span class="user-status-text status-pending">Ocupada por: <strong>${maceta.bonsai_nombre || 'N/A'}</strong></span>`;

            macetaDiv.innerHTML = `
                <div class="user-info-line">
                    <div class="maceta-info">
                        <img src="${maceta.foto ? 'http://localhost:3000' + maceta.foto : 'https://via.placeholder.com/80x80.png?text=Sin+Foto'}" alt="Maceta" class="maceta-thumb maceta-img-clickable" />
                        <div>
                            <p><strong>Medidas:</strong> ${maceta.ancho}cm (ancho) x ${maceta.largo}cm (largo) x ${maceta.profundo}cm (profundo)</p>
                            <p><strong>Estado:</strong> ${estadoHTML}</p>
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
                res = await fetch(`${apiUrlMacetas}/${idEditar}`, {
                    method: 'PUT',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Maceta actualizada correctamente.';
            } else {
                res = await fetch(apiUrlMacetas, {
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

    // --- Delegación de Eventos (Editar/Eliminar/Ampliar Imagen) ---
    listaMacetasDiv.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.dataset.id;

        if (target.classList.contains('btn-eliminar')) {
            const confirmado = await showConfirm('¿Seguro que quieres eliminar esta maceta?');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrlMacetas}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar la maceta.');
                    showToast('Maceta eliminada.');
                    await cargarMacetas();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        if (target.classList.contains('btn-editar')) {
            const macetaAEditar = macetasCargadas.find(m => m.id == id);
            if (macetaAEditar) {
                modoEdicion = true;
                idEditar = id;
                modalTitle.textContent = 'Editar Maceta';
                form.querySelector('button[type="submit"]').textContent = '💾 Guardar Cambios';

                form.ancho.value = macetaAEditar.ancho;
                form.largo.value = macetaAEditar.largo;
                form.profundo.value = macetaAEditar.profundo;
                selectBonsai.value = macetaAEditar.bonsai_id || 'null';

                abrirModal();
            }
        }

        if (target.classList.contains('maceta-img-clickable')) {
            const imageModal = document.getElementById('imageModal');
            const modalImg = document.getElementById('lightboxImage');
            const closeLightbox = imageModal.querySelector('.close-lightbox');

            imageModal.style.display = "block";
            modalImg.src = target.src;

            const close = () => {
                imageModal.style.display = "none";
            };

            closeLightbox.onclick = close;
            imageModal.onclick = (event) => { if (event.target === imageModal) close(); };
        }
    });

    // Carga inicial
    cargarMacetas();
    cargarBonsaisParaSelect();
});