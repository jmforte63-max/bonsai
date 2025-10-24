import { setupAuthUI } from './authUI.js';
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const { authHeader, userToken } = setupAuthUI('userInfo', '#header-actions');

    // Si no hay token, no podemos continuar. setupAuthUI ya redirige, pero esta es una doble seguridad.
    if (!userToken) {
        return;
    }

    const calendarEl = document.getElementById('calendar');
    const apiUrl = 'http://localhost:3000/api/calendar/events';

    const commonCalendarOptions = {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        locale: 'es',
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            list: 'Lista'
        },
        eventClick: function(info) {
            info.jsEvent.preventDefault(); // previene el comportamiento por defecto
            if (info.event.url) {
                window.open(info.event.url, "_self"); // abre en la misma pestaña
            }
        }
    };

    // Calendario Unificado
    const calendar = new FullCalendar.Calendar(calendarEl, {
        ...commonCalendarOptions,
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {
                const response = await fetch(apiUrl, { headers: authHeader });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Error al cargar los eventos del calendario.');
                }
                const events = await response.json();
                successCallback(events);
            } catch (error) {
                failureCallback(error);
                showToast(error.message, true); // Muestra un mensaje de error
            }
        },
        eventDidMount: function(info) {
            // Añade un tooltip nativo del navegador con el título completo del evento.
            // Esto es útil si el texto es demasiado largo para el recuadro del evento.
            info.el.title = info.event.title;
        }
    });

    calendar.render();
});