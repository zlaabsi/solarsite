import numpy as np
import pandas as pd
from shapely.geometry import Polygon, Point


def generate_seasonal_heatmaps(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    zone_polygon: Polygon,
    resolution_m: float = 5.0,
    latitude: float = 23.7,
) -> dict:
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    minx, miny, maxx, maxy = zone_polygon.bounds
    width_m = (maxx - minx) * lon_scale
    height_m = (maxy - miny) * lat_scale

    nx = max(int(width_m / resolution_m), 10)
    ny = max(int(height_m / resolution_m), 10)

    summer_months = [6, 7, 8]
    winter_months = [12, 1, 2]

    pvgis_summer = pvgis_data[pvgis_data.index.month.isin(summer_months)]
    pvgis_winter = pvgis_data[pvgis_data.index.month.isin(winter_months)]

    summer_avg_ghi = pvgis_summer["ghi"].mean() if len(pvgis_summer) > 0 else 0
    winter_avg_ghi = pvgis_winter["ghi"].mean() if len(pvgis_winter) > 0 else 0

    summer_grid = np.full((ny, nx), summer_avg_ghi)
    winter_grid = np.full((ny, nx), winter_avg_ghi)

    if shadow_matrix is not None:
        shadow_summer = shadow_matrix[
            shadow_matrix.index.month.isin(summer_months)
        ].mean()
        shadow_winter = shadow_matrix[
            shadow_matrix.index.month.isin(winter_months)
        ].mean()

        n_rows = len(shadow_summer)
        for j in range(ny):
            row_idx = min(int(j / ny * n_rows), n_rows - 1)
            row_key = f"row_{row_idx}"
            if row_key in shadow_summer.index:
                summer_grid[j, :] *= 1 - shadow_summer[row_key]
            if row_key in shadow_winter.index:
                winter_grid[j, :] *= 1 - shadow_winter[row_key]

    for j in range(ny):
        for i in range(nx):
            cell_lon = minx + (i + 0.5) * (maxx - minx) / nx
            cell_lat = miny + (j + 0.5) * (maxy - miny) / ny
            if not zone_polygon.contains(Point(cell_lon, cell_lat)):
                summer_grid[j, i] = np.nan
                winter_grid[j, i] = np.nan

    return {
        "summer": {
            "grid": summer_grid.tolist(),
            "avg_irradiance_w_m2": round(float(np.nanmean(summer_grid)), 1),
        },
        "winter": {
            "grid": winter_grid.tolist(),
            "avg_irradiance_w_m2": round(float(np.nanmean(winter_grid)), 1),
        },
        "bounds": {
            "north": maxy,
            "south": miny,
            "east": maxx,
            "west": minx,
        },
        "resolution": {
            "nx": nx,
            "ny": ny,
            "cell_size_m": resolution_m,
        },
    }
