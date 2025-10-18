import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

// --- Configuración de autenticación y UI ---
const { authHeader } = setupAuthUI('userInfo', '#header-actions');
const apiUrl = "http://localhost:3000/api/trabajos";
const form = document.getElementById("formTrabajo");
const lista = document.getElementById("listaTrabajos");
const submitButton = form.querySelector("button[type='submit']");
const modal = document.getElementById("trabajoModal");
const btnAbrirModal = document.getElementById("btnAbrirModal");
const spanCerrar = document.querySelector(".close-button");
const modalTitle = document.getElementById("modalTitle");

let modoEdicion = false;
let idEditar = null;

// --- Lógica del Modal ---
function abrirModal() {
    modal.style.display = "block";
}

function cerrarModal() {
    modal.style.display = "none";
    form.reset();
    modoEdicion = false;
    idEditar = null;
    submitButton.textContent = "Guardar";
}

btnAbrirModal.onclick = () => {
    abrirModalParaCrear();
};
spanCerrar.onclick = cerrarModal;
window.onclick = (event) => {
    if (event.target == modal) {
        cerrarModal();
    }
};

async function cargarTrabajos() {
    try {
        const res = await fetch(apiUrl, { headers: authHeader });
        if (!res.ok) throw new Error('Error al cargar los trabajos');
        const trabajos = await res.json();

        lista.innerHTML = ""; // Limpiar lista
        if (trabajos.length === 0) {
            lista.innerHTML = "<p>No hay trabajos registrados todavía.</p>";
            return;
        }

        trabajos.forEach(t => {
            const div = document.createElement("div");
            div.className = "trabajo-item";
            div.dataset.id = t.id;
            div.dataset.tipo = t.tipo_trabajo;
            div.dataset.fecha = t.fecha;
            div.innerHTML = `
                <p><strong>Trabajo:</strong> ${t.tipo_trabajo}</p>
                <p><strong>Fecha:</strong> ${new Date(t.fecha).toLocaleDateString()}</p>
                <div class="trabajo-acciones">
                    <button class="btn-editar">✏️ Editar</button>
                    <button class="btn-eliminar">❌ Eliminar</button>
                </div>
            `;
            lista.appendChild(div);
        });
    } catch (error) {
        console.error(error);
        lista.innerHTML = "<p>No se pudieron cargar los trabajos.</p>";
    }
}

// Delegación de eventos para los botones de la lista
lista.addEventListener('click', async (e) => {
    const itemDiv = e.target.closest('.trabajo-item');
    if (!itemDiv) return;

    const id = itemDiv.dataset.id;

    // Botón Eliminar
    if (e.target.classList.contains('btn-eliminar')) {
        const confirmado = await showConfirm("¿Seguro que quieres eliminar este trabajo?");
        if (confirmado) {
            try {
                const res = await fetch(`${apiUrl}/${id}`, {
                    method: "DELETE",
                    headers: authHeader
                });
                if (!res.ok) throw new Error('No se pudo eliminar el trabajo.');
                await cargarTrabajos();
                showToast("Trabajo eliminado correctamente.");
            } catch (error) {
                showToast(error.message, true);
            }
        }
    }

    // Botón Editar
    if (e.target.classList.contains('btn-editar')) {
        abrirModalParaEditar(itemDiv);
    }
});

function abrirModalParaCrear() {
    modoEdicion = false;
    idEditar = null;
    modalTitle.textContent = "Añadir Trabajo";
    form.fecha.value = new Date().toISOString().split('T')[0];
    submitButton.textContent = "➕ Añadir Trabajo";
    abrirModal();
}

function abrirModalParaEditar(itemDiv) {
    const id = itemDiv.dataset.id;
    const tipo = itemDiv.dataset.tipo;
    const fecha = itemDiv.dataset.fecha;

    form.tipo_trabajo.value = tipo; 
    form.fecha.value = new Date(fecha).toISOString().split('T')[0];

    modoEdicion = true;
    idEditar = id;
    submitButton.textContent = "💾 Guardar Cambios";
    modalTitle.textContent = "Editar Trabajo";
    abrirModal();
}

form.onsubmit = async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        let res;
        let successMessage;

        if (modoEdicion && idEditar) {
            // Actualizar trabajo existente
            res = await fetch(`${apiUrl}/${idEditar}`, {
                method: "PUT",
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al actualizar el trabajo.');
            successMessage = "Trabajo actualizado correctamente.";
        } else {
            // Crear nuevo trabajo
            res = await fetch(apiUrl, {
                method: "POST",
                headers: { ...authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al crear el trabajo.');
            successMessage = "Trabajo añadido correctamente.";
        }
        cerrarModal();
        await cargarTrabajos();
        showToast(successMessage);
    } catch (error) {
        showToast(error.message, true);
    }
};

cargarTrabajos();