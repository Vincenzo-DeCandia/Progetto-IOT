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

// Variabili per il modale dei dettagli della stazione
const stationDetailsModal = document.getElementById('stationDetailsModal');
const closeButton = stationDetailsModal.querySelector('.close-button');
let accumulatedChart;
let pollutantChart;

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
 * Restituisce il colore del marker in base al valore dell'inquinante e al tipo di inquinante.
 * @param {number} value - Il valore dell'inquinante.
 * @param {string} pollutant - Il tipo di inquinante (es. "PM10", "NO2").
 * @returns {string} Il codice colore esadecimale.
 */
function getColorByValue(value, pollutant) {
    const category = getAqiCategory(pollutant, value);
    switch (category) {
        case 'GOOD': return '#2ecc71';
        case 'FAIR': return '#f1c40f';
        case 'MODERATE': return '#e67e22';
        case 'POOR': return '#e74c3c';
        case 'VERY POOR': return '#7E0023';
        case 'EXTREMELY POOR': return '#8e44ad';
        default: return '#cccccc'; // Grigio per valori sconosciuti o non definiti
    }
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
            <div class="aq-popup">
                <div class="aq-popup__title">${station.station_name}</div>
                <div class="aq-popup__meta">${station.pollutant} • ${station.value.toFixed(1)} µg/m³</div>
                <div class="aq-popup__row">
                    <span class="pill">${new Date(station.date).toLocaleTimeString('it-IT')}</span>
                    <button class="pill view-details-btn" data-station-name="${station.station_name}">Vedi dettagli</button>
                </div>
            </div>
        `);

        marker.on('popupopen', function() {
            const btn = document.querySelector(`.view-details-btn[data-station-name="${station.station_name}"]`);
            if (btn) {
                btn.onclick = () => showStationDetails(station.station_name);
            }
        });

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
                <div class="aq-popup">
                    <div class="aq-popup__title">${station.station_name}</div>
                    <div class="aq-popup__meta">${station.pollutant} • ${station.value.toFixed(1)} µg/m³</div>
                    <div class="aq-popup__row">
                        <span class="pill">${new Date(station.date).toLocaleTimeString('it-IT')}</span>
                        <button class="pill view-details-btn" data-station-name="${station.station_name}">Vedi dettagli</button>
                    </div>
                </div>
            `);

            marker.on('popupopen', function() {
                const btn = document.querySelector(`.view-details-btn[data-station-name="${station.station_name}"]`);
                if (btn) {
                    btn.onclick = () => showStationDetails(station.station_name);
                } else {
                    console.warn("Pulsante 'Vedi dettagli' non trovato per la stazione:", station.station_name);
                }
            });

            marker.addTo(stationsLayer);
            count++;
        });

        batchIdx++;
        if (endIdx < data.length) {
            setTimeout(processBatch, 50);
        } else {
            console.log(`✅ Renderizzati ${count} marker`);
        }
    }

    processBatch();
}


/*======================================================
 * SEZIONE 8: DETTAGLI STAZIONE E GRAFICI
 ======================================================*/

/**
 * Mostra il modale con i dettagli della stazione e i grafici.
 * @param {string} stationName - Il nome della stazione.
 */
