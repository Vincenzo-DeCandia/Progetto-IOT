# =====================================================
# FILE: config.py
# SCOPO: Centralizzare tutte le configurazioni del progetto
#        (endpoint API, Resource IDs, nomi file, ecc.)
# =====================================================
from pathlib import Path

import pandas as pd

# =========================
# CONFIGURAZIONE API CKAN
# =========================

# EndPoint base dell'API CKAN di ARPAC Campania
# Questa è l'URL che usiamo per fare query al database CKAN
# CKAN è un'infrastruttuta di open data (Comprehensive Knowledge Archive Network)
URL = "https://dati.arpacampania.it/api/3/action/datastore_search"

# =========================
# RESOURCE IDs (DATI GREZZI)
# =========================

# Resource ID del dataset ORARIO GREZZO (Gennaio - Febbraio 2026)
# Questi sono gli ID univoci nel sistema CKAN per accedere ai dati grezzi
# I dati grezzi sono i dati in TEMPO REALE, non ancora validati
# Abbiamo due risorse (probabile: una per gennaio, una per febbraio, una per marzo)
ResourceIdGrezzi = [
    "14df881f-3528-42d4-89d0-05d448a0e2bc",  # Gennaio 2026
    "1b39cd55-fb9a-4be0-89dd-6bfad408badd" ,  # Febbraio 2026
    "574f5999-7f02-4ce4-a62a-c8017a9bbf42"   # Marzo 2026
]

# =========================
# RESOURCE IDs (DATI VALIDATI)
# =========================

# Resource ID del dataset VALIDATO
# Dataset storico e controllato del 2025 - un ID per ogni mese
# I dati validati sono dati già controllati e elaborati da ARPAC
# Abbiamo 12 IDs, uno per ogni mese dell'anno 2025
ResourceIdValidati = [
    "0bc42c18-4736-469c-b181-ab53b595712e",  # Gennaio 2025
    "cc325bd1-815f-4c94-b6e1-59c60d397c03",  # Febbraio 2025
    "ad840e2e-2313-42e0-83d4-647b941faa61",  # Marzo 2025
    "62d2712b-bc26-440c-a9a6-28c2971669fe",  # Aprile 2025
    "e58ae836-d86b-4086-b5a4-d601ae7f6688",  # Maggio 2025
    "04f3e0fe-d5f7-443c-93fd-4ab306d143b1",  # Giugno 2025
    "f53c472d-3043-474b-9855-c512195103f4",  # Luglio 2025
    "72cccc55-8653-4b99-a64e-870666e9b883",  # Agosto 2025
    "6fc80353-418f-4804-87e9-b164d7adb355",  # Settembre 2025
    "8efd1cd4-d22b-4467-992f-c5981708f148",  # Ottobre 2025
    "6828ea4c-411a-41ea-b219-6527d99fba19",  # Novembre 2025
    "b305c3d2-4388-4ab0-aea2-e0a7c8dd0c4e"   # Dicembre 2025
]

# =========================
# INQUINANTI DA MONITORARE
# =========================

# Lista degli inquinanti che vogliamo analizzare
# Questi sono i parametri che filtriamo dai dati grezzi
# PM10 e PM2.5 = particolato, NO2 = biossido di azoto, O3 = ozono
# Questo serve per evitare colonne inutili e focalizzarsi su inquinanti importanti
InquinantiInteressati = ["PM10", "PM2.5", "NO2", "O3"]

# =========================
# PARAMETRI PER RICHIESTE API
# =========================

# Numero massimo di record scaricabili per richiesta CKAN
# L'API CKAN ha un limite per singola chiamata per non sovraccaricarsi
# Impostiamo 10000 come limite massimo per ognuna delle nostre query
Limit = 10000

# =========================
# CARTELLE E PERCORSI
# =========================

# Cartella principale dove salvare i dati
DATA_DIR = "data"

# Cartella per i dati processati/elaborati
PROCESSED_DIR = "data/processed"

# =========================
# NOMI FILE PROCESSATI
# =========================

# File CSV con dati grezzi (orari) puliti e pronti per l'uso
GREZZI_CLEAN_FILE = f"{PROCESSED_DIR}/grezzi_clean.csv"

# File CSV con media giornaliera dei dati grezzi
GREZZI_MEDIA_FILE = f"{PROCESSED_DIR}/grezzi_media_giornaliera.csv"

# File CSV con dati validati (storici) già aggregati per giorno
VALIDATI_FILE = f"{PROCESSED_DIR}/validati.csv"



# =====================================================
# FUNZIONE GENERICA: salva dati divisi per giorno
# =====================================================

def save_daily_split(df, folder_name):
    """
    Divide un DataFrame per data e salva:
    - un file JSON per ogni giorno
    - restituisce la lista metadata per l'index finale
    """

    df['date_only'] = pd.to_datetime(df['date']).dt.date
    unique_dates = sorted(df['date_only'].unique())

    data_dir = Path(f"data/{folder_name}")
    data_dir.mkdir(parents=True, exist_ok=True)

    date_index = []

    for date in unique_dates:
        df_day = df[df['date_only'] == date].copy()

        filename = f"data/{folder_name}/{date}.json"
        df_day.to_json(filename, orient="records", date_format="iso")

        date_index.append({
            "date": str(date),
            "type": folder_name,  # distingue realtime / historical
            "file": f"{folder_name}/{date}.json",
            "record_count": len(df_day)
        })

    print(f"✅ {folder_name}: creati {len(unique_dates)} file giornalieri")

    return date_index