import os
import pandas as pd
import json

# Mappatura dei colori per l'AQI (coerente con il frontend)
AQI_COLORS = {
    "GOOD": "#2ecc71",
    "FAIR": "#f1c40f",
    "MODERATE": "#e67e22",
    "POOR": "#e74c3c",
    "VERY POOR": "#7E0023",
    "EXTREMELY POOR": "#8e44ad",
}

# Soglie AQI (esempio, da adattare ai dati reali o normative)
AQI_THRESHOLDS = {
    "PM10": {
        "GOOD": (0, 15),
        "FAIR": (15, 45),
        "MODERATE": (45, 120),
        "POOR": (120, 195),
        "VERY POOR": (195, 270),
        "EXTREMELY POOR": (270, float('inf')),
    },
    "NO2": {
        "GOOD": (0, 10),
        "FAIR": (10, 25),
        "MODERATE": (25, 60),
        "POOR": (60, 100),
        "VERY POOR": (100, 150),
        "EXTREMELY POOR": (150, float('inf')),
    },
    "O3": {
        "GOOD": (0, 60),
        "FAIR": (60, 100),
        "MODERATE": (100, 120),
        "POOR": (120, 160),
        "VERY POOR": (160, 280),
        "EXTREMELY POOR": (280, float('inf')),
    },
    "PM2.5": {
        "GOOD": (0, 10),
        "FAIR": (10, 25),
        "MODERATE": (25, 50),
        "POOR": (50, 75),
        "VERY POOR": (75, 100),
        "EXTREMELY POOR": (100, float('inf')),
    }
}

def get_aqi_category(pollutant, value):
    """
    Determina la categoria AQI per un dato inquinante e valore.
    """
    if pollutant not in AQI_THRESHOLDS:
        return "UNKNOWN"

    for category, (lower, upper) in AQI_THRESHOLDS[pollutant].items():
        if lower <= value < upper:
            return category
    return "UNKNOWN"

def get_aqi_for_station(station_data):
    """
    Calcola l'AQI complessivo per una stazione basandosi sui valori degli inquinanti.
    Ritorna la categoria AQI peggiore e l'inquinante responsabile.
    """
    if station_data.empty:
        return "N/A", "N/A"

    worst_aqi_category = "GOOD"
    worst_pollutant = "N/A"
    aqi_order = ["GOOD", "FAIR", "MODERATE", "POOR", "VERY POOR", "EXTREMELY POOR"]

    for _, row in station_data.iterrows():
        pollutant = row["pollutant"]
        value = row["value"]
        category = get_aqi_category(pollutant, value)

        if aqi_order.index(category) > aqi_order.index(worst_aqi_category):
            worst_aqi_category = category
            worst_pollutant = pollutant

    return worst_aqi_category, worst_pollutant

def ensure_directory(path):
    """
    Controlla se una directory esiste.
    Se non esiste, la crea.
    """
    if not os.path.exists(path):
        os.makedirs(path)


def file_exists(path):
    """
    Ritorna True se il file esiste, False altrimenti.
    """
    return os.path.isfile(path)


def save_dataframe(df, path):
    """
    Salva un DataFrame pandas in formato CSV.
    """
    df.to_csv(path, index=False)


def load_dataframe(path):
    """
    Carica un DataFrame pandas da CSV.
    """
    return pd.read_csv(path)

def save_daily_split(df, output_folder):
    """
    Salva i dati orari o giornalieri in file JSON separati per data.
    Crea anche un indice delle date disponibili.
    """
    ensure_directory(f"data/{output_folder}")

    # Assicurati che la colonna 'date' sia in formato datetime
    df['date'] = pd.to_datetime(df['date'])

    # Raggruppa per data e salva ogni gruppo in un file JSON separato
    dates_index = []
    for date, group in df.groupby(df['date'].dt.date):
        date_str = date.strftime('%Y-%m-%d')
        output_path = f"data/{output_folder}/{date_str}.json"
        group.to_json(output_path, orient="records", date_format="iso", indent=2)
        dates_index.append({"date": date_str, "file": output_path})

    return dates_index

