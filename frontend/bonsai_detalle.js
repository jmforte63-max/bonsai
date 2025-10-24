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
    const historialDiv = document.getElementById('historialTrabajos');
    const form = document.getElementById('formTrabajoBonsai');
    const modal = document.getElementById('trabajoBonsaiModal');
    const btnAbrirModal = document.getElementById('btnAbrirModalTrabajo');
    const spanCerrar = modal.querySelector(".close-button");
    const modalTitle = document.getElementById('trabajoModalTitle');
    const submitButton = form.querySelector('button[type="submit"]');

    // Elementos del combobox de trabajos
    const trabajoInput = document.getElementById('trabajo_id_input');
    const trabajosDataList = document.getElementById('trabajos-list');
    const trabajoIdHiddenInput = document.getElementById('trabajo_id');

    // Elementos de Tareas Pendientes
    const formTarea = document.getElementById('formTareaPendiente');
    const tareaModal = document.getElementById('tareaPendienteModal');
    const btnAbrirModalTarea = document.getElementById('btnAbrirModalTarea');
    const spanCerrarTarea = tareaModal.querySelector(".close-button");
    const listaTareasDiv = document.getElementById('listaTareasPendientes');
    const linkCuidados = document.getElementById('linkCuidados');
    const linkCalendario = document.getElementById('linkCalendario'); // Asumimos que el enlace tiene este ID

    const tareaInput = document.getElementById('descripcion_tarea');
    const tareasDataList = document.getElementById('tareas-list');

    let modoEdicion = false; // Este estado ahora controla el modal
    let tareaOrigenId = null; // Para saber si el modal se abrió desde una tarea
    let currentBonsai = null; // Para guardar la info del bonsái actual

    const apiUrlBonsais = 'http://localhost:3000/api/bonsais';
    const apiUrlTrabajos = 'http://localhost:3000/api/trabajos';
    const apiUrlTrabajosBonsai = 'http://localhost:3000/api/trabajos_bonsai';
    const apiUrlTareas = 'http://localhost:3000/api/tareas';

    let todosLosTiposDeTrabajo = []; // Para almacenar la lista completa con IDs

    // --- Lógica de Modales ---
    function abrirModal(modal) {
        modal.style.display = "block";
    }

    function cerrarModal(modal) {
        modal.style.display = "none";
        if (modal.id === 'trabajoBonsaiModal') cancelarEdicion();
        tareaOrigenId = null; // Limpiamos el ID de la tarea de origen
        if (modal.id === 'tareaPendienteModal') formTarea.reset();
    }

    // Ocultar botones para el moderador
    if (userRole === 'moderator') {
        btnAbrirModalTarea.style.display = 'none';
        btnAbrirModal.style.display = 'none';
        linkCuidados.style.display = 'none';
        if(linkCalendario) {
            linkCalendario.style.display = 'none';
        }
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

            // Configurar el enlace a la página de cuidados
            linkCuidados.href = `/cuidados.html?id=${bonsaiId}`;

            // Crear el HTML para la información de la maceta
            const macetaInfoHtml = bonsai.maceta_id
                ? `<p><strong>Maceta:</strong> ${bonsai.maceta_ancho}x${bonsai.maceta_largo}x${bonsai.maceta_profundo} cm. <a href="/macetas.html" style="color: #7dc36f;">Ver</a></p>`
                : `<p><strong>Maceta:</strong> Sin asignar</p>`;

            const abonoInfoHtml = bonsai.abono_nombre
                ? `<p><strong>Abono:</strong> ${bonsai.abono_nombre}</p>`
                : `<p><strong>Abono:</strong> Sin asignar</p>`;


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
                        ${macetaInfoHtml}
                        ${abonoInfoHtml}
                        <p id="ultimoTrabajoP"><strong>Último trabajo:</strong> ${bonsai.fecha_ultimo_trabajo ? new Date(bonsai.fecha_ultimo_trabajo).toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>
            `;

        } catch (error) {
            // Si hay un error (no encontrado, sin permisos, etc.), lo mostramos en la página.
            document.body.innerHTML = `<div class="container"><h1>Error</h1><p>${error.message}</p><a href="/" class="back-link">&larr; Volver</a></div>`;
            console.error(error);
        }
    }

    /**
     * Carga los tipos de trabajo y los popula en los elementos select/datalist.
     * @param {HTMLElement} [selectElement] - Un elemento <select> opcional para poblar.
     */
    async function cargarTiposDeTrabajo() {
    try {
        const res = await fetch(apiUrlTrabajos, { headers: authHeader });
        todosLosTiposDeTrabajo = await res.json();

        // Limpiar elementos antes de poblar, solo si existen
        if (trabajosDataList) trabajosDataList.innerHTML = '';
        if (tareasDataList) tareasDataList.innerHTML = '';

        todosLosTiposDeTrabajo.forEach(trabajo => {
            const option = document.createElement('option');
            option.value = trabajo.tipo_trabajo; // El valor del datalist es lo que se muestra

            if (trabajosDataList) trabajosDataList.appendChild(option.cloneNode(true));
            // Comprobamos si tareasDataList existe antes de usarlo
            if (tareasDataList) tareasDataList.appendChild(option.cloneNode(true));
        });
    } catch (error) {
        console.error("Error al cargar los tipos de trabajo:", error);
    }
    }

    trabajoInput.addEventListener('input', () => {
        const selectedTrabajo = todosLosTiposDeTrabajo.find(t => t.tipo_trabajo === trabajoInput.value);
        trabajoIdHiddenInput.value = selectedTrabajo ? selectedTrabajo.id : '';
    });

    // Cargar el historial de trabajos del bonsái
    async function cargarHistorial() {
        const res = await fetch(`${apiUrlBonsais}/${bonsaiId}/trabajos`, { headers: authHeader });
        const historial = await res.json();
        historialDiv.innerHTML = ''; // Limpiar la lista antes de volver a dibujarla

        if (historial.length === 0) {
            historialDiv.innerHTML = `
                <div class="empty-state-container" style="padding: 20px; margin-top: 0;">
                    <div class="empty-state-icon">📖</div>
                    <h2>Historial Vacío</h2>
                    <p>Aún no se han registrado trabajos para este bonsái.</p>
                    ${userRole !== 'moderator' ? '<p>¡Añade uno para empezar a ver su evolución!</p>' : ''}
                </div>
            `;
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
            listaTareasDiv.innerHTML = `
                <div class="empty-state-container" style="padding: 20px; margin-top: 0;">
                    <div class="empty-state-icon">✅</div>
                    <h2>¡Todo al día!</h2>
                    <p>No hay tareas pendientes para este bonsái.</p>
                </div>
            `;
            return;
        }

        tareas.forEach(tarea => {
            const tareaDiv = document.createElement('div');
            tareaDiv.className = `trabajo-item tarea-item ${tarea.completada ? 'completada' : ''}`;
            tareaDiv.dataset.id = tarea.id;

            let actionButtons = '';
            if (userRole !== 'moderator') { // Los moderadores no pueden realizar acciones
                 actionButtons = `
                    <button class="btn-editar btn-mover-historial" data-id="${tarea.id}" data-descripcion="${tarea.descripcion}" data-observaciones="${tarea.observaciones || ''}">Completar y Mover</button>
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

        // Abrir modal para mover tarea al historial
        if (target.classList.contains('btn-mover-historial')) {
            const descripcionTarea = target.dataset.descripcion;
            const observacionesTarea = target.dataset.observaciones;

            // Buscar el ID del trabajo que coincide con la descripción de la tarea
            const trabajoCoincidente = todosLosTiposDeTrabajo.find(t => t.tipo_trabajo.toLowerCase() === descripcionTarea.toLowerCase());

            if (!trabajoCoincidente) {
                showToast(`El tipo de trabajo "${descripcionTarea}" no existe. Por favor, créalo primero.`, true);
                return;
            }

            // Rellenar el formulario del modal
            form.reset();
            trabajoInput.value = trabajoCoincidente.tipo_trabajo;
            trabajoIdHiddenInput.value = trabajoCoincidente.id;
            form.fecha.value = new Date().toISOString().split('T')[0];
            form.observaciones_trabajo.value = observacionesTarea;

            // Configurar el modal para el modo "crear desde tarea"
            modoEdicion = false;
            tareaOrigenId = tareaId; // Guardamos el ID de la tarea
            modalTitle.textContent = "Completar Tarea y Mover a Historial";
            submitButton.textContent = "💾 Mover a Historial";
            
            abrirModal(modal);
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
            } else if (tareaOrigenId) {
                // --- MODO CREACIÓN DESDE TAREA ---
                res = await fetch(`${apiUrlTrabajosBonsai}/from-task/${tareaOrigenId}`, {
                    method: 'POST',
                    headers: headersSinContentType,
                    body: formData
                });
                successMessage = 'Tarea completada y movida al historial';

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
            await cargarTareasPendientes(); // Recargamos también las tareas por si venimos de una
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
            trabajoIdHiddenInput.value = trabajoId;
            trabajoInput.value = todosLosTiposDeTrabajo.find(t => t.id == trabajoId)?.tipo_trabajo || '';
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

    // Delegación de eventos para la imagen principal del bonsái
    infoBonsaiDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('detalle-bonsai-img')) {
            const modal = document.getElementById('imageModal');
            const modalImg = document.getElementById('lightboxImage');
            const closeModal = document.querySelector('.close-lightbox');

            modal.style.display = "block";
            modalImg.src = e.target.src;

            const close = () => {
                modal.style.display = "none";
            }

            closeModal.onclick = close;
            modal.onclick = (event) => { if (event.target === modal) close(); };
        }
    });

    function cancelarEdicion() {
        form.reset();
        form.trabajoBonsaiId.value = '';
        modoEdicion = false;
        submitButton.textContent = "Guardar Trabajo";
        modalTitle.textContent = "Añadir Trabajo Realizado";
    }

    // --- Carga Inicial de la Página ---
    async function inicializarPagina() {
        // Primero, cargamos la información esencial del bonsái y esperamos a que termine.
        await cargarInfoBonsai();

        // Si currentBonsai no se cargó (por un error o porque no existe), no continuamos.
        if (!currentBonsai) return;

        // Ahora que tenemos la info del bonsái, podemos cargar el resto en paralelo.
        await Promise.all([
            cargarTiposDeTrabajo(),
            cargarHistorial(),
            cargarTareasPendientes()
        ]);
    }

    inicializarPagina();
});