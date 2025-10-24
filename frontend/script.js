import { showToast, showConfirm } from './utils.js';
import { setupAuthUI } from './authUI.js';

// --- Configuración de autenticación y UI (página principal) ---
const { authHeader, userRole, userId } = setupAuthUI('userInfo', '#header-actions');

const apiUrl = "http://localhost:3000/api/bonsais";
const apiUrlProcedencias = "http://localhost:3000/api/procedencias";
const apiUrlAbonos = "http://localhost:3000/api/abonos";
const form = document.getElementById("formBonsai");
const lista = document.getElementById("listaBonsais");
const modal = document.getElementById("bonsaiModal");
const btnAbrirModal = document.getElementById("btnAbrirModal");
const spanCerrar = document.querySelector(".close-button");
const modalTitle = document.getElementById("modalTitle");
const searchInput = document.getElementById('searchInput');
const linkCalendario = document.getElementById('linkCalendario'); // Asumimos que el enlace tiene este ID
const menuGestion = document.getElementById('menuGestion');
const abonoSelect = document.getElementById('abono_id');
const procedenciasDataList = document.getElementById('procedencias-list');


let todosLosBonsais = []; // Para almacenar la lista completa de bonsáis
let todasLasProcedencias = []; // Para almacenar la lista completa de procedencias

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
  // Ocultar también el enlace al calendario
  if(linkCalendario) {
    linkCalendario.style.display = 'none';
  }
}

// Mostrar enlace de gestión de procedencias si es admin o user
if (userRole === 'admin' || userRole === 'user') {
  menuGestion.style.display = 'inline-block';
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
  if (bonsais.length === 0) {
    // Si no hay bonsáis, mostramos el estado vacío amigable
    lista.innerHTML = `
      <div class="empty-state-container">
        <div class="empty-state-icon">🌱</div>
        <h2>¡Tu colección está esperando!</h2>
        <p>Añade tu primer bonsái para empezar a registrar sus cuidados.</p>
        ${userRole !== 'moderator' ? '<p>Usa el botón <strong>"Añadir Bonsái"</strong> para comenzar.</p>' : ''}
      </div>
    `;
    // Ocultamos la barra de búsqueda si no hay nada que buscar
    searchInput.style.display = 'none';
  } else {
    // Si hay bonsáis, los mostramos y aseguramos que la búsqueda esté visible
    searchInput.style.display = 'flex';
    bonsais.forEach(b => {
      const div = document.createElement("div");
      div.className = "bonsai";

      // Lógica para mostrar botones de acción según el rol
      let actionButtons = '';
      const isOwner = b.user_id === userId;

      if (userRole === 'admin' || isOwner) {
        actionButtons = `
          <div class="bonsai-actions">
            <button class="btn-editar" data-id="${b.id}">✏️ Editar</button>
            <button class="btn-eliminar" data-id="${b.id}">❌ Eliminar</button>
          </div>`;
      } else if (userRole === 'moderator') {
        actionButtons = `
          <div class="bonsai-actions">
            <button class="btn-eliminar" data-id="${b.id}">❌ Eliminar</button>
          </div>`;
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
        procedenciasDataList.innerHTML = ''; // Limpiar la lista
        procedencias.forEach(p => {
            const option = document.createElement('option');
            option.value = p.nombre;
            procedenciasDataList.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar procedencias:", error);
    }
}

/**
 * Carga los abonos desde la API y los añade al select.
 */
async function cargarAbonos() {
    try {
        const res = await fetch(apiUrlAbonos, { headers: authHeader });
        const abonos = await res.json();

        // Guardar la primera opción ("Ninguno")
        const defaultOption = abonoSelect.options[0];
        abonoSelect.innerHTML = '';
        abonoSelect.appendChild(defaultOption);

        abonos.forEach(abono => {
            const option = new Option(`${abono.nombre} (${abono.tipo || 'N/A'})`, abono.id);
            abonoSelect.add(option);
        });
    } catch (error) {
        console.error("Error al cargar abonos:", error);
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
  form.procedencia.value = b.procedencia || '';
  form.fecha_riego.value = b.fecha_riego;
  form.abono_id.value = b.abono_id || '';

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

// --- Lógica para el menú desplegable "Gestionar" ---
const dropdownToggle = document.querySelector('.dropdown-toggle');
if (dropdownToggle) {
    dropdownToggle.addEventListener('click', function() {
        const dropdownContent = this.nextElementSibling;
        const arrow = this.querySelector('.arrow');

        // Alternar la visibilidad del contenido
        if (dropdownContent.classList.contains('show')) {
            dropdownContent.classList.remove('show');
            arrow.classList.remove('open');
        } else {
            dropdownContent.classList.add('show');
            arrow.classList.add('open');
        }
    });
}


async function inicializarApp() {
    await cargarBonsais();
    await cargarProcedencias();
    await cargarAbonos();
}

inicializarApp();