def get_station_details_data(station_name, df_grezzi, df_media):
    """
    Recupera i dettagli completi per una specifica stazione, inclusi:
    - Informazioni generali (nome, paese, località, classificazione, area)
    - Indice di qualità dell'aria corrente e inquinante principale
    - Dati accumulati per il grafico a torta (percentuali di GOOD, FAIR, ecc.)
    - Dati storici per i grafici a barre (PM10, NO2, O3, PM2.5 e AQI nel tempo)
    """
    station_grezzi = df_grezzi[df_grezzi["station_name"] == station_name].copy()
    station_media = df_media[df_media["station_name"] == station_name].copy()

    details = {"station_name": station_name}

    # 1. Informazioni generali (prendi dall'ultimo dato disponibile)
    if not station_grezzi.empty:
        latest_data = station_grezzi.sort_values(by="date", ascending=False).iloc[0]
        details["date"] = latest_data["date"].strftime("%Y-%m-%d %H:%M:%S UTC+1") # Esempio di formattazione
        details["country"] = "Italia" # Assumiamo Italia per ora
        details["location"] = latest_data["station_name"] # O un campo più specifico se disponibile
        details["classification"] = "Urban" # Esempio, da derivare se possibile
        details["area"] = "City" # Esempio
    elif not station_media.empty:
        latest_data = station_media.sort_values(by="date", ascending=False).iloc[0]
        details["date"] = latest_data["date"].strftime("%Y-%m-%d") # Solo data per dati medi
        details["country"] = "Italia"
        details["location"] = latest_data["station_name"]
        details["classification"] = "Urban"
        details["area"] = "City"
    else:
        return None # Stazione non trovata

    # 2. Indice di qualità dell'aria corrente
    if not station_grezzi.empty:
        latest_hourly_data = station_grezzi[station_grezzi["date"] == station_grezzi["date"].max()]
        aqi_category, aqi_pollutant = get_aqi_for_station(latest_hourly_data)
        details["air_quality_index"] = f"{aqi_category} (due to {aqi_pollutant})" if aqi_pollutant != "N/A" else aqi_category
    else:
        details["air_quality_index"] = "N/A"

    # 3. Dati accumulati (grafico a torta)
    if not station_media.empty:
        # Calcola la categoria AQI per ogni riga nei dati medi
        station_media['aqi_category'] = station_media.apply(
            lambda row: get_aqi_category(row['pollutant'], row['value']),
            axis=1
        )
        # Conta le occorrenze di ogni categoria AQI
        aqi_counts = station_media['aqi_category'].value_counts(normalize=True) * 100
        accumulated_data = []
        for category in ["GOOD", "FAIR", "MODERATE", "POOR", "VERY POOR", "EXTREMELY POOR"]:
            if category in aqi_counts:
                accumulated_data.append({"label": category, "percentage": round(aqi_counts[category], 1)})
        details["accumulated_data"] = accumulated_data
    else:
        details["accumulated_data"] = []

    # 4. Dati storici (grafici a barre)
    if not station_media.empty:
        # Pivot per avere inquinanti come colonne
        historical_pivot = station_media.pivot_table(
            index="date",
            columns="pollutant",
            values="value",
            aggfunc='mean'
        ).reset_index()
        historical_pivot.columns.name = None

        # Calcola l'AQI per ogni giorno
        historical_data_list = []
        for index, row in historical_pivot.iterrows():
            daily_aqi_data = pd.DataFrame([
                {"pollutant": p, "value": row[p]}
                for p in ["PM10", "NO2", "O3", "PM12.5"] if p in row and pd.notna(row[p])
            ])
            aqi_category, _ = get_aqi_for_station(daily_aqi_data)

            row_dict = row.to_dict()
            row_dict["date"] = row_dict["date"].strftime("%Y-%m-%d")
            row_dict["Index"] = aqi_category
            historical_data_list.append(row_dict)

        details["historical_data"] = historical_data_list
    else:
        details["historical_data"] = []

    return details
