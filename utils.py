import os
import pandas as pd


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