# =========================
# AGGREGAZIONE DATI
# =========================



def media_giornaliera(df):
    """
    Calcola la media giornaliera a partire dai dati ORARI.
    Ogni giorno → una sola riga per stazione e inquinante.
    """

    # Estraiamo la data (YYYY-MM-DD) dalla data oraria
    df["Data"] = df["Data_ora"].dt.date

    # Raggruppiamo per giorno, stazione e inquinante
    df_media = (
        df
        .groupby(
            ["Stazione", "Descrizione", "Inquinante", "Data"],
            as_index=False
        )
        .agg(
            Media_Giornaliera=("Valore", "mean"),
            Ore_Disponibili=("Valore", "count")  # tiene conto delle ore prese per calcolare la media odierna(24,18,6)
        )
    )

    return df_media