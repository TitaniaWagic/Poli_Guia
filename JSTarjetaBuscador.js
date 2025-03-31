// Variables globales
let allItems = {}; // Índice global de todos los elementos
const imageCache = {}; // Cache para imágenes ya cargadas
const visibleItems = new Set(); // Track de elementos ya renderizados
let menuInitialized = false; // Flag para saber si el menú se inicializó

// Cargar todos los datos al inicio
async function loadLocations() {
    try {
        const response = await fetch("datos.json");
        allItems = await response.json();

        // Precargar descripciones e imágenes (optimizado)
        const descripcionPromises = Object.keys(allItems).map(async (id) => {
            try {
                const descResponse = await fetch(allItems[id].descripcion);
                if (!descResponse.ok) throw new Error(`No se pudo cargar la descripción para ${id}`);
                allItems[id].descripcionText = await descResponse.text();

                // Precarga optimizada de imágenes (solo primeras)
                if (allItems[id].image && !imageCache[allItems[id].image]) {
                    await preloadImage(allItems[id].image);
                }
            } catch (error) {
                allItems[id].descripcionText = "Sin descripción";
                console.warn(`Error cargando descripción para ${id}:`, error);
            }
        });

        await Promise.all(descripcionPromises);

        // Si el menú ya está visible, cargar elementos iniciales
        if (document.getElementById("box").classList.contains("expanded")) {
            loadInitialMenuItems();
        }
    } catch (error) {
        console.error("Error al cargar los datos:", error);
    }
}

// Función para precargar imágenes con caché
function preloadImage(url) {
    return new Promise((resolve, reject) => {
        if (imageCache[url]) {
            resolve(imageCache[url]);
            return;
        }

        const img = new Image();
        img.src = url;

        img.onload = () => {
            imageCache[url] = img;
            resolve(img);
        };

        img.onerror = () => {
            console.warn(`No se pudo cargar la imagen: ${url}`);
            reject(`Error cargando imagen: ${url}`);
        };
    });
}

// Cargar elementos iniciales del menú
function loadInitialMenuItems() {
    if (!menuInitialized) {
        const menu = document.getElementById("menu");
        menu.innerHTML = ""; // Limpiar menú

        // Cargar solo los primeros 20 elementos (lo que cabe en pantalla)
        const initialItems = Object.keys(allItems).slice(0, 20);

        initialItems.forEach(id => {
            addMenuItemToDOM(id);
            visibleItems.add(id);
        });

        menuInitialized = true;

        // Configurar scroll infinito
        setupInfiniteScroll();
    }
}

// Añadir un elemento al DOM del menú
function addMenuItemToDOM(id) {
    const menu = document.getElementById("menu");
    const item = allItems[id];

    const div = document.createElement("div");
    div.classList.add("menu-item");
    div.dataset.id = id;

    const img = document.createElement("img");
    img.style.width = '100px';
    img.style.height = '100px';
    img.style.objectFit = 'cover';
    img.src = item.image || 'placeholder.jpg';
    img.loading = "lazy";
    img.onload = () => img.style.opacity = 1;
    img.style.opacity = 0;
    img.style.transition = 'opacity 0.3s';

    const title = document.createElement("span");
    title.textContent = item.titulo;

    div.appendChild(img);
    div.appendChild(title);
    div.addEventListener("click", () => verTarjeta(id));

    menu.appendChild(div);
}

// Configurar scroll infinito
function setupInfiniteScroll() {
    const menu = document.getElementById("menu");
    let loading = false;

    menu.addEventListener('scroll', throttle(async () => {
        if (loading || menu.scrollHeight - menu.scrollTop - menu.clientHeight > 100) return;

        loading = true;

        // Encontrar IDs que aún no se han renderizado
        const unrenderedIds = Object.keys(allItems).filter(id => !visibleItems.has(id));
        const nextBatch = unrenderedIds.slice(0, 10); // Siguiente lote de 10

        if (nextBatch.length > 0) {
            // Usar fragmento para mejor performance
            const fragment = document.createDocumentFragment();

            nextBatch.forEach(id => {
                const item = allItems[id];
                const div = document.createElement("div");
                div.classList.add("menu-item");
                div.dataset.id = id;

                const img = document.createElement("img");
                img.style.width = '100px';
                img.style.height = '100px';
                img.style.objectFit = 'cover';
                img.src = item.image || 'placeholder.jpg';
                img.loading = "lazy";

                const title = document.createElement("span");
                title.textContent = item.titulo;

                div.appendChild(img);
                div.appendChild(title);
                div.addEventListener("click", () => verTarjeta(id));

                fragment.appendChild(div);
                visibleItems.add(id);
            });

            menu.appendChild(fragment);
        }

        loading = false;
    }, 200));
}

