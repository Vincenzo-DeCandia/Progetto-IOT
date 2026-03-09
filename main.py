# =====================================================
# FILE: main.py
# SCOPO: Pipeline principale per l'elaborazione dei dati
#        Scarica, pulisce, elabora e salva i dati
# =====================================================

# Importazione funzioni personalizzate da altri file
from Ckan_client import fetch_multiple_resources    # Scarica dati da CKAN
from add_coords import add_coords_to_df            # Aggiunge coordinate geografiche
from preprocessing import (                         # Funzioni di pulizia/preprocessing
    preprocess_orari_grezzi,
    denoise_iqr,
    filtro_inquinanti
)
from utils import *                                # Funzioni utility (salva/carica file)
from aggregation import media_giornaliera           # Calcola media giornaliera
from config import *                               # Importa tutte le configurazioni

# Importazioni aggiuntive per gestione dati
import json as json_lib
from pathlib import Path
import pandas as pd


# ===================================================================
# SEZIONE 1: ELABORAZIONE DATI GREZZI (TEMPO REALE - ORARI)
# ===================================================================

# Controlla se il file elaborato esiste già
# Se non esiste, scarica e processa i dati grezzi da zero
if not file_exists(GREZZI_CLEAN_FILE):

    # STEP 1: Scarico i dati grezzi da CKAN
    # Usa i Resource IDs configurati in config.py
    print("🔄 Scarico dati ORARI GREZZI...")
    df_grezzi = fetch_multiple_resources(ResourceIdGrezzi)

    # STEP 2: Pulizia base dei dati
    # Rimuove righe vuote, valori nulli, converte tipi di dato
    print("🧹 Pulizia dati grezzi...")
    df_grezzi = preprocess_orari_grezzi(df_grezzi)

    # STEP 3: Denoising - Rimozione outlier
    # Usa metodo IQR (InterQuartile Range) per rimuovere valori anomali
    # Esempio: se un valore è troppo diverso dagli altri, probabilmente è un errore
    print("🔊 Denoising dati grezzi...")
    df_grezzi = denoise_iqr(df_grezzi)

    # STEP 4: Filtraggio per inquinanti di interesse
    # Mantiene solo: PM10, PM2.5, NO2, O3 (vedi config.py)
    print("🎯 Filtraggio inquinanti...")
    df_grezzi = filtro_inquinanti(df_grezzi)

    # STEP 5: Aggiunta coordinate geografiche
    # Legge il file station_coords.json e aggiunge lat/lon per ogni stazione
    print("📍 Aggiunta coordinate...")
    df_grezzi = add_coords_to_df(df_grezzi, station_col="Descrizione")

    # STEP 6: Salva il DataFrame in CSV per non scaricare ogni volta
    print("💾 Salvataggio dati grezzi...")
    save_dataframe(df_grezzi, GREZZI_CLEAN_FILE)
else:
    # Se il file esiste già, caricalo da disco (molto più veloce)
    print("✅ Dati grezzi già processati -> Caricamento locale")
    df_grezzi = load_dataframe(GREZZI_CLEAN_FILE)

# ===================================================================
# STEP 7: RINOMINA COLONNE per il Frontend (app.js)
# ===================================================================

# Rinomina le colonne in modo che app.js le riconosca facilmente
# Mappa vecchio nome -> nuovo nome
df_grezzi.rename(columns={
    "Data_ora": "date",              # Timestamp completo (data + ora)
    "Stazione": "station",           # Codice stazione (es. NA06)
    "Descrizione": "station_name",   # Nome descrittivo stazione
    "Inquinante": "pollutant",       # Tipo di inquinante (PM10, O3, ecc.)
    "Valore": "value",               # Valore misurato
    "latitude": "lat",               # Latitudine geografica
    "longitude": "lon"               # Longitudine geografica
}, inplace=True)

# STEP 8: SALVATAGGIO DATI ORGANIZZATI PER DATA (STILE EEA AIRINDEX)
print("💾 Organizzazione dati realtime per data...")
realtime_index = save_daily_split(df_grezzi, "daily")

# ===================================================================
# SEZIONE 2: ELABORAZIONE DATI VALIDATI (STORICI - MEDIE GIORNALIERE)
# ===================================================================

# Controlla se il file validati elaborato esiste
if not file_exists(VALIDATI_FILE):

    # STEP 1: Scarico dati validati da CKAN
    # Usa i 12 Resource IDs (uno per ogni mese del 2025)
    print("\n📥 Scarico dati VALIDATI...")
    df_validati = fetch_multiple_resources(ResourceIdValidati)

    # STEP 2: Pulizia base (come per i dati grezzi)
    print("🧹 Pulizia dati validati...")
    df_validati = preprocess_orari_grezzi(df_validati)

    # STEP 3: Filtraggio per inquinanti di interesse
    print("🎯 Filtraggio inquinanti...")
    df_validati = filtro_inquinanti(df_validati)

    # STEP 4: Calcolo MEDIA GIORNALIERA
    # Raggruppa i dati per stazione e per giorno, calcola la media
    # Questo riduce i dati da orari a giornalieri
    print("📊 Calcolo media giornaliera (validati)...")
    df_media = media_giornaliera(df_validati)

    # STEP 5: Aggiunta coordinate geografiche
    print("📍 Aggiunta coordinate...")
    df_media = add_coords_to_df(df_media, station_col="Descrizione")

    # STEP 6: Salva il DataFrame elaborato
    print("💾 Salvataggio dati validati...")
    save_dataframe(df_media, VALIDATI_FILE)

else:
    # Se il file esiste, caricalo da disco
    print("✅ Dati validati -> Caricamento locale")
    df_media = load_dataframe(VALIDATI_FILE)

# ===================================================================
# STEP 7: RINOMINA COLONNE per il Frontend (app.js)
# ===================================================================

# Rinomina colonne per coerenza con il frontend
df_media.rename(columns={
    "Data": "date",                  # Data (YYYY-MM-DD)
    "Stazione": "station",           # Codice stazione
    "Descrizione": "station_name",   # Nome stazione
    "Inquinante": "pollutant",       # Tipo inquinante
    "Media_Giornaliera": "value",    # Media giornaliera del valore
    "latitude": "lat",               # Latitudine
    "longitude": "lon"               # Longitudine
}, inplace=True)

# STEP 8: Salva come JSON per il frontend
df_media.to_json(
    "data/validati.json",
    orient="records",
    date_format="iso"
)


# =====================================================
# ORGANIZZAZIONE DATI STORICI PER DATA
# =====================================================

print("💾 Organizzazione dati storici per data...")
historical_index = save_daily_split(df_media, "daily_validati")


print("📅 Creazione indice unificato...")

combined_index = sorted(
    realtime_index + historical_index,
    key=lambda x: x["date"]
)

with open("data/dates_index.json", "w", encoding="utf-8") as f:
    json_lib.dump({
        "dates": combined_index,
        "total_dates": len(combined_index),
        "first_date": combined_index[0]["date"],
        "last_date": combined_index[-1]["date"]
    }, f, ensure_ascii=False, indent=2)

print("✅ Indice unificato creato: data/dates_index.json")

# ===================================================================
# SEZIONE 3: VISUALIZZAZIONE / ANALISI PER DEBUG
# ===================================================================

# Stampa anteprima dei dati grezzi per verificare che tutto sia OK
print("\n🔍 Anteprima dati grezzi puliti:")
print(df_grezzi.head())

# Stampa le stazioni uniche per verificare quante ne abbiamo
print("\n📌 Stazioni trovate:")
print(df_media["station_name"].unique())
