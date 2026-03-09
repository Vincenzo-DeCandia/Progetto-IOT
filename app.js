/*======================================================
 * FILE: app.js
 * SCOPO: Logica principale del frontend - Mappa interattiva stile EEA
 *        Simile a https://airindex.eea.europa.eu/AQI/index.html
 *        - Timeline per navigare date
 *        - Caricamento dinamico per data
 *        - Mappa con marker colorati
 ======================================================*/

/*======================================================
 * SEZIONE 1: VARIABILI GLOBALI
 ======================================================*/

let map;                            // Mappa Leaflet (inizializzata dopo DOM ready)
let stationsLayer;                  // Layer con i marker

// Variabili di stato
let availableDates = [];        // Lista di date disponibili
let currentDate = null;         // Data attualmente visualizzata
let currentData = [];           // Dati della data corrente
let selectedPollutant = "PM10";
let selectedHour = "latest"; // "latest" o un'ora specifica (es. "10")
const pullotantSelect = document.getElementById("pollutantSelect");
const hourSelect = document.getElementById("hourSelect"); // Nuovo selettore per l'ora

/*======================================================
 * SEZIONE 2: TILE LAYER (SFONDO MAPPA)
 ======================================================*/

function initializeMap() {
    map = L.map("map", {
        maxZoom: 19,
        minZoom: 2,
        zoomControl: false,     // lo spostiamo
        preferCanvas: true      // performance con tanti circleMarker
    }).setView([40.9, 14.3], 8);

    // Basemap: Light + Dark (belle e pulite)
    const light = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19
    });

    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19
    });

    // default
    light.addTo(map);

    // Controlli
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ position: "bottomleft", metric: true, imperial: false }).addTo(map);

    // Switch basemap
    L.control.layers(
        { "Light": light, "Dark": dark },
        {},
        { position: "topright" }
    ).addTo(map);

    // Cluster con icona custom (più premium)
    stationsLayer = L.markerClusterGroup({
        maxClusterRadius: 60,
        disableClusteringAtZoom: 15,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            const size = count < 10 ? "sm" : count < 50 ? "md" : "lg";
            return L.divIcon({
                html: `<div class="aq-cluster aq-cluster--${size}"><span>${count}</span></div>`,
                className: "aq-cluster-wrap",
                iconSize: L.point(44, 44)
            });
        }
    }).addTo(map);

    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div class="map-legend__title">Legenda AQI</div>
        <div class="map-legend__row"><span class="dot" style="background:#2ecc71"></span> Good</div>
        <div class="map-legend__row"><span class="dot" style="background:#f1c40f"></span> Fair</div>
        <div class="map-legend__row"><span class="dot" style="background:#e67e22"></span> Moderate</div>
        <div class="map-legend__row"><span class="dot" style="background:#e74c3c"></span> Poor</div>
        <div class="map-legend__row"><span class="dot" style="background:#7E0023"></span> Very Poor</div>
        <div class="map-legend__row"><span class="dot" style="background:#8e44ad"></span> Extremely Poor</div>
      `;
      // evita che il drag della mappa si attivi quando clicchi la legenda
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legend.addTo(map);
}


/*======================================================
 * SEZIONE 3: INIZIALIZZAZIONE
 ======================================================*/

console.log("⏳ Inizializzazione applicazione...");
console.log("📍 Pagina caricata da:", window.location.href);
console.log("🗺️ Mappa DOM element:", document.getElementById("map") ? "✅ Trovato" : "❌ NON TROVATO");

// Aspetta il caricamento completo del DOM
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        console.log("✅ DOM pronto, inizializzo mappa...");
        initializeMap();
        loadDateIndex();
    });
} else {
    // DOM già caricato
    console.log("✅ DOM già caricato, inizializzo mappa...");
    initializeMap();
    loadDateIndex();
}


/*======================================================
 * SEZIONE 4: FUNZIONE CARICA INDICE DATE
 ======================================================*/

/**
 * Carica l'indice metadata con le date disponibili
 * Popola il timeline slider con le date
 */
async function loadDateIndex() {
    try {
        console.log("📅 Caricamento indice date...");

        // Determina il percorso corretto basato su come è caricata la pagina
        let indexPath = "data/dates_index.json";

        // Se è file:// protocol, ajusta il path
        if (window.location.protocol === "file:") {
            const dir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
            indexPath = dir + "/data/dates_index.json";
        }

        console.log(`🔍 Cercando indice in: ${indexPath}`);

        const response = await fetch(indexPath);

        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            console.error(`📝 URL: ${response.url}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const index = await response.json();

        console.log(`✅ Indice caricato con successo`);

        // Estrai le date
        availableDates = index.dates.map(d => d.date);
        console.log(`✅ Caricate ${availableDates.length} date disponibili`);
        console.log(`📅 Da: ${index.first_date} a: ${index.last_date}`);

        // Popola il timeline
        populateTimeline(availableDates);

        // Carica la data più recente (ultima disponibile)
        const lastDate = availableDates[availableDates.length - 1];
        console.log(`📍 Caricamento data iniziale: ${lastDate}`);
        loadDate(lastDate);

    } catch (err) {
        console.error("❌ ERRORE caricamento indice:", err);
        console.error("📍 Stack trace:", err.stack);
        alert(`❌ Errore nel caricamento dell'indice date:\n\n${err.message}\n\nVerifica la console (F12) per dettagli.`);
    }
}


