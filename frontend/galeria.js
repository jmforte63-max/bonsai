import { setupAuthUI } from './authUI.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader, userRole } = setupAuthUI('userInfo', '#header-actions');
    const galleryContainer = document.getElementById('galleryContainer');
    const speciesFilter = document.getElementById('speciesFilter');
    const sortFilter = document.getElementById('sortFilter');
    const apiUrlBase = 'http://localhost:3000/api';

    async function cargarGaleria() {
        try {
            // Construir la URL con los parámetros de los filtros
            const params = new URLSearchParams();
            if (speciesFilter.value) {
                params.append('species', speciesFilter.value);
            }
            if (sortFilter.value) {
                const [sortBy, sortOrder] = sortFilter.value.split('_');
                params.append('sortBy', sortBy);
                params.append('sortOrder', sortOrder);
            }

            const queryString = params.toString();
            const apiUrl = `${apiUrlBase}/gallery${queryString ? '?' + queryString : ''}`;

            galleryContainer.innerHTML = '<p>Cargando galería...</p>';

            const res = await fetch(apiUrl, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudo cargar la galería.');
            const items = await res.json();
            renderGaleria(items);
        } catch (error) {
            showToast(error.message, true);
            galleryContainer.innerHTML = `<p>${error.message}</p>`;
        }
    }

    async function populateFilters() {
        try {
            const res = await fetch(`${apiUrlBase}/gallery/filters`, { headers: authHeader });
            if (!res.ok) throw new Error('No se pudieron cargar los filtros.');
            const { species } = await res.json();

            // Poblar filtro de especies
            speciesFilter.innerHTML = '<option value="">Todas las especies</option>';
            species.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                speciesFilter.appendChild(option);
            });

            // Poblar filtro de ordenación
            const sortOptions = {
                'fecha_DESC': 'Más recientes primero',
                'fecha_ASC': 'Más antiguos primero',
                'nombre_ASC': 'Nombre de bonsái (A-Z)',
                'nombre_DESC': 'Nombre de bonsái (Z-A)',
            };

            sortFilter.innerHTML = '';
            for (const [value, text] of Object.entries(sortOptions)) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = text;
                sortFilter.appendChild(option);
            }

        } catch (error) {
            showToast(error.message, true);
        }
    }

    // Event Listeners para los filtros
    speciesFilter.addEventListener('change', () => {
        cargarGaleria();
    });

    sortFilter.addEventListener('change', () => {
        cargarGaleria();
    });

    function renderGaleria(items) {
        galleryContainer.innerHTML = '';
        if (items.length === 0) {
            galleryContainer.innerHTML = '<p>No hay trabajos que coincidan con los filtros seleccionados.</p>';
            return;
        }

        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item';

            const ownerInfo = (userRole === 'admin' || userRole === 'moderator') && item.owner_email
                ? `<p class="owner-info">Dueño: ${item.owner_email}</p>`
                : '';

            itemDiv.innerHTML = `
                <div class="gallery-images">
                    <div class="gallery-image-container">
                        <strong>Antes</strong>
                        <img src="http://localhost:3000${item.foto_antes}" alt="Foto del antes" class="gallery-img">
                    </div>
                    <div class="gallery-image-container">
                        <strong>Después</strong>
                        <img src="http://localhost:3000${item.foto_despues}" alt="Foto del después" class="gallery-img">
                    </div>
                </div>
                <div class="gallery-info">
                    <h4>${item.bonsai_nombre}</h4>
                    <p>Especie: ${item.especie} | Fecha: ${new Date(item.fecha).toLocaleDateString()}</p>
                    ${ownerInfo}
                </div>
            `;
            galleryContainer.appendChild(itemDiv);
        });
    }

    // --- Lógica del Lightbox (ampliar imagen) ---
    galleryContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('gallery-img')) {
            const imageModal = document.getElementById('imageModal');
            const modalImg = document.getElementById('lightboxImage');
            const closeModal = document.querySelector('.close-lightbox');

            imageModal.style.display = "block";
            modalImg.src = e.target.src;

            const close = () => {
                imageModal.style.display = "none";
            };

            closeModal.onclick = close;
            imageModal.onclick = (event) => {
                if (event.target === imageModal) close();
            };
        }
    });

    populateFilters();
    cargarGaleria();
});