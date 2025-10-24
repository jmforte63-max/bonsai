import { setupAuthUI } from './authUI.js';
import { showToast, showConfirm } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader } = setupAuthUI('userInfo', '#header-actions');
    const apiUrl = 'http://localhost:3000/api/species';

    const speciesListDiv = document.getElementById('speciesList');
    const modal = document.getElementById('speciesModal');
    const btnOpenModal = document.getElementById('btnOpenModal');
    const closeModalBtn = modal.querySelector('.close-button');
    const form = document.getElementById('formSpecies');
    const modalTitle = document.getElementById('modalTitle');

    // Elementos del nuevo modal de visualización
    const viewModal = document.getElementById('viewSpeciesModal');
    const viewModalTitle = document.getElementById('viewModalTitle');
    const viewModalDescription = document.getElementById('viewModalDescription');

    let allSpecies = [];
    let editMode = false;
    let currentSpeciesId = null;

    // --- Modal Logic ---
    const openModal = () => modal.style.display = 'block';
    const closeModal = () => {
        modal.style.display = 'none';
        form.reset();
        editMode = false;
        currentSpeciesId = null;
    };

    const closeViewModal = () => viewModal.style.display = 'none';


    btnOpenModal.addEventListener('click', () => {
        modalTitle.textContent = 'Añadir Ficha de Especie';
        form.querySelector('button[type="submit"]').textContent = '💾 Guardar Ficha';
        openModal();
    });
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
        if (e.target === viewModal) closeViewModal();
    });
    viewModal.querySelector('.close-button').addEventListener('click', () => {
        closeViewModal();
    });

    // --- API & Rendering Logic ---
    async function loadSpecies() {
        try {
            const res = await fetch(apiUrl, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar las fichas de especies.');
            allSpecies = await res.json();
            renderSpecies(allSpecies);
        } catch (error) {
            showToast(error.message, true);
        }
    }

    function renderSpecies(species) {
        speciesListDiv.innerHTML = '';
        if (species.length === 0) {
            speciesListDiv.innerHTML = `
                <div class="empty-state-container">
                    <div class="empty-state-icon">📚</div>
                    <h2>Tu biblioteca de especies está vacía</h2>
                    <p>Crea fichas de cuidados para tener a mano toda la información sobre tus especies favoritas.</p>
                </div>`;
            return;
        }

        species.forEach(s => {
            const card = document.createElement('div');
            card.className = 'species-card trabajo-item';
            card.dataset.id = s.id;

            // Truncar descripción para la vista previa
            const previewText = s.descripcion ? (s.descripcion.substring(0, 150) + (s.descripcion.length > 150 ? '...' : '')) : 'Sin descripción.';

            card.innerHTML = `
                <div class="species-card-header">
                    <h4>${s.especie}</h4>
                    <div class="item-actions">
                        <button class="btn-editar" data-action="view" style="background-color: #27ae60; box-shadow: 0 4px #229954;">👁️ Ver Ficha</button>
                        <button class="btn-editar" data-action="edit">✏️ Editar</button>
                        <button class="btn-eliminar" data-action="delete">❌ Eliminar</button>
                    </div>
                </div>
                <p class="species-card-description">${previewText.replace(/\n/g, '<br>')}</p>
            `;
            speciesListDiv.appendChild(card);
        });
    }

    // --- Event Handlers ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
            especie: formData.get('especie'),
            descripcion: formData.get('descripcion')
        };

        try {
            let res;
            let successMessage;

            if (editMode && currentSpeciesId) {
                res = await fetch(`${apiUrl}/${currentSpeciesId}`, {
                    method: 'PUT',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                successMessage = 'Ficha actualizada correctamente.';
            } else {
                res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { ...authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                successMessage = 'Ficha de especie creada con éxito.';
            }

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Error al guardar la ficha.');
            }

            showToast(successMessage);
            closeModal();
            await loadSpecies();
        } catch (error) {
            showToast(error.message, true);
        }
    });

    speciesListDiv.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const card = button.closest('.species-card');
        const speciesId = card.dataset.id;
        const action = button.dataset.action;

        if (action === 'view') {
            const speciesToView = allSpecies.find(s => s.id == speciesId);
            if (speciesToView) {
                viewModalTitle.textContent = speciesToView.especie;
                viewModalDescription.textContent = speciesToView.descripcion || 'No hay una descripción de cuidados para esta especie.';
                viewModal.style.display = 'block';
            }
        }

        else if (action === 'edit') {
            const speciesToEdit = allSpecies.find(s => s.id == speciesId);
            if (speciesToEdit) {
                editMode = true;
                currentSpeciesId = speciesId;
                modalTitle.textContent = 'Editar Ficha de Especie';
                form.querySelector('button[type="submit"]').textContent = '💾 Guardar Cambios';
                form.especie.value = speciesToEdit.especie;
                form.descripcion.value = speciesToEdit.descripcion;
                openModal();
            }
        } else if (action === 'delete') {
            const confirmed = await showConfirm('¿Seguro que quieres eliminar esta ficha de especie?');
            if (confirmed) {
                try {
                    const res = await fetch(`${apiUrl}/${speciesId}`, { method: 'DELETE', headers: authHeader });
                    if (!res.ok) throw new Error('No se pudo eliminar la ficha.');
                    showToast('Ficha eliminada.');
                    await loadSpecies();
                } catch (error) {
                    showToast(error.message, true);
                }
            }
        }
    });

    // Initial Load
    loadSpecies();
});