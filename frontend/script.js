import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

// --- Configuración de autenticación y UI (página principal) ---
const { authHeader, userRole, userId } = setupAuthUI('userInfo', '.header div');
const apiUrl = "http://localhost:3000/api/bonsais";
const apiUrlProcedencias = "http://localhost:3000/api/procedencias";
const form = document.getElementById("formBonsai");
const lista = document.getElementById("listaBonsais");
const modal = document.getElementById("bonsaiModal");
const btnAbrirModal = document.getElementById("btnAbrirModal");
const spanCerrar = document.querySelector(".close-button");
const modalTitle = document.getElementById("modalTitle");
const searchInput = document.getElementById('searchInput');
const linkGestionProcedencias = document.getElementById('linkGestionProcedencias');
const selectProcedencia = document.getElementById('selectProcedencia');

let todosLosBonsais = []; // Para almacenar la lista completa de bonsáis

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
}

// Ocultar el botón de "Añadir Bonsái" si el usuario es moderador
if (userRole === 'moderator') {
  btnAbrirModal.style.display = 'none';
}

// Mostrar enlace de gestión de procedencias si es admin
if (userRole === 'admin') {
  linkGestionProcedencias.style.display = 'inline-block';
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

/**
 * Dibuja los bonsáis en la lista del DOM.
 * @param {Array} bonsais - El array de bonsáis a mostrar.
 */
function renderBonsais(bonsais) {
  lista.innerHTML = "";
  bonsais.forEach(b => {
    const div = document.createElement("div");
    div.className = "bonsai";

    // Lógica para mostrar botones de acción según el rol
    let actionButtons = '';
    const isOwner = b.user_id === userId;

    if (userRole === 'admin' || isOwner) {
      actionButtons = `
        <button class="btn-editar" data-id="${b.id}">✏️ Editar</button>
        <button class="btn-eliminar" data-id="${b.id}">❌ Eliminar</button>`;
    } else if (userRole === 'moderator') {
      actionButtons = `<button class="btn-eliminar" data-id="${b.id}">❌ Eliminar</button>`;
    }

    // Lógica para mostrar el dueño (si es admin o moderador)
    const ownerInfo = (userRole === 'admin' || userRole === 'moderator') && b.owner_email ?
      `<p class="owner-info">Dueño: ${b.owner_email}</p>` : '';

    div.innerHTML = `
      <a href="/bonsai_detalle.html?id=${b.id}" style="text-decoration: none; color: inherit;">
        <img src="http://localhost:3000${b.foto}" alt="${b.nombre}" />
        <h3>${b.nombre}</h3>
      </a>
      ${ownerInfo}
      ${actionButtons}
    `;
    lista.appendChild(div);
  });
}

async function cargarBonsais() {
  const res = await fetch(apiUrl, { headers: authHeader });
  if (res.ok) {
    todosLosBonsais = await res.json();
    renderBonsais(todosLosBonsais);
    return todosLosBonsais; // Devolvemos los datos para usarlos después
  } else {
    console.error("Error al cargar los bonsáis");
    return [];
  }
}

async function eliminarBonsai(id) {  
  const confirmado = await showConfirm("¿Seguro que quieres eliminar este bonsái?");
  if (confirmado) {
    try {
      const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE", headers: authHeader });
      if (!res.ok) throw new Error('No se pudo eliminar el bonsái.');
      cargarBonsais(); // Recargamos la lista en la misma página
      showToast("Bonsái eliminado correctamente.");
    } catch (error) {
        showToast(error.message, true);
    }
  }
}

/**
 * Carga las procedencias desde la API y las añade al select.
 */
async function cargarProcedencias() {
  try {
    const res = await fetch(apiUrlProcedencias, { headers: authHeader });
    const procedencias = await res.json();
    selectProcedencia.innerHTML = '<option value="">-- Selecciona una procedencia --</option>'; // Limpiar y añadir opción por defecto
    procedencias.forEach(p => {
      const option = new Option(p.nombre, p.nombre); // El valor y el texto son el nombre
      selectProcedencia.add(option);
    });
  } catch (error) {
    console.error("Error al cargar procedencias:", error);
  }
}

function abrirModalParaCrear() {
  modoEdicion = false;
  idEditar = null;
  modalTitle.textContent = "Añadir Bonsái";
  form.querySelector("button[type='submit']").textContent = "➕ Añadir Bonsái";
  abrirModal();
}

function abrirModalParaEditar(bonsai) {
  // Doble chequeo de seguridad: solo el dueño o un admin pueden editar.
  if (userRole !== 'admin' && bonsai.user_id !== userId) {
    showToast("No tienes permiso para editar este bonsái.", true);
    return;
  }

  // Ya tenemos el bonsái, no necesitamos hacer fetch de nuevo.
  const b = bonsai;
  
  // Rellenar formulario
  form.nombre.value = b.nombre;
  form.especie.value = b.especie;
  form.edad.value = b.edad;
  selectProcedencia.value = b.procedencia || '';
  form.fecha_riego.value = b.fecha_riego;

  modoEdicion = true;
  idEditar = b.id;
  modalTitle.textContent = "Editar Bonsái";
  form.querySelector("button[type='submit']").textContent = "💾 Guardar Cambios";
  abrirModal();
}

form.onsubmit = async e => {
  e.preventDefault();
  const formData = new FormData(form);

  // Al usar FormData, no debemos establecer Content-Type manualmente.
  // El navegador lo hará automáticamente con el boundary correcto.
  const { 'Content-Type': _, ...headersSinContentType } = authHeader;

  try {
    let res;
    let successMessage;

    if (modoEdicion && idEditar) {
      // Actualizar bonsái existente
      res = await fetch(`${apiUrl}/${idEditar}`, {
        method: "PUT",
        headers: headersSinContentType,
        body: formData
      });
      successMessage = "Bonsái actualizado correctamente.";
    } else {
      // Crear nuevo bonsái
      res = await fetch(apiUrl, {
        method: "POST",
        headers: headersSinContentType,
        body: formData
      });
      successMessage = "Bonsái añadido correctamente.";
    }

    if (!res.ok) throw new Error('Ocurrió un error al guardar.');

    cerrarModal();
    cargarBonsais();
    showToast(successMessage);
  } catch (error) {
    showToast(error.message, true);
  }
};

// Usar delegación de eventos para los botones de eliminar y editar
lista.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar')) {
        const id = e.target.dataset.id;
        eliminarBonsai(id);
    }
    if (e.target.classList.contains('btn-editar')) {
        const id = parseInt(e.target.dataset.id, 10);
        // Buscamos el bonsái en la lista que ya tenemos cargada
        const bonsaiAEditar = todosLosBonsais.find(b => b.id === id);
        if (bonsaiAEditar) abrirModalParaEditar(bonsaiAEditar);
    }
});

// Event listener para la barra de búsqueda
searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const bonsaisFiltrados = todosLosBonsais.filter(bonsai => {
        return bonsai.nombre.toLowerCase().includes(searchTerm) ||
               bonsai.especie.toLowerCase().includes(searchTerm);
    });
    renderBonsais(bonsaisFiltrados);
});


async function inicializarApp() {
    cargarBonsais();
    cargarProcedencias();
}

inicializarApp();
