import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const bonsaiId = params.get('id');

    const { authHeader, userRole, userId } = setupAuthUI('userInfo', '#header-actions');

    if (!bonsaiId) {
        window.location.href = '/';
        return;
    }

    const infoBonsaiDiv = document.getElementById('infoBonsai');
    const selectTrabajo = document.getElementById('selectTrabajo');
    const historialDiv = document.getElementById('historialTrabajos');
    const form = document.getElementById('formTrabajoBonsai');
    const modal = document.getElementById('trabajoBonsaiModal');
    const btnAbrirModal = document.getElementById('btnAbrirModalTrabajo');
    const spanCerrar = modal.querySelector(".close-button");
    const modalTitle = document.getElementById('trabajoModalTitle');
    const submitButton = form.querySelector('button[type="submit"]');

    // Elementos de Tareas Pendientes
    const formTarea = document.getElementById('formTareaPendiente');
    const selectTarea = document.getElementById('selectTarea');
    const tareaModal = document.getElementById('tareaPendienteModal');
    const btnAbrirModalTarea = document.getElementById('btnAbrirModalTarea');
    const spanCerrarTarea = tareaModal.querySelector(".close-button");
    const listaTareasDiv = document.getElementById('listaTareasPendientes');

    let modoEdicion = false; // Este estado ahora controla el modal
    let currentBonsai = null; // Para guardar la info del bonsái actual

    const apiUrlBonsais = 'http://localhost:3000/api/bonsais';
    const apiUrlTrabajos = 'http://localhost:3000/api/trabajos';
    const apiUrlTrabajosBonsai = 'http://localhost:3000/api/trabajos_bonsai';
    const apiUrlTareas = 'http://localhost:3000/api/tareas';

    // --- Lógica de Modales ---
    function abrirModal(modal) {
        modal.style.display = "block";
    }

    function cerrarModal(modal) {
        modal.style.display = "none";
        if (modal.id === 'trabajoBonsaiModal') cancelarEdicion();
        if (modal.id === 'tareaPendienteModal') formTarea.reset();
    }

    // Ocultar botón de añadir trabajo si es moderador
    if (userRole === 'moderator') { // También aplica al formulario de tareas
        btnAbrirModalTarea.style.display = 'none';
        btnAbrirModal.style.display = 'none';
    }

    btnAbrirModal.onclick = () => {
        modoEdicion = false;
        modalTitle.textContent = "Añadir Trabajo Realizado";
        submitButton.textContent = "Guardar Trabajo";
        form.reset();
        form.querySelector('#fecha').value = new Date().toISOString().split('T')[0];
        abrirModal(modal);
    };

    btnAbrirModalTarea.onclick = () => {
        abrirModal(tareaModal);
    };

    spanCerrar.onclick = () => cerrarModal(modal);
    spanCerrarTarea.onclick = () => cerrarModal(tareaModal);

    window.onclick = (event) => {
        if (event.target == modal) {
            cerrarModal(modal);
        } else if (event.target == tareaModal) {
            cerrarModal(tareaModal);
        }
    };

    // Cargar información del bonsái
    async function cargarInfoBonsai() {
        try {
            const res = await fetch(`${apiUrlBonsais}/${bonsaiId}`, { headers: authHeader });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'No se pudo cargar la información del bonsái.');
            }
            const bonsai = await res.json();
            currentBonsai = bonsai; // Guardamos el bonsái para usarlo después

            // Actualizar el título de la página con el nombre del bonsái
            document.title = `Detalle: ${bonsai.nombre}`;

            // Si todo va bien, mostramos la información
            infoBonsaiDiv.innerHTML = `
                <img src="http://localhost:3000${bonsai.foto}" alt="${bonsai.nombre}" class="detalle-bonsai-img">
                <div class="detalle-bonsai-texto">
                    <h1>${bonsai.nombre}</h1>
                    <div class="detalle-bonsai-grid">
                        <p><strong>Especie:</strong> ${bonsai.especie}</p>
                        <p><strong>Edad:</strong> ${bonsai.edad} años</p>
                        <p><strong>Procedencia:</strong> ${bonsai.procedencia || 'No especificado'}</p>
                        <p id="ultimoTrabajoP"><strong>Último trabajo:</strong> ${bonsai.fecha_riego ? new Date(bonsai.fecha_riego).toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            // Si hay un error (no encontrado, sin permisos, etc.), lo mostramos en la página.
            document.body.innerHTML = `<div class="container"><h1>Error</h1><p>${error.message}</p><a href="/" class="back-link">&larr; Volver</a></div>`;
            console.error(error);
        }
    }

    // Cargar los tipos de trabajo en el combobox
    async function cargarTiposDeTrabajo() {
        const res = await fetch(apiUrlTrabajos, { headers: authHeader });
        const trabajos = await res.json();
        trabajos.forEach(trabajo => {
            // Opción para el modal de trabajos realizados (usa ID como valor)
            const optionTrabajo = document.createElement('option');
            optionTrabajo.value = trabajo.id;
            optionTrabajo.textContent = trabajo.tipo_trabajo;
            selectTrabajo.appendChild(optionTrabajo);

            // Opción para el formulario de tareas pendientes (usa el nombre como valor)
            const optionTarea = document.createElement('option');
            optionTarea.value = trabajo.tipo_trabajo;
            optionTarea.textContent = trabajo.tipo_trabajo;
            selectTarea.appendChild(optionTarea);
        });
    }

    // Cargar el historial de trabajos del bonsái
    async function cargarHistorial() {
        const res = await fetch(`${apiUrlBonsais}/${bonsaiId}/trabajos`, { headers: authHeader });
        const historial = await res.json();
        historialDiv.innerHTML = ''; // Limpiar la lista antes de volver a dibujarla

        if (historial.length === 0) {
            historialDiv.innerHTML = '<p>No hay trabajos registrados para este bonsái.</p>';
            return;
        }

        // Actualizamos la fecha del último trabajo en la tarjeta de información
        const ultimoTrabajoP = document.getElementById('ultimoTrabajoP');
        if (ultimoTrabajoP) {
            const fechaMasReciente = historial[0].fecha; // El historial ya viene ordenado por fecha DESC
            ultimoTrabajoP.innerHTML = `<strong>Último trabajo:</strong> ${new Date(fechaMasReciente).toLocaleDateString()}`;
        } else if (ultimoTrabajoP) {
            ultimoTrabajoP.innerHTML = `<strong>Último trabajo:</strong> N/A`;
        }

        // Mostrar todos los trabajos
        historial.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'trabajo-item';
            itemDiv.dataset.id = item.id;
            itemDiv.dataset.trabajoId = item.trabajo_id;
            itemDiv.dataset.fecha = item.fecha;
            itemDiv.dataset.observaciones = item.observaciones || '';

            let actionButtons = '';
            if (userRole === 'admin' || (userRole === 'user' && currentBonsai.user_id === userId)) {
                actionButtons = `<div class="trabajo-acciones">
                                     <button class="btn-editar">✏️ Editar</button>
                                     <button class="btn-eliminar">❌ Eliminar</button>
                                 </div>`;
            } else if (userRole === 'moderator') {
                actionButtons = `<div class="trabajo-acciones"><button class="btn-eliminar">❌ Eliminar</button></div>`;
            }

            const observacionesHTML = item.observaciones 
                ? `<p><strong>Observaciones:</strong> ${item.observaciones}</p>`
                : '';

            itemDiv.innerHTML = `
                <h4>${item.tipo_trabajo} - ${new Date(item.fecha).toLocaleDateString()}</h4>
                <div class="trabajo-imagenes">
                    <div>
                        <strong>Antes</strong>
                        <img src="${item.foto_antes ? 'http://localhost:3000' + item.foto_antes : 'https://via.placeholder.com/250x250.png?text=Sin+Foto'}" alt="Foto del antes" class="historial-img">
                    </div>
                    <div>
                        <strong>Después</strong>
                        <img src="${item.foto_despues ? 'http://localhost:3000' + item.foto_despues : 'https://via.placeholder.com/250x250.png?text=Sin+Foto'}" alt="Foto del después" class="historial-img">
                    </div>
                </div>
                ${observacionesHTML}
                ${actionButtons}
            `;
            historialDiv.appendChild(itemDiv);
        });
    }

    // --- Lógica de Tareas Pendientes ---

    async function cargarTareasPendientes() {
        try {
            const res = await fetch(`${apiUrlBonsais}/${bonsaiId}/tareas`, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar las tareas pendientes.');
            const tareas = await res.json();
            renderTareas(tareas);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function renderTareas(tareas) {
        listaTareasDiv.innerHTML = '';
        if (tareas.length === 0) {
            listaTareasDiv.innerHTML = '<p>No hay tareas pendientes.</p>';
            return;
        }

        tareas.forEach(tarea => {
            const tareaDiv = document.createElement('div');
            tareaDiv.className = `trabajo-item tarea-item ${tarea.completada ? 'completada' : ''}`;
            tareaDiv.dataset.id = tarea.id;

            let actionButtons = '';
            if (userRole !== 'moderator') { // Los moderadores no pueden realizar acciones
                 actionButtons = `
                    <button class="btn-editar" data-id="${tarea.id}" data-action="mover">Completar y Mover</button>
                    <button class="btn-eliminar" data-id="${tarea.id}" data-type="tarea">Eliminar</button>
                 `;
            }

            const fechaLimiteHTML = tarea.fecha_limite 
                ? `<p class="tarea-info"><strong>Fecha Límite:</strong> ${new Date(tarea.fecha_limite).toLocaleDateString()}</p>` 
                : '';

            const observacionesHTML = tarea.observaciones
                ? `<p class="tarea-info"><strong>Obs:</strong> ${tarea.observaciones}</p>`
                : '';

            tareaDiv.innerHTML = `
                <div class="user-info-line">
                    <div class="tarea-descripcion">
                        <label>${tarea.descripcion}</label>
                    </div>
                    <div class="item-actions">
                        ${actionButtons}
                    </div>
                </div>
                <div class="tarea-detalles">
                    ${fechaLimiteHTML}
                    ${observacionesHTML}
                </div>
            `;
            listaTareasDiv.appendChild(tareaDiv);
        });
    }

    // Añadir nueva tarea
    formTarea.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formTarea);
        const data = Object.fromEntries(formData.entries());

        if (!data.descripcion) return;

        try {
            const res = await fetch(`${apiUrlBonsais}/${bonsaiId}/tareas`, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('No se pudo añadir la tarea.');
            showToast('Tarea añadida con éxito.');
            cerrarModal(tareaModal);
            await cargarTareasPendientes();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    // Marcar como completada o eliminar tarea
    listaTareasDiv.addEventListener('click', async (e) => {
        const target = e.target;
        const tareaId = target.dataset.id;

        // Mover tarea al historial
        if (target.dataset.action === 'mover') {
             const confirmado = await showConfirm('¿Mover esta tarea al historial de trabajos realizados?', 'Sí, mover');
             if (confirmado && tareaId) {
                 try {
                     const res = await fetch(`${apiUrlTareas}/${tareaId}/mover-a-historial`, { method: 'POST', headers: authHeader });
                     if (!res.ok) throw new Error('No se pudo mover la tarea.');
                     showToast('Tarea completada y movida al historial.');
                     await cargarTareasPendientes(); // Recargar lista de tareas
                     await cargarHistorial(); // Recargar historial de trabajos
                     await cargarInfoBonsai(); // Recargar info principal para actualizar fecha
                 } catch (error) {
                     showToast(error.message, true);
                 }
             }
         }

        // Eliminar tarea
        if (target.classList.contains('btn-eliminar') && target.dataset.type === 'tarea') {
            const confirmado = await showConfirm('¿Seguro que quieres eliminar esta tarea?');
            if (confirmado && tareaId) {
                const res = await fetch(`${apiUrlTareas}/${tareaId}`, { method: 'DELETE', headers: authHeader });
                if (res.ok) {
                    showToast('Tarea eliminada.');
                    await cargarTareasPendientes();
                } else {
                    showToast('No se pudo eliminar la tarea.', true);
                }
            }
        }
    });

    // Manejar el envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const trabajoBonsaiId = formData.get('trabajoBonsaiId');

        // Al usar FormData, no debemos establecer Content-Type manualmente.
        // El navegador lo hará automáticamente con el boundary correcto.
        const { 'Content-Type': _, ...headersSinContentType } = authHeader;

        try {
            let res;
            let successMessage;

            if (modoEdicion && trabajoBonsaiId) {
                // --- MODO EDICIÓN ---
                res = await fetch(`${apiUrlTrabajosBonsai}/${trabajoBonsaiId}`, {
                    method: 'PUT',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Trabajo actualizado con éxito';
            } else {
                // --- MODO CREACIÓN ---
                formData.append('bonsai_id', bonsaiId);
                res = await fetch(apiUrlTrabajosBonsai, {
                    method: 'POST',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Trabajo guardado con éxito';
            }

            if (!res.ok) throw new Error('Error al guardar el trabajo.');

            cerrarModal(modal);
            await cargarHistorial();
            await cargarInfoBonsai(); // Recargamos la info para asegurar que la fecha se actualiza
            showToast(successMessage);
        } catch (error) {
            console.error(error);
            showToast(error.message, true);
        }
    });

    // Delegación de eventos para editar y eliminar
    historialDiv.addEventListener('click', async (e) => {
        const target = e.target;
        const itemDiv = target.closest('.trabajo-item');

        if (target.classList.contains('btn-eliminar')) {
            if (!itemDiv) return;
            const id = itemDiv.dataset.id;
            
            const confirmado = await showConfirm('¿Seguro que quieres eliminar este trabajo del historial?');
            if (confirmado) {
                try {
                    const res = await fetch(`${apiUrlTrabajosBonsai}/${id}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar el trabajo.');
                    showToast('Trabajo eliminado.');
                    await cargarHistorial();
                    await cargarInfoBonsai(); // Recargamos la info para asegurar que la fecha se actualiza
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }

        if (target.classList.contains('btn-editar')) {
            if (!itemDiv) return;

            const id = itemDiv.dataset.id;
            const trabajoId = itemDiv.dataset.trabajoId;
            const fecha = itemDiv.dataset.fecha;
            const observaciones = itemDiv.dataset.observaciones;

            form.trabajoBonsaiId.value = id;
            selectTrabajo.value = trabajoId;
            form.fecha.value = new Date(fecha).toISOString().split('T')[0];
            form.observaciones_trabajo.value = observaciones;

            modoEdicion = true;
            modalTitle.textContent = "Editar Trabajo Realizado";
            submitButton.textContent = "💾 Guardar Cambios";
            abrirModal(modal);
        }


        if (target.classList.contains('historial-img')) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('lightboxImage');
            const closeModal = document.querySelector('.close-lightbox');

            modal.style.display = "block";
            modalImg.src = target.src;

            const close = () => {
                modal.style.display = "none";
            }

            closeModal.onclick = close;
            modal.onclick = (event) => {
                if (event.target === modal) close();
            };
        }
    });

    function cancelarEdicion() {
        form.reset();
        form.trabajoBonsaiId.value = '';
        modoEdicion = false;
        submitButton.textContent = "Guardar Trabajo";
        modalTitle.textContent = "Añadir Trabajo Realizado";
    }

    // Cargar todo al iniciar
    cargarInfoBonsai();
    cargarTiposDeTrabajo();
    cargarHistorial();
    cargarTareasPendientes();
});