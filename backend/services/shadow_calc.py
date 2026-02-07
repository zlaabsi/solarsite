import numpy as np
import pandas as pd
from shapely.geometry import Polygon


def calculate_shadow_length(
    panel_height_m: float,
    panel_tilt_deg: float,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_azimuth_deg: float = 180,
):
    if solar_elevation_deg <= 0:
        return float("inf"), 0

    tilt_rad = np.radians(panel_tilt_deg)
    elev_rad = np.radians(solar_elevation_deg)

    effective_height = panel_height_m * np.sin(tilt_rad)
    shadow_length = effective_height / np.tan(elev_rad)
    shadow_azimuth = (solar_azimuth_deg + 180) % 360

    return shadow_length, shadow_azimuth


def calculate_shadow_matrix(
    solpos: pd.DataFrame,
    panel_height_m: float,
    panel_tilt_deg: float,
    row_spacing_m: float,
    n_rows: int,
    panel_azimuth_deg: float = 180,
) -> pd.DataFrame:
    shadow_factors = np.zeros((len(solpos), n_rows))

    for idx, (_, row) in enumerate(solpos.iterrows()):
        elev = row["apparent_elevation"]
        azi = row["azimuth"]

        if elev <= 0:
            shadow_factors[idx, :] = 1.0
            continue

        shadow_len, shadow_azi = calculate_shadow_length(
            panel_height_m, panel_tilt_deg, elev, azi, panel_azimuth_deg
        )

        relative_azi = np.radians(shadow_azi - panel_azimuth_deg)
        perpendicular_shadow = shadow_len * abs(np.cos(relative_azi))

        if perpendicular_shadow > row_spacing_m:
            shade_fraction = min(
                1.0, (perpendicular_shadow - row_spacing_m) / panel_height_m
            )
        else:
            shade_fraction = 0.0

        for r in range(1, n_rows):
            shadow_factors[idx, r] = shade_fraction

    return pd.DataFrame(
        shadow_factors,
        index=solpos.index,
        columns=[f"row_{i}" for i in range(n_rows)],
    )


def calculate_shadow_polygons_for_timestamp(
    panel_rows_geojson: list,
    solar_elevation_deg: float,
    solar_azimuth_deg: float,
    panel_height_m: float,
    panel_tilt_deg: float,
    latitude: float = 23.7,
) -> list:
    shadow_length, shadow_azi = calculate_shadow_length(
        panel_height_m, panel_tilt_deg, solar_elevation_deg, solar_azimuth_deg
    )

    shadow_azi_rad = np.radians(shadow_azi)
    dx = shadow_length * np.sin(shadow_azi_rad)
    dy = shadow_length * np.cos(shadow_azi_rad)

    lat_rad = np.radians(latitude)
    dx_deg = dx / (111320 * np.cos(lat_rad))
    dy_deg = dy / 111320

    shadow_polygons = []
    for row_feature in panel_rows_geojson:
        coords = row_feature["geometry"]["coordinates"][0]
        shadow_coords = [(c[0] + dx_deg, c[1] + dy_deg) for c in coords]
        panel_poly = Polygon(coords)
        shadow_poly = Polygon(shadow_coords)
        full_shadow = panel_poly.union(shadow_poly).convex_hull
        shadow_polygons.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [list(full_shadow.exterior.coords)],
                },
            }
        )

    return shadow_polygons
