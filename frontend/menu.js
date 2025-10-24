/**
 * Inyecta el menú lateral y la cabecera estándar en una página.
 * @param {string} pageTitle - El título que se mostrará en la cabecera.
 * @param {object} authData - El objeto de autenticación de setupAuthUI.
 */
export function injectMenu(pageTitle, authData) {
    const { userRole } = authData;

    // Crear la cabecera
    const header = document.createElement('div');
    header.className = 'header';
    
    // Crear el título de la página
    const titleElement = document.createElement('h1');
    titleElement.style.margin = '0';
    titleElement.textContent = pageTitle;

    // Crear el contenedor para las acciones de la cabecera
    const headerActionsDiv = document.createElement('div');
    headerActionsDiv.id = 'header-actions';

    // Añadir un enlace de "volver" si no estamos en la página principal
    // Este enlace se colocará dentro de headerActionsDiv, a la derecha del título.
    if (window.location.pathname !== '/') {
        const backLink = document.createElement('a');
        backLink.href = '/';
        backLink.className = 'back-link';
        backLink.innerHTML = '&larr; Volver a Mis Bonsáis';
        headerActionsDiv.appendChild(backLink);
    }

    // Añadir el título y el contenedor de acciones a la cabecera
    header.appendChild(titleElement);
    header.appendChild(headerActionsDiv);

    // Crear el contenedor principal y el menú lateral
    const mainContainer = document.createElement('div');
    mainContainer.className = 'main-container';
    mainContainer.innerHTML = `
        <div class="sidebar">
            <h3 class="sidebar-title">Menú</h3>
            <a href="/" class="nav-link"><span>🌳</span> Mis Bonsáis</a>
            <a href="/trabajos.html" class="nav-link"><span>✂️</span> Técnicas</a>
            <a href="/galeria.html" class="nav-link"><span>🖼️</span> Galería</a>
            <a href="/ayuda.html" class="nav-link"><span>❓</span> Guía</a>
            <a href="/calendario.html" class="nav-link"><span>🗓️</span> Calendario</a>
            <div class="dropdown" id="menuGestion" style="display: none;">
                <button class="nav-link dropdown-toggle" style="border: none; cursor: pointer; width: 100%;"><span>⚙️</span> Gestionar <span class="arrow">▼</span></button>
                <div class="dropdown-content">
                    <a href="/abonos.html">Abonos</a>
                    <a href="/macetas.html">Macetas</a>
                    <a href="/procedencias.html">Procedencias</a>
                </div>
            </div>
        </div>
        <div class="main-content">
            <!-- El contenido original de la página irá aquí -->
        </div>
    `;

    // Mover el contenido original de la página dentro de .main-content
    const originalBodyContent = Array.from(document.body.children);
    const mainContentDiv = mainContainer.querySelector('.main-content');
    originalBodyContent.forEach(child => mainContentDiv.appendChild(child));

    // Limpiar el body y añadir la nueva estructura
    document.body.innerHTML = '';
    document.body.appendChild(header);
    document.body.appendChild(mainContainer);

    // Lógica para mostrar el menú de gestión
    const menuGestion = document.getElementById('menuGestion');
    if (userRole === 'admin' || userRole === 'user') {
        menuGestion.style.display = 'block';
    }

    // Lógica para resaltar la página activa
    const currentPage = window.location.pathname;
    const navLinks = mainContainer.querySelectorAll('.sidebar .nav-link, .sidebar .dropdown-content a');

    navLinks.forEach(link => {
        // Usamos getAttribute para obtener el valor exacto del href
        const linkPath = link.getAttribute('href'); 
        if (linkPath === currentPage) {
            link.classList.add('active');
        }
    });
}