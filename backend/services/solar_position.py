"""Lightweight solar position calculator using Spencer (1971) formulas.

Replaces pvlib.location.Location.get_solarposition() to avoid the heavy
pvlib/scipy dependency chain on Vercel serverless (250 MB limit).
Accuracy: ~1° elevation, ~2° azimuth — sufficient for shadow simulation.
"""

import numpy as np
import pandas as pd


def _timezone_from_longitude(lon: float) -> str:
    """Return Etc/GMT±N timezone string from longitude."""
    offset = round(lon / 15)
    return f"Etc/GMT{-offset:+d}" if offset != 0 else "UTC"


def get_solar_positions(lat: float, lon: float, year: int = 2024) -> pd.DataFrame:
    """Compute hourly solar positions for a full year.

    Returns a DataFrame (daytime rows only) with columns:
        apparent_elevation  – solar altitude in degrees
        azimuth             – compass bearing from North (0–360°)
    """
    tz_name = _timezone_from_longitude(lon)
    times = pd.date_range(
        start=f"{year}-01-01",
        end=f"{year}-12-31 23:00",
        freq="h",
        tz=tz_name,
    )

    doy = times.dayofyear.values.astype(float)

    # Day angle (Spencer, 1971)
    B = (2 * np.pi / 365) * (doy - 1)

    # Equation of time [minutes]
    EoT = 229.18 * (
        0.000075
        + 0.001868 * np.cos(B)
        - 0.032077 * np.sin(B)
        - 0.014615 * np.cos(2 * B)
        - 0.04089 * np.sin(2 * B)
    )

    # Solar declination [radians]
    decl = (
        0.006918
        - 0.399912 * np.cos(B)
        + 0.070257 * np.sin(B)
        - 0.006758 * np.cos(2 * B)
        + 0.000907 * np.sin(2 * B)
        - 0.002697 * np.cos(3 * B)
        + 0.00148 * np.sin(3 * B)
    )

    # Solar time
    hours = times.hour.values.astype(float) + times.minute.values.astype(float) / 60
    standard_meridian = round(lon / 15) * 15
    time_correction = 4 * (lon - standard_meridian) + EoT  # minutes
    solar_time = hours + time_correction / 60  # hours

    # Hour angle [radians]
    hour_angle_rad = np.radians(15 * (solar_time - 12))
    lat_rad = np.radians(lat)

    # Solar elevation
    sin_elev = (
        np.sin(lat_rad) * np.sin(decl)
        + np.cos(lat_rad) * np.cos(decl) * np.cos(hour_angle_rad)
    )
    elevation = np.degrees(np.arcsin(np.clip(sin_elev, -1, 1)))

    # Solar azimuth (from North, clockwise)
    zenith_rad = np.arccos(np.clip(sin_elev, -1, 1))
    sin_zenith = np.sin(zenith_rad)

    cos_azi = np.where(
        sin_zenith > 1e-6,
        (np.sin(decl) - np.sin(lat_rad) * np.cos(zenith_rad))
        / (np.cos(lat_rad) * sin_zenith),
        0.0,
    )
    azimuth = np.degrees(np.arccos(np.clip(cos_azi, -1, 1)))

    # Afternoon: azimuth > 180°
    azimuth = np.where(hour_angle_rad > 0, 360 - azimuth, azimuth)

    df = pd.DataFrame(
        {"apparent_elevation": elevation, "azimuth": azimuth},
        index=times,
    )
    return df[df["apparent_elevation"] > 0]
