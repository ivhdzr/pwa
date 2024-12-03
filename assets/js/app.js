// Registrar el Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('serviceworker.js')
            .then((registration) => {
                console.log('Service Worker registrado con éxito: ', registration);
            })
            .catch((error) => {
                console.log('Error al registrar el Service Worker: ', error);
            });
    });
}

const db = new PouchDB('ubicaciones');
const tableBody = document.querySelector('tbody');

// Formatear fecha
const formatearFecha = (fecha) => {
    const ahora = moment();
    const fechaMoment = moment(fecha, 'YYYY-MM-DD HH:mm:ss');
    if (fechaMoment.isSame(ahora, 'day')) return `Hoy a las ${fechaMoment.format('hh:mm:ss a')}`;
    if (fechaMoment.isSame(ahora.subtract(1, 'day'), 'day')) return `Ayer a las ${fechaMoment.format('hh:mm:ss a')}`;
    return fechaMoment.format('DD/MM/YY [a las] hh:mm:ss a');
};

const obtenerUbicacion = async (e) => {
    if (!navigator.geolocation) {
        await showModal('Error', 'La geolocalización no está disponible en este navegador.');
        return;
    }

    const confirmar = await showModal('Permiso requerido', '¿Deseas permitir el acceso a tu ubicación?', true);
    if (!confirmar) {
        await showModal('Advertencia', 'No se puede continuar sin acceder a tu ubicación.');
        return;
    }

    try {
        const position = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject)
        );

        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        const doc = {
            _id: new Date().toISOString(),
            lat,
            lon,
            fecha_registro: now,
            fecha_modif: null,
        };

        await db.put(doc);
        agregarFila(doc);
        sincronizar();
    } catch (error) {
        let mensajeError = 'No se pudo obtener la ubicación.';
        if (error.code === 1) mensajeError = 'Acceso a la ubicación denegado.';
        else if (error.code === 2) mensajeError = 'La ubicación no está disponible.';
        else if (error.code === 3) mensajeError = 'Tiempo de espera agotado al intentar obtener la ubicación.';

        await showModal('Error', mensajeError);
    }
};


// Agregar fila a la tabla
const agregarFila = ({ _id, lat, lon, fecha_registro, fecha_modif }) => {
    const index = tableBody.rows.length;
    const row = `
    <tr data-id="${_id}">
        <td>${index + 1}</td>
        <td>${lat}, ${lon}</td>
        <td>${formatearFecha(fecha_registro)}</td>
        <td>${fecha_modif ? formatearFecha(fecha_modif) : '(No disponible)'}</td>
        <td>
            <button class="btn btn-sm btn-primary bi bi-crosshair2" onclick="verEnGoogleMaps(${lat}, ${lon})"> Ver en Google Maps</button>
            <button class="btn btn-sm btn-warning bi bi-pencil-fill" onclick="actualizarRegistro('${_id}')"> Actualizar</button>
            <button class="btn btn-sm btn-danger bi bi-trash-fill" onclick="confirmarBorrado('${_id}')"> Eliminar</button>
        </td>
    </tr>
    `;
    tableBody.insertAdjacentHTML('afterbegin', row);
};

// Mostrar ubicación en Google Maps
const verEnGoogleMaps = (lat, lon) => {
    const iframe = document.getElementById('googleMapIframe');
    const url = `https://www.google.com/maps/embed?pb=!1m17!1m12!1m3!1d3186.0945425892437!2d${lon}!3d${lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zMTnCsDIwJzUyLjAiTiA5OMKwMjgnNTcuMSJX!5e1!3m2!1ses-419!2smx!4v1733213613974!5m2!1ses-419!2smx`;
    iframe.src = url;
    new bootstrap.Modal(document.getElementById('modalGoogleMaps')).show();
};

// Actualizar un registro
const actualizarRegistro = async (id) => {
    try {
        const position = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        const now = moment().format('YYYY-MM-DD HH:mm:ss');

        const doc = await db.get(id);
        doc.lat = lat;
        doc.lon = lon;
        doc.fecha_modif = now;
        await db.put(doc);
        showToast("Actualizando...", 'secondary');

        actualizarTabla();
    } catch (error) {
        showModal('Error', 'Error al actualizar registro.');
    }
};

// Confirmar eliminación
const confirmarBorrado = (id) => {
    registroParaEliminar = id;
    new bootstrap.Modal(document.getElementById('modalConfirmarBorrado')).show();
};

