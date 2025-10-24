import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const bonsaiId = params.get('id');

    if (!bonsaiId) {
        window.location.href = '/';
        return;
    }

    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');

    const form = document.getElementById('formCuidadosBonsai');
    const descriptionTextarea = document.getElementById('descripcion_cuidados');
    const bonsaiNameH1 = document.getElementById('bonsaiName');
    const backLink = document.getElementById('backLink');
    const saveButton = document.getElementById('saveButton');
    const deleteButton = document.getElementById('deleteButton');

    // Actualizar el enlace de "volver" para que apunte al detalle del bonsái correcto
    backLink.href = `/bonsai_detalle.html?id=${bonsaiId}`;

    const apiUrlBonsai = `http://localhost:3000/api/bonsais/${bonsaiId}`;
    const apiUrlCuidados = `http://localhost:3000/api/bonsais/${bonsaiId}/cuidados`;

    // Si el usuario es moderador, solo puede ver, no editar.
    if (userRole === 'moderator') {
        descriptionTextarea.readOnly = true;
        saveButton.style.display = 'none';
        deleteButton.style.display = 'none';
    }

    async function cargarDatos() {
        try {
            // Cargar nombre del bonsái
            const bonsaiRes = await fetch(apiUrlBonsai, { headers: authHeader });
            if (!bonsaiRes.ok) throw new Error('No se pudo cargar el bonsái.');
            const bonsai = await bonsaiRes.json();
            bonsaiNameH1.textContent = `Plan de Cuidados para: ${bonsai.nombre}`;
            document.title = `Cuidados: ${bonsai.nombre}`;

            // Cargar descripción de cuidados
            const cuidadosRes = await fetch(apiUrlCuidados, { headers: authHeader });
            if (!cuidadosRes.ok) throw new Error('No se pudieron cargar los cuidados.');
            const cuidados = await cuidadosRes.json();
            descriptionTextarea.value = cuidados.descripcion || '';

        } catch (error) {
            showToast(error.message, true);
            document.body.innerHTML = `<div class="container"><h1>Error</h1><p>${error.message}</p><a href="/" class="back-link">&larr; Volver</a></div>`;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (userRole === 'moderator') return; // Doble seguridad

        const data = { descripcion: descriptionTextarea.value };

        try {
            const res = await fetch(apiUrlCuidados, {
                method: 'POST',
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('No se pudieron guardar los cuidados.');
            showToast('Plan de cuidados guardado con éxito.');
            // Opcional: podrías redirigir al usuario de vuelta a la página de detalle
            // window.location.href = `/bonsai_detalle.html?id=${bonsaiId}`;
        } catch (error) {
            showToast(error.message, true);
        }
    });

    deleteButton.addEventListener('click', async () => {
        if (userRole === 'moderator') return;

        const confirmado = await showConfirm('¿Seguro que quieres eliminar todas las anotaciones de cuidados? Esta acción es irreversible.');
        if (confirmado) {
            try {
                const res = await fetch(apiUrlCuidados, {
                    method: 'DELETE',
                    headers: authHeader
                });
                if (!res.ok) throw new Error('No se pudieron eliminar los cuidados.');
                
                descriptionTextarea.value = ''; // Limpiar el textarea
                showToast('Plan de cuidados eliminado con éxito.');
            } catch (error) {
                showToast(error.message, true);
            }
        }
    });

    cargarDatos();
});