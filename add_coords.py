# =====================================================
# FILE: add_coords.py
# SCOPO: Aggiungere coordinate geografiche (lat/lon)
#        alle stazioni nel DataFrame
# =====================================================

import json
from pathlib import Path

# Percorso del file JSON che contiene le coordinate di tutte le stazioni
# Formato: {"Nome Stazione": {"lat": 40.123, "lon": 14.456}, ...}
COORDS_FILE = Path("data/station_coords.json")


def load_coords_mapping(coords_file=COORDS_FILE):
    """
    Carica il mapping stazioni-coordinate dal file JSON.

    Args:
        coords_file (Path): Percorso del file JSON con le coordinate

    Returns:
        dict: Dizionario con stazioni come chiave e {"lat": float, "lon": float} come valore
              Ritorna un dict vuoto se il file non esiste o c'è un errore di lettura
    """
    if coords_file.exists():
        try:
            # Leggi il file JSON e convertilo in dizionario Python
            return json.loads(coords_file.read_text(encoding="utf-8"))
        except Exception as e:
            # Se c'è un errore (file corrotto, encoding, ecc.) stampa l'errore
            print(f"Errore caricamento {coords_file}: {e}")
            return {}
    # Se il file non esiste, ritorna un dict vuoto
    return {}


def add_coords_to_df(df, station_col="Descrizione"):
    """
    Aggiunge le colonne 'latitude' e 'longitude' al DataFrame.

    Questa funzione:
    1. Carica le coordinate dal JSON
    2. Cerca ogni stazione nel mapping
    3. Aggiunge due nuove colonne al DataFrame con lat/lon

    Args:
        df (DataFrame): Il DataFrame a cui aggiungere le coordinate
        station_col (str): Nome della colonna che contiene i nomi delle stazioni
                          (default: "Descrizione")

    Returns:
        DataFrame: Lo stesso DataFrame con le nuove colonne 'latitude' e 'longitude'
    """
    # Carica il mapping stazioni-coordinate dal JSON
    coords_mapping = load_coords_mapping()

    # Funzione che cerca le coordinate per una singola stazione
    def lookup(cell):
        # Converte il valore della cella in stringa (evita None)
        key = cell if cell is not None else ""

        # Cerca la stazione nel mapping
        # Se non trovata, ritorna un dict vuoto con lat/lon = None
        entry = coords_mapping.get(key) or {"lat": None, "lon": None}

        # Ritorna una tupla (lat, lon)
        return (entry.get("lat"), entry.get("lon"))

    # Applica la funzione lookup a ogni riga della colonna station_col
    # Ritorna una Series di tuple (lat, lon)
    lat_lon = df[station_col].apply(lambda x: lookup(x))

    # Crea la colonna 'latitude' estraendo il primo elemento di ogni tupla
    df["latitude"] = lat_lon.apply(lambda t: t[0])

    # Crea la colonna 'longitude' estraendo il secondo elemento di ogni tupla
    df["longitude"] = lat_lon.apply(lambda t: t[1])

    # Ritorna il DataFrame modificato con le nuove colonne
    return df
