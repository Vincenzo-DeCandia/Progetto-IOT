
# =========================
# CLIENT CKAN
# =========================
# Questo file si occupa ESCLUSIVAMENTE
# di scaricare i dati dall’API CKAN.



import requests.api
import pandas as pd
from config import URL, Limit

def fetch_cska_client(resource_id):

    records = [] # lista che conterrà tutti i record
    offset = 0 # indica da quale record iniziare a scaricare

    while True:
        # Parametri della richiesta HTTP
        params = {
            "resource_id": resource_id,  # dataset specifico
            "limit": Limit,  # massimo numero di record
            "offset": offset  # punto di partenza
        }

        # Chiamata GET all’API
        response = requests.get(URL, params=params)

        # Se la richiesta fallisce, viene sollevata un’eccezione
        response.raise_for_status()

        # Conversione risposta JSON → dizionario Python
        data = response.json()

        # Estrazione dei record dal risultato
        batch = data["result"]["records"]

        # Aggiungiamo i record correnti alla lista totale
        records.extend(batch)

        # Se i record scaricati sono meno del limite,
        # significa che siamo arrivati alla fine del dataset
        if len(batch) < Limit:
            break

        # Altrimenti passiamo al blocco successivo
        offset += Limit

    return pd.DataFrame(records)



def fetch_multiple_resources(resource_ids):
    """
    Scarica e concatena più resource_id CKAN
    restituendo un unico DataFrame.
    """

    frames = []

    for rid in resource_ids:
        df = fetch_cska_client(rid)
        frames.append(df)

    return pd.concat(frames, ignore_index=True)