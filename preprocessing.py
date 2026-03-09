# =========================
# PREPROCESSING DATI
# =========================
# Qui avvengono tutte le operazioni di pulizia dei dati (grezzi).

import pandas as pd
from config import InquinantiInteressati

def preprocess_orari_grezzi(df):
    """
    Pulizia dei dati ORARI GREZZI:
    - conversione data
    - conversione valori numerici
    - rimozione valori non fisici
    """

    # Conversione della colonna Data_ora in formato datetime
    # errors="coerce" trasforma errori in NaT
    df["Data_ora"] = pd.to_datetime(df["Data_ora"], errors="coerce", dayfirst=True)

    #Elimino le date non risultate valide
    df = df.dropna(subset=["Data_ora"])

    # Conversione della colonna Valore in numerico
    # eventuali stringhe diventano NaN
    df.loc[:, "Valore"] = pd.to_numeric(df["Valore"], errors="coerce")

    # Rimuoviamo valori negativi (non fisici)
    df = df[df["Valore"] >= 0]

    # Selezioniamo solo le colonne utili
    return df[[
        "Data_ora",
        "Stazione",
        "Descrizione",
        "Inquinante",
        "Valore"
    ]]



# Denoising dei dati tramite filtro IQR (InterQuartile Range).
# Per ciascuna coppia (stazione, inquinante) vengono calcolati:
# - il primo quartile (Q1)
# - il terzo quartile (Q3)
# L'intervallo interquartile è definito come IQR = Q3 - Q1.
# I valori che risultano inferiori a (Q1 - 1.5 * IQR) o superiori a
# (Q3 + 1.5 * IQR) vengono considerati outlier e rimossi.
# Questo approccio consente di eliminare valori anomali dovuti a errori
# di misura dei sensori, preservando l'andamento reale e la distribuzione
# statistica dei dati.

def denoise_iqr(df):
    """
    Rimozione dei valori anomali (outlier)
    tramite metodo IQR.
    """

    def iqr_filter(group):
        """
        Applica il filtro IQR a un singolo gruppo
        (stazione + inquinante).
        """

        # Calcolo dei quartili
        q1 = group["Valore"].quantile(0.25)
        q3 = group["Valore"].quantile(0.75)

        # Intervallo interquartile
        iqr = q3 - q1

        # Limiti accettabili
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        # Manteniamo solo i valori plausibili
        return group[
            (group["Valore"] >= lower) &
            (group["Valore"] <= upper)
        ]

    # Applichiamo il filtro separatamente
    # per ogni stazione e inquinante
    return (
        df
        .groupby(["Stazione", "Inquinante"], group_keys=False)
        .apply(iqr_filter)
    )



def filtro_inquinanti(df):
    # Manteniamo solo gli inquinanti di interesse
    df = df[df["Inquinante"].isin(InquinantiInteressati)]
    return df