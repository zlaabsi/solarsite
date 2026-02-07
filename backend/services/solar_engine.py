import numpy as np
import pvlib
import pandas as pd

from services.geo_utils import lookup_timezone


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


def get_solar_positions(lat: float, lon: float, year: int = 2024) -> pd.DataFrame:
    tz = lookup_timezone(lat, lon)
    location = pvlib.location.Location(
        latitude=lat,
        longitude=lon,
        tz=tz,
        altitude=0,
    )

    times = pd.date_range(
        start=f"{year}-01-01",
        end=f"{year}-12-31 23:00",
        freq="h",
        tz=tz,
    )

    solpos = location.get_solarposition(times)
    solpos_day = solpos[solpos["apparent_elevation"] > 0]
    return solpos_day


def get_pvgis_hourly(lat: float, lon: float, start: int = 2020, end: int = 2023):
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=start,
        end=end,
        raddatabase="PVGIS-SARAH3",
        components=True,
        surface_tilt=0,
        surface_azimuth=180,
        outputformat="json",
        usehorizon=True,
        pvcalculation=False,
        map_variables=True,
        url="https://re.jrc.ec.europa.eu/api/v5_3/",
        timeout=30,
    )
    data = _add_derived_columns(data)
    return data, meta


def get_tilted_irradiance(lat: float, lon: float, tilt: float, azimuth: float):
    data, meta = pvlib.iotools.get_pvgis_hourly(
        latitude=lat,
        longitude=lon,
        start=2020,
        end=2023,
        raddatabase="PVGIS-SARAH3",
        components=True,
        surface_tilt=tilt,
        surface_azimuth=azimuth,
        outputformat="json",
        usehorizon=True,
        pvcalculation=False,
        map_variables=True,
        url="https://re.jrc.ec.europa.eu/api/v5_3/",
        timeout=30,
    )
    data = _add_derived_columns(data)
    return data, meta