/*======================================================
 * SEZIONE 5: POPOLA TIMELINE
 ======================================================*/

/**
 * Popola il date picker/slider con le date disponibili
 *
 * @param {Array} dates - Array di date disponibili
 */
function populateTimeline(dates) {
    const dateInput = document.getElementById("dateSelector");
    const dateDisplay = document.getElementById("currentDate");

    if (!dateInput) return;

    // Imposta i vincoli di data
    dateInput.min = dates[0];
    dateInput.max = dates[dates.length - 1];
    dateInput.value = dates[dates.length - 1]; // Seleziona ultima data

    // Listener per cambiamento data
    dateInput.addEventListener("change", (e) => {
        const selectedDate = e.target.value;
        loadDate(selectedDate);
    });

    // Aggiorna il display quando viene selezionata una data
    if (dateDisplay) {
        dateInput.addEventListener("change", (e) => {
            updateDateDisplay(e.target.value);
        });
        // Aggiorna anche al caricamento
        updateDateDisplay(dates[dates.length - 1]);
    }

    // Bottoni avanti/indietro
    const prevBtn = document.getElementById("prevDate");
    const nextBtn = document.getElementById("nextDate");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            const currentIdx = dates.indexOf(currentDate);
            if (currentIdx > 0) {
                const prevDate = dates[currentIdx - 1];
                dateInput.value = prevDate;
                loadDate(prevDate);
                updateDateDisplay(prevDate);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            const currentIdx = dates.indexOf(currentDate);
            if (currentIdx < dates.length - 1) {
                const nextDate = dates[currentIdx + 1];
                dateInput.value = nextDate;
                loadDate(nextDate);
                updateDateDisplay(nextDate);
            }
        });
    }
}

pullotantSelect.addEventListener("change", (e) => {
     selectedPollutant = e.target.value;
        renderMap();
});

// Nuovo event listener per il selettore dell'ora
if (hourSelect) {
    hourSelect.addEventListener("change", (e) => {
        selectedHour = e.target.value;
        renderMap();
    });
}

/**
 * Aggiorna il display della data formattato
 *
 * @param {string} dateStr - Data in formato YYYY-MM-DD
 */
function updateDateDisplay(dateStr) {
    const dateDisplay = document.getElementById("currentDate");
    if (!dateDisplay) return;

    const date = new Date(dateStr + "T00:00:00");
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formatted = date.toLocaleDateString('it-IT', options);

    dateDisplay.textContent = formatted;
}