async function showStationDetails(stationName) {
    console.log(`📊 Richiesta dettagli per la stazione: ${stationName}`);

    try {
        // Carica i dati validati (storici) localmente
        const baseDir = (window.location.protocol === "file:")
            ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'))
            : ".";
        const filePath = `${baseDir}/data/validati.json`;

        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Errore nel recupero dei dati validati: ${response.statusText}`);
        }
        const allValidatedData = await response.json();

        // Filtra i dati per la stazione selezionata
        const stationData = allValidatedData.filter(item => item.station_name === stationName);

        if (stationData.length === 0) {
            alert(`Dettagli per la stazione '{stationName}' non trovati.`);
            return;
        }

        // 1. Informazioni generali (prendi dall'ultimo dato disponibile)
        const latestData = stationData.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const { category: aqiCategory, pollutant: aqiPollutant } = getAqiForStation(stationData.filter(item => item.date === latestData.date));

        document.getElementById('stationName').textContent = stationName;
        document.getElementById('airQualityIndex').textContent = `${aqiCategory} (due to ${aqiPollutant})`;
        document.getElementById('stationDate').textContent = new Date(latestData.date).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('stationCountry').textContent = "Italia"; // Assumiamo Italia
        document.getElementById('stationLocation').textContent = stationName; // O un campo più specifico se disponibile
        document.getElementById('stationClassification').textContent = "Urban"; // Esempio
        document.getElementById('stationArea').textContent = "City"; // Esempio

        // 2. Dati accumulati (grafico a torta)
        const aqiCounts = {};
        stationData.forEach(item => {
            const category = getAqiCategory(item.pollutant, item.value);
            aqiCounts[category] = (aqiCounts[category] || 0) + 1;

        });


        const totalDataPoints = stationData.length;
        const accumulatedData = Object.keys(aqiCounts).map(category => ({
            label: category,
            percentage: (aqiCounts[category] / totalDataPoints) * 100
        }));
        console.log('Percentage', accumulatedData)
        renderAccumulatedChart(accumulatedData);

        // 3. Dati storici (grafici a barre)
        // Raggruppa per data e calcola la media per ogni inquinante
        const historicalDataMap = {};
        stationData.forEach(item => {
            const date = new Date(item.date).toISOString().split('T')[0]; // YYYY-MM-DD
            if (!historicalDataMap[date]) {
                historicalDataMap[date] = { date: date, PM10: [], NO2: [], O3: [], PM12_5: [] };
            }
            if (item.pollutant === 'PM10') historicalDataMap[date].PM10.push(item.value);
            if (item.pollutant === 'NO2') historicalDataMap[date].NO2.push(item.value);
            if (item.pollutant === 'O3') historicalDataMap[date].O3.push(item.value);
            if (item.pollutant === 'PM12.5') historicalDataMap[date].PM12_5.push(item.value);
        });

        const historicalData = Object.values(historicalDataMap).map(dayData => {
            const avgPM10 = dayData.PM10.length ? dayData.PM10.reduce((a, b) => a + b) / dayData.PM10.length : null;
            const avgNO2 = dayData.NO2.length ? dayData.NO2.reduce((a, b) => a + b) / dayData.NO2.length : null;
            const avgO3 = dayData.O3.length ? dayData.O3.reduce((a, b) => a + b) / dayData.O3.length : null;
            const avgPM12_5 = dayData.PM12_5.length ? dayData.PM12_5.reduce((a, b) => a + b) / dayData.PM12_5.length : null;

            const dailyPollutants = [];
            if (avgPM10 !== null) dailyPollutants.push({ pollutant: 'PM10', value: avgPM10 });
            if (avgNO2 !== null) dailyPollutants.push({ pollutant: 'NO2', value: avgNO2 });
            if (avgO3 !== null) dailyPollutants.push({ pollutant: 'O3', value: avgO3 });
            if (avgPM12_5 !== null) dailyPollutants.push({ pollutant: 'PM12.5', value: avgPM12_5 });

            const { category: dailyAqiCategory } = getAqiForStation(dailyPollutants);

            return {
                date: dayData.date,
                PM10: avgPM10,
                NO2: avgNO2,
                O3: avgO3,
                PM12_5: avgPM12_5,
                Index: dailyAqiCategory
            };
        });

        renderPollutantChart(historicalData);

        stationDetailsModal.style.display = 'block';

    } catch (error) {
        console.error("Errore nel mostrare i dettagli della stazione:", error);
        alert("Impossibile caricare i dettagli della stazione.");
    }
}

// Gestione chiusura modale
closeButton.onclick = () => {
    stationDetailsModal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target === stationDetailsModal) {
        stationDetailsModal.style.display = 'none';
    }
};

/**
 * Renderizza il grafico a torta per i dati accumulati.
 * @param {Array} data - Dati accumulati (es. [{ label: 'Good', percentage: 52.6 }, ...])
 */
function renderAccumulatedChart(data) {
    const ctx = document.getElementById('accumulatedChart').getContext('2d');

    const labels = data.map(item => item.label);
    const percentages = data.map(item => item.percentage);
    const backgroundColors = data.map(item => {
        switch (item.label) {
            case 'GOOD': return '#2ecc71';
            case 'FAIR': return '#f1c40f';
            case 'MODERATE': return '#e67e22';
            case 'POOR': return '#e74c3c';
            case 'VERY POOR': return '#7E0023';
            case 'EXTREMELY POOR': return '#8e44ad';
            default: return '#cccccc';
        }
    });

    console.log(backgroundColors)

    if (accumulatedChart) {
        accumulatedChart.destroy(); // Distrugge il grafico precedente se esiste
    }

    accumulatedChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: percentages,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed + '%';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renderizza i grafici a barre per l'andamento degli inquinanti.
 * @param {Array} data - Dati storici per gli inquinanti (es. [{ date: '2025-01-01', PM10: 20, NO2: 15, Index: 'Good' }, ...])
 */
function renderPollutantChart(data) {
    const ctx = document.getElementById('pollutantChart').getContext('2d');

    // Ordina i dati per data
    data.sort((a, b) => new Date(a.date) - new Date(b.date));

    const dates = data.map(item => new Date(item.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }));
    const pm10Values = data.map(item => item.PM10);
    const no2Values = data.map(item => item.NO2);
    const o3Values = data.map(item => item.O3);
    const pm12_5Values = data.map(item => item.PM12_5);
    const indexValues = data.map(item => getAqiValue(item.Index)); // Converte l'indice testuale in un valore numerico per il grafico

    if (pollutantChart) {
        pollutantChart.destroy(); // Distrugge il grafico precedente se esiste
    }

    pollutantChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'PM10',
                    data: pm10Values,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'NO2',
                    data: no2Values,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                },
                {
                    label: 'O3',
                    data: o3Values,
                    backgroundColor: 'rgba(255, 205, 86, 0.6)',
                    borderColor: 'rgba(255, 205, 86, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Indice AQI',
                    data: indexValues,
                    backgroundColor: 'rgba(153, 102, 255, 0.6)',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    beginAtZero: true
                },
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.dataset.label === 'Indice AQI') {
                                label += getAqiLabel(context.parsed.y); // Converte il valore numerico in etichetta testuale
                            } else {
                                label += context.parsed.y + ' µg/m³';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Converte l'etichetta AQI testuale in un valore numerico per il grafico.
 * @param {string} label - Etichetta AQI (Good, Fair, etc.)
 * @returns {number} Valore numerico
 */
function getAqiValue(label) {
    switch (label) {
        case 'GOOD': return 1;
        case 'FAIR': return 2;
        case 'MODERATE': return 3;
        case 'POOR': return 4;
        case 'VERY POOR': return 5;
        case 'EXTREMELY POOR': return 6;
        default: return 0;
    }
}

/**
 * Converte un valore numerico in etichetta AQI testuale.
 * Usato per i tooltip del grafico.
 * @param {number} value - Valore numerico dell'AQI
 * @returns {string} Etichetta AQI
 */
function getAqiLabel(value) {
    switch (value) {
        case 1: return 'GOOD';
        case 2: return 'FAIR';
        case 3: return 'MODERATE';
        case 4: return 'POOR';
        case 5: return 'VERY POOR';
        case 6: return 'EXTREMELY POOR';
        default: return 'N/A';
    }
}

// Soglie AQI (coerenti con il backend Python)
const AQI_THRESHOLDS = {
    "PM10": {
        "GOOD": [0, 15],
        "FAIR": [15, 45],
        "MODERATE": [45, 120],
        "POOR": [120, 195],
        "VERY POOR": [195, 270],
        "EXTREMELY POOR": [270, Infinity],
    },
    "NO2": {
        "GOOD": [0, 10],
        "FAIR": [10, 25],
        "MODERATE": [25, 60],
        "POOR": [60, 100],
        "VERY POOR": [100, 150],
        "EXTREMELY POOR": [150, Infinity],
    },
    "O3": {
        "GOOD": [0, 60],
        "FAIR": [60, 100],
        "MODERATE": [100, 120],
        "POOR": [120, 160],
        "VERY POOR": [160, 280],
        "EXTREMELY POOR": [280, Infinity],
    },
    "PM12.5": {
        "GOOD": [0, 10],
        "FAIR": [10, 25],
        "MODERATE": [25, 50],
        "POOR": [50, 75],
        "VERY POOR": [75, 100],
        "EXTREMELY POOR": [100, Infinity],
    }
};

/**
 * Determina la categoria AQI per un dato inquinante e valore.
 * @param {string} pollutant - Il nome dell'inquinante (es. 'PM10').
 * @param {number} value - Il valore misurato dell'inquinante.
 * @returns {string} La categoria AQI (es. 'GOOD', 'POOR').
 */
function getAqiCategory(pollutant, value) {
    if (!AQI_THRESHOLDS[pollutant]) {
        return "UNKNOWN";
    }

    for (const category in AQI_THRESHOLDS[pollutant]) {
        const [lower, upper] = AQI_THRESHOLDS[pollutant][category];
        if (value >= lower && value < upper) {
            return category;
        }
    }
    return "UNKNOWN";
}

/**
 * Calcola l'AQI complessivo per una stazione basandosi sui valori degli inquinanti.
 * Ritorna la categoria AQI peggiore e l'inquinante responsabile.
 * @param {Array} stationData - Array di oggetti dati per una stazione in un dato momento.
 * @returns {Object} Un oggetto con la categoria AQI peggiore e l'inquinante responsabile.
 */
function getAqiForStation(stationData) {
    if (!stationData || stationData.length === 0) {
        return { category: "N/A", pollutant: "N/A" };
    }

    let worstAqiCategory = "GOOD";
    let worstPollutant = "N/A";
    const aqiOrder = ["GOOD", "FAIR", "MODERATE", "POOR", "VERY POOR", "EXTREMELY POOR"];

    stationData.forEach(item => {
        const category = getAqiCategory(item.pollutant, item.value);
        if (aqiOrder.indexOf(category) > aqiOrder.indexOf(worstAqiCategory)) {
            worstAqiCategory = category;
            worstPollutant = item.pollutant;
        }
    });

    return { category: worstAqiCategory, pollutant: worstPollutant };
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

