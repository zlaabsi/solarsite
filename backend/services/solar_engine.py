"""Solar engine — PVGIS API client + solar position wrapper.

Replaces pvlib dependency with direct PVGIS REST API calls to stay under
Vercel's 250 MB serverless function limit.
"""

import numpy as np
import pandas as pd
import httpx

from services.solar_position import get_solar_positions  # noqa: F401 — re-export

PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5_3/seriescalc"

# PVGIS JSON keys → our column names (same as pvlib map_variables=True)
_VARIABLE_MAP = {
    "Gb(i)": "poa_direct",
    "Gd(i)": "poa_sky_diffuse",
    "Gr(i)": "poa_ground_diffuse",
    "T2m": "temp_air",
}


def _add_derived_columns(data: pd.DataFrame) -> pd.DataFrame:
    """Add ghi, dni, poa_global columns from PVGIS POA components."""
    data["ghi"] = (
        data["poa_direct"] + data["poa_sky_diffuse"] + data["poa_ground_diffuse"]
    )
    solar_elev = data.get("solar_elevation")
    if solar_elev is not None:
        sin_elev = np.sin(np.radians(solar_elev.clip(lower=1)))
        data["dni"] = (data["poa_direct"] / sin_elev).clip(lower=0, upper=1500)
    else:
        data["dni"] = data["poa_direct"]
    data["poa_global"] = (
        data["poa_direct"] + data["poa_sky_diffuse"] + data["poa_ground_diffuse"]
    )
    return data


def _parse_pvgis_time(time_str: str) -> pd.Timestamp:
    """Parse PVGIS time string like '20200101:0010' → Timestamp (UTC)."""
    return pd.Timestamp(
        year=int(time_str[:4]),
        month=int(time_str[4:6]),
        day=int(time_str[6:8]),
        hour=int(time_str[9:11]),
        minute=int(time_str[11:13]),
        tz="UTC",
    )


def _fetch_pvgis(lat, lon, start, end, tilt, azimuth) -> tuple[pd.DataFrame, dict]:
    """Call PVGIS seriescalc REST API and return (DataFrame, metadata)."""
    # PVGIS azimuth convention: 0=south, -90=east, 90=west
    pvgis_aspect = azimuth - 180

    params = {
        "lat": lat,
        "lon": lon,
        "startyear": start,
        "endyear": end,
        "raddatabase": "PVGIS-SARAH3",
        "components": 1,
        "outputformat": "json",
        "usehorizon": 1,
        "pvcalculation": 0,
        "angle": tilt,
        "aspect": pvgis_aspect,
    }

    resp = httpx.get(PVGIS_BASE, params=params, timeout=30)
    resp.raise_for_status()
    payload = resp.json()

    hourly = payload["outputs"]["hourly"]
    records = []
    for entry in hourly:
        row = {"time": _parse_pvgis_time(entry["time"])}
        for old_key, new_key in _VARIABLE_MAP.items():
            row[new_key] = entry.get(old_key, 0)
        records.append(row)

    df = pd.DataFrame(records).set_index("time")
    meta = payload.get("meta", payload.get("inputs", {}))
    return df, meta


def get_pvgis_hourly(lat: float, lon: float, start: int = 2020, end: int = 2023):
    data, meta = _fetch_pvgis(lat, lon, start, end, tilt=0, azimuth=180)
    data = _add_derived_columns(data)
    return data, meta


def get_tilted_irradiance(lat: float, lon: float, tilt: float, azimuth: float):
    data, meta = _fetch_pvgis(lat, lon, 2020, 2023, tilt=tilt, azimuth=azimuth)
    data = _add_derived_columns(data)
    return data, meta