// Función de búsqueda optimizada
function setupSearch() {
    const searchInput = document.getElementById("searchInput");

    searchInput.addEventListener("input", function() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const menu = document.getElementById("menu");

        // Resetear todos los highlights
        document.querySelectorAll(".menu-item.highlighted").forEach(item => {
            item.classList.remove("highlighted");
        });

        if (searchTerm === "") {
            menu.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        // Buscar en todos los items (no solo en los renderizados)
        const matchingIds = Object.keys(allItems).filter(id => 
            allItems[id].titulo.toLowerCase().includes(searchTerm)
        );

        if (matchingIds.length > 0) {
            // Asegurar que el primer match esté renderizado
            const firstMatchId = matchingIds[0];

            if (!visibleItems.has(firstMatchId)) {
                addMenuItemToDOM(firstMatchId);
                visibleItems.add(firstMatchId);
            }

            // Resaltar y hacer scroll al primer resultado
            const firstMatchElement = document.querySelector(`.menu-item[data-id="${firstMatchId}"]`);
            if (firstMatchElement) {
                firstMatchElement.classList.add("highlighted");

                // Scroll al elemento
                const itemPosition = firstMatchElement.offsetTop - menu.offsetTop;
                menu.scrollTo({
                    top: itemPosition,
                    behavior: "smooth"
                });
            }
        }
    });
}

// Función para mostrar la tarjeta de detalle
async function verTarjeta(id) {
    const tarjeta = document.getElementById("tarjeta");
    const data = allItems[id];

    if (data) {
        document.getElementById("tarjeta-titulo").textContent = data.titulo;

        // Usar imagen de caché si está disponible
        const imgElement = document.getElementById("tarjeta-image");
        if (imageCache[data.image]) {
            imgElement.src = imageCache[data.image].src;
        } else {
            // Carga bajo demanda con placeholder
            imgElement.src = 'placeholder.jpg';
            try {
                await preloadImage(data.image);
                imgElement.src = data.image;
            } catch (error) {
                console.warn("No se pudo cargar la imagen de la tarjeta", error);
            }
        }

        document.getElementById("tarjeta-text").innerHTML = (data.descripcionText || "").replace(/\n/g, "<br>");

        tarjeta.style.display = "block";
        setTimeout(() => tarjeta.classList.add("visible"), 10);
    }

    document.addEventListener("click", hideTarjetaOutside);
}

// Función para ocultar la tarjeta al hacer clic fuera
function hideTarjetaOutside(event) {
    const tarjeta = document.getElementById("tarjeta");
    if (!tarjeta.contains(event.target)) {
        tarjeta.classList.remove("visible");
        setTimeout(() => tarjeta.style.display = "none", 300);
        document.removeEventListener("click", hideTarjetaOutside);
    }
}

// Función throttle para optimizar eventos
function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function() {
        const context = this;
        const args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function() {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    loadLocations();
    setupSearch();

    // Configurar eventos del box
    const box = document.getElementById("box");
    const closeIcon = document.getElementById("closeIcon");

    box.addEventListener("click", function(event) {
        event.stopPropagation();
        if (!box.classList.contains("expanded")) {
            box.classList.add("expanded");
            loadInitialMenuItems();
            document.getElementById("lupa").style.display = "none";
        }
    });

    closeIcon.addEventListener("click", function(event) {
        event.stopPropagation();
        box.classList.remove("expanded");
        document.getElementById("lupa").style.display = "block";
    });

    document.addEventListener("click", function(event) {
        if (!box.contains(event.target)) {
            box.classList.remove("expanded");
            document.getElementById("lupa").style.display = "block";
        }
    });
    // === ZOOM INTERACTIVO === //
    function initZoom() {
    const mapContainer = document.querySelector('.map-container');
    const svgObject = document.getElementById('svgMap');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');

    // Verificación de elementos
    if (!mapContainer || !svgObject || !zoomInBtn || !zoomOutBtn) {
        console.error('Elementos esenciales no encontrados');
        return;
    }

    let scale = 1;
    const minScale = 0.5;
    const maxScale = 3;
    const scaleStep = 0.2;

    // Contenedor para manipular el SVG
    const svgWrapper = document.createElement('div');
    svgWrapper.className = 'svg-zoom-wrapper';
    svgObject.parentNode.insertBefore(svgWrapper, svgObject);
    svgWrapper.appendChild(svgObject);

    // Aplicar estilos iniciales
    svgWrapper.style.transformOrigin = '0 0';
    svgWrapper.style.willChange = 'transform';
    svgObject.style.width = '100%';
    svgObject.style.height = '100%';

    // Función para aplicar transformación
    function applyZoom() {
        svgWrapper.style.transform = `scale(${scale})`;
        console.log('Zoom scale:', scale); // Para depuración
    }

    // Eventos de los botones
    zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scale = Math.min(scale + scaleStep, maxScale);
        applyZoom();
    });

    zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        scale = Math.max(scale - scaleStep, minScale);
        applyZoom();
    });

    // Zoom táctil
    let startDistance = 0;
    mapContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            startDistance = getDistance(e.touches[0], e.touches[1]);
        }
    }, { passive: false });

    mapContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            scale = Math.min(Math.max(scale * (currentDistance / startDistance), maxScale), minScale);
            applyZoom();
            startDistance = currentDistance;
        }
    }, { passive: false });

    function getDistance(touch1, touch2) {
        return Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    }

    // Zoom inicial
    applyZoom();
}

document.addEventListener('DOMContentLoaded', initZoom);

});