/*======================================================
 * SEZIONE 6: CARICA DATI PER DATA
 ======================================================*/

/**
 * Carica i dati della data selezionata
 * Scarica solo il file JSON della data specifica
 *
 * @param {string} date - Data in formato YYYY-MM-DD
 */
async function loadDate(date) {
    try {
        console.log(`📥 Caricamento dati per ${date}...`);
        const startTime = performance.now();

        currentDate = date;

        // Determina il percorso corretto basato su come è caricata la pagina
        let filePath;
        const year = new Date(date).getFullYear();
        console.log("Anno estratto:", year);

        const baseDir = (window.location.protocol === "file:")
            ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))
            : ".";

        if (year === 2025) {
            filePath = `${baseDir}/data/daily_validati/${date}.json`;
            if(hourSelect){
                hourSelect.disabled = true;
                selectedHour = "latest"; // Forza "latest" se i dati orari non sono disponibili
                hourSelect.value = "latest"; // Aggiorna il selettore per riflettere la scelta forzata
            }
        } else {
            filePath = `${baseDir}/data/daily/${date}.json`;
            if(hourSelect){
                hourSelect.disabled = false;
            }
        }

        console.log(`🔍 Cercando dati in: ${filePath}`);

        const response = await fetch(filePath);
        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status}`);
            console.error(`📝 URL: ${response.url}`);
            throw new Error(`Dati non disponibili per ${date} (HTTP ${response.status})`);
        }

        // Parsing JSON
        currentData = await response.json();
        console.log(`✅ Caricati ${currentData.length} record per ${date}`);

        // Verifica che ci siano dati
        if (!currentData || currentData.length === 0) {
            console.warn(`⚠️ Nessun dato per ${date}`);
        }


        // Popola il selettore dell'ora con le ore disponibili per questa data
        populateHourSelector(currentData);

        // Renderizza sulla mappa
        renderMap();

        // Aggiorna statistiche
        updateStatistics(currentData);

        const endTime = performance.now();
        console.log(`⏱️ Tempo caricamento: ${(endTime - startTime).toFixed(0)}ms`);

    } catch (err) {
        console.error(`❌ Errore caricamento data ${date}:`, err);
        console.error("📍 Stack trace:", err.stack);
        alert(`Errore nel caricamento dei dati: ${err.message}`);
    }
}

/**
 * Popola il selettore dell'ora con le ore disponibili nei dati
 * @param {Array} data - Dati della data corrente
 */
function populateHourSelector(data) {
    if (!hourSelect) return;

    // Rimuovi le opzioni precedenti
    hourSelect.innerHTML = '<option value="latest">Ora più recente</option>';

    const hours = new Set();
    data.forEach(item => {
        const date = new Date(item.date);
        const hour = date.getHours().toString().padStart(2, '0');
        hours.add(hour);
    });

    const sortedHours = Array.from(hours).sort();

    sortedHours.forEach(hour => {
        const option = document.createElement("option");
        option.value = hour;
        option.textContent = `${hour}:00`;
        hourSelect.appendChild(option);
    });

    // Seleziona l'ora precedentemente scelta o "latest"
    if (sortedHours.includes(selectedHour)) {
        hourSelect.value = selectedHour;
    } else {
        selectedHour = "latest";
        hourSelect.value = "latest";
    }
}


/*======================================================
 * SEZIONE 7: RENDERIZZA MAPPA
 ======================================================*/

/**
 * Disegna i marker sulla mappa per i dati caricati
 * Usa batch rendering per grandi volumi di dati
 */

function renderMap() {
    stationsLayer.clearLayers();

    // 1. Filtra i dati per l'inquinante selezionato
    let filteredByPollutant = currentData.filter(station => station.pollutant === selectedPollutant);

    // 2. Filtra i dati per l'ora selezionata, se non è "latest"
    let dataToProcess = [];
    if (selectedHour !== "latest") {
        filteredByPollutant = filteredByPollutant.filter(station => {
            const stationHour = new Date(station.date).getHours().toString().padStart(2, '0');
            return stationHour === selectedHour;
        });
        dataToProcess = filteredByPollutant; // Se l'ora è specifica, prendiamo tutti i dati di quell'ora
    } else {
        // Se selectedHour è "latest", troviamo l'ora più corrente per ogni stazione
        const latestDataByStation = {};
        filteredByPollutant.forEach(station => {
            const stationId = station.station_name;
            if (!latestDataByStation[stationId] || new Date(station.date) > new Date(latestDataByStation[stationId].date)) {
                latestDataByStation[stationId] = station;
            }
        });
        dataToProcess = Object.values(latestDataByStation);
    }

    console.log(`📍 Rendering ${dataToProcess.length} marker per ${selectedPollutant} (ora: ${selectedHour})...`);
    const startTime = performance.now();

    if (dataToProcess.length > 1000) {
        renderBatch(dataToProcess);
    } else {
        renderImmediate(dataToProcess);
    }
    const endTime = performance.now();
    console.log(`⏱️ Tempo rendering: ${(endTime - startTime).toFixed(0)}ms`);
}



/**
 * Renderizza i marker immediatamente (small dataset)
 */
function renderImmediate(data) {
    let count = 0;

    data.forEach(station => {
        if (!station.lat || !station.lon) return;

        const color = getColorByValue(station.value, selectedPollutant);

        const marker = L.circleMarker(
            [station.lat, station.lon],
            {
                radius: 8,
                fillColor: color,
                color: "#333",
                weight: 1,
                fillOpacity: 0.9
            }
        );

        marker.bindPopup(`
            <div class="station-popup">
                <strong>${station.station_name}</strong><br/>
                <small>${station.pollutant}</small><br/>
                <strong>${station.value.toFixed(1)}</strong> µg/m³<br/>
                <small>${new Date(station.date).toLocaleTimeString('it-IT')}</small>
            </div>
        `);

        marker.addTo(stationsLayer);
        count++;
    });

    console.log(`✅ Renderizzati ${count} marker`);
}


/**
 * Renderizza i marker in batch (large dataset)
 */
function renderBatch(data) {
    const BATCH_SIZE = 500;
    let batchIdx = 0;
    let count = 0;

    function processBatch() {
        const startIdx = batchIdx * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, data.length);
        const batch = data.slice(startIdx, endIdx);

        batch.forEach(station => {
            if (!station.lat || !station.lon) return;

            const color = getColorByValue(station.value, selectedPollutant );

            const marker = L.circleMarker(
                [station.lat, station.lon],
                {
                    radius: 8,
                    fillColor: color,
                    color: "#333",
                    weight: 1,
                    fillOpacity: 0.9
                }
            );

            marker.bindPopup(`
                <div class="station-popup">
                    <strong>${station.station_name}</strong><br/>
                    <small>${station.pollutant}</small><br/>
                    <strong>${station.value.toFixed(1)}</strong> µg/m³<br/>
                    <small>${new Date(station.date).toLocaleTimeString('it-IT')}</small>
                </div>
            `);

            marker.addTo(stationsLayer);
            count++;
        });

        console.log(`📦 Batch ${batchIdx + 1}/${Math.ceil(data.length / BATCH_SIZE)}`);
        batchIdx++;

        if (batchIdx * BATCH_SIZE < data.length) {
            setTimeout(processBatch, 50);
        } else {
            console.log(`✅ Renderizzati ${count} marker`);
        }
    }

    processBatch();
}


/*======================================================
 * SEZIONE 8: ASSEGNAZIONE COLORE
 ======================================================*/

/**
 * Associa un colore al valore dell'inquinante
 * Scala EEA AQI:
 * - Verde (#2ecc71):       = GOOD
 * - Giallo (#f1c40f):      = FAIR
 * - Arancione (#e67e22):   = MODERATE
 * - Rosso (#e74c3c):       = POOR
 * - Viola (#8e44ad):       = EXTREMELY POOR
 *
 * @param {number} value - Valore misurato
 * @param {string} pollutant - Tipo inquinante
 * @returns {string} Colore hex
 */
function getColorByValue(value, pollutant) {

    if (pollutant === "PM10") {
         if (value <= 15) {
            return "#2ecc71";      // Good
        } else if (value <= 45) {
            return "#f1c40f";      // Fair
        } else if (value <= 120) {
            return "#e67e22";     // Moderate
        } else if (value <= 195) {
            return "#e74c3c";     // Poor
        } else if (value <= 270) {
            return "#7E0023";     // Very Poor
        } else {
            return "#8e44ad";      // Extremely Poor
        }
    } else if (pollutant === "O3") {
        if (value <= 60) {
            return "#2ecc71";      // Good
        } else if (value <= 100) {
            return "#f1c40f";      // Fair
        } else if (value <= 120) {
            return "#e67e22";     // Moderate
        } else if (value <= 160) {
            return "#e74c3c";     // Poor
        } else if (value <= 280) {
            return "#7E0023";     // Very Poor
        } else {
            return "#8e44ad";      // Extremely Poor
        }
    } else if (pollutant === "NO2") {
           if (value <= 10) {
            return "#2ecc71";      // Good
        } else if (value <= 25) {
            return "#f1c40f";      // Fair
        } else if (value <= 60) {
            return "#e67e22";     // Moderate
        } else if (value <= 100) {
            return "#e74c3c";     // Poor
        } else if (value <= 150) {
            return "#7E0023";     // Very Poor
        } else {
            return "#8e44ad";      // Extremely Poor
        }
    }
    return "#cccccc"; // Colore di default per inquinanti non riconosciuti
}


/*======================================================
 * SEZIONE 9: STATISTICHE
 ======================================================*/

/**
 * Aggiorna le statistiche visualizzate
 * Mostra numero marker, inquinanti, range valori
 *
 * @param {Array} data - Dati della data corrente
 */
function updateStatistics(data) {
    const statsContainer = document.getElementById("statistics");
    if (!statsContainer) return;

    // Calcola statistiche
    const stationCount = new Set(data.map(d => d.station_name)).size;
    const pollutants = [...new Set(data.map(d => d.pollutant))];
    const values = data.map(d => parseFloat(d.value));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const avgValue = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

    // Aggiorna DOM
    statsContainer.innerHTML = `
        <div class="stat-item">
            <strong>Stazioni</strong><br/>
            ${stationCount}
        </div>
        <div class="stat-item">
            <strong>Inquinanti</strong><br/>
            ${pollutants.join(", ")}
        </div>
        <div class="stat-item">
            <strong>Range</strong><br/>
            ${minValue.toFixed(1)} - ${maxValue.toFixed(1)} µg/m³
        </div>
        <div class="stat-item">
            <strong>Media</strong><br/>
            ${avgValue} µg/m³
        </div>
    `;
}


/*======================================================
 * SEZIONE 10: LEGEND
 ======================================================*/

/**
 * Mostra la legenda dei colori
 */
function showLegend() {
    const modal = document.getElementById("legendModal");
    if (modal) {
        modal.style.display = "block";
    }
}

// Chiudi legenda quando clicchi la X
document.addEventListener("DOMContentLoaded", () => {
    const closeBtn = document.querySelector(".close-modal");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            document.getElementById("legendModal").style.display = "none";
        });
    }

    const legendBtn = document.getElementById("legendBtn");
    if (legendBtn) {
        legendBtn.addEventListener("click", showLegend);
    }

    // Chiudi modal quando clicchi fuori
    window.addEventListener("click", (e) => {
        const modal = document.getElementById("legendModal");
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
});