// Eliminar un registro
document.getElementById('btnConfirmarBorrado').addEventListener('click', async () => {
    if (registroParaEliminar) {
        const doc = await db.get(registroParaEliminar);
        await db.remove(doc);
        registroParaEliminar = null;
        actualizarTabla();
        bootstrap.Modal.getInstance(document.getElementById('modalConfirmarBorrado')).hide();
    }
});

// Actualizar tabla completa
const actualizarTabla = async () => {
    tableBody.innerHTML = '';
    const allDocs = await db.allDocs({ include_docs: true });
    allDocs.rows.forEach((row, index) => agregarFila(row.doc, index));
    sincronizar();
};


// Sincronizar datos
const sincronizar = async () => {
    if (navigator.onLine) {
        const allDocs = await db.allDocs({ include_docs: true });
        const data = allDocs.rows.map(row => row.doc);
        console.log(data.length);
        try {
            const response = await fetch('https://apimovil.glarsa.com/ws_pwa/sync.php', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json(); // Si la respuesta es JSON
            console.log('Sincronización exitosa:', result);

        } catch (error) {
            console.error('Error durante la sincronización:', error);
        }
    }
};


// Eventos iniciales
document.querySelector('.start-btn').addEventListener('click', obtenerUbicacion);
//window.addEventListener('online', sincronizar);

const updateOnlineStatus = () => {
    const offlineWarning = document.querySelector(".offline-warning");
    if (navigator.onLine) {
        offlineWarning.style.display = "none"; sincronizar();
    } else {
        offlineWarning.style.display = "inline";
    }
};

window.addEventListener('online', updateOnlineStatus)
window.addEventListener('offline', updateOnlineStatus)

updateOnlineStatus();

// Inicializar tabla al cargar
actualizarTabla();

const showModal = (title, body, isConfirm = false) => {
    document.getElementById('genericModalLabel').textContent = title;
    document.getElementById('genericModalBody').textContent = body;

    const confirmButton = document.getElementById('modalConfirmButton');
    confirmButton.style.display = isConfirm ? 'inline-block' : 'none';

    return new Promise((resolve) => {
        const modalElement = document.getElementById('genericModal');
        const modal = new bootstrap.Modal(modalElement);

        // Configurar el botón "Aceptar"
        if (isConfirm) {
            confirmButton.onclick = () => {
                modal.hide(); // Oculta el modal
                resolve(true); // Devuelve true al resolver la promesa
            };
        } else {
            confirmButton.onclick = null; // Limpia cualquier evento anterior
        }

        // Configurar el cierre por otros medios (ej. botón "Cerrar" o clic fuera del modal)
        modalElement.addEventListener('hidden.bs.modal', () => resolve(false), { once: true });

        // Mostrar el modal
        modal.show();
    });
};

// Función para mostrar Toast
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById("toast-container");
    const toastElement = document.createElement("div");
    toastElement.classList.add('toast');
    toastElement.classList.add(`bg-${type}`);
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');

    toastElement.innerHTML = `
        <div class="toast-body" style="color: #fff;">
            ${message}
        </div>
    `;

    toastContainer.appendChild(toastElement);

    // Muestra el toast
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();

    // Eliminar el toast después de mostrarlo
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastContainer.removeChild(toastElement);
    });
}

// Respuestas
const requestButton = document.querySelector(".btn-request");
const responseContainer = document.getElementById("response-container");
const responseJson = document.getElementById("response-json");
const clearResponseButton = document.getElementById("clear-response");

requestButton.addEventListener("click", async () => {
    try {
        const response = await fetch("https://apimovil.glarsa.com/ws_pwa/sync.php");
        const data = await response.json();

        // Mostrar la respuesta como JSON ordenado
        responseJson.textContent = JSON.stringify(data, null, 2);
        responseContainer.style.display = "block";
        clearResponseButton.style.display = "inline-block"; // Mostrar el botón de borrar
    } catch (error) {
        responseJson.textContent = "Error al obtener datos: " + error.message;
        responseContainer.style.display = "block";
        clearResponseButton.style.display = "inline-block"; // Mostrar el botón también en caso de error
    }
});

clearResponseButton.addEventListener("click", () => {
    responseContainer.style.display = "none"; // Ocultar todo el contenedor
    responseJson.textContent = ""; // Limpiar la respuesta
    clearResponseButton.style.display = "none"; // Ocultar el botón de borrar
});