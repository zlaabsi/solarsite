import numpy as np
from shapely.geometry import Polygon, box
from shapely.affinity import rotate


def generate_panel_layout(
    zone_polygon: Polygon,
    module_width_m: float,
    module_height_m: float,
    row_spacing_m: float,
    panel_azimuth_deg: float,
    latitude: float,
    longitude: float,
) -> dict:
    lat_scale = 111320
    lon_scale = 111320 * np.cos(np.radians(latitude))

    centroid = zone_polygon.centroid
    cx, cy = centroid.x, centroid.y

    def to_meters(coord):
        return ((coord[0] - cx) * lon_scale, (coord[1] - cy) * lat_scale)

    def to_degrees(coord):
        return (coord[0] / lon_scale + cx, coord[1] / lat_scale + cy)

    zone_coords_m = [to_meters(c) for c in zone_polygon.exterior.coords]
    zone_m = Polygon(zone_coords_m)

    minx, miny, maxx, maxy = zone_m.bounds
    rotation_angle = panel_azimuth_deg - 180

    panels = []
    row_index = 0
    y = miny + module_height_m / 2

    while y + module_height_m / 2 <= maxy:
        row_rect = box(minx, y - module_height_m / 2, maxx, y + module_height_m / 2)

        if rotation_angle != 0:
            row_rect = rotate(row_rect, rotation_angle, origin=zone_m.centroid)

        clipped = zone_m.intersection(row_rect)

        if not clipped.is_empty and clipped.area > module_width_m * module_height_m:
            row_length = clipped.bounds[2] - clipped.bounds[0]
            n_modules_in_row = int(row_length / module_width_m)

            for i in range(n_modules_in_row):
                module_x = clipped.bounds[0] + i * module_width_m
                module_rect = box(
                    module_x,
                    y - module_height_m / 2,
                    module_x + module_width_m,
                    y + module_height_m / 2,
                )

                if (
                    zone_m.contains(module_rect)
                    or zone_m.intersection(module_rect).area
                    > 0.9 * module_rect.area
                ):
                    coords_deg = [
                        to_degrees(c) for c in module_rect.exterior.coords
                    ]
                    panels.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "row": row_index,
                                "col": i,
                                "area_m2": module_width_m * module_height_m,
                            },
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [coords_deg],
                            },
                        }
                    )

            row_index += 1

        y += row_spacing_m

    return {
        "type": "FeatureCollection",
        "features": panels,
        "properties": {
            "n_panels": len(panels),
            "n_rows": row_index,
            "total_area_m2": len(panels) * module_width_m * module_height_m,
            "ground_coverage_ratio": (
                (len(panels) * module_width_m * module_height_m) / zone_m.area
                if zone_m.area > 0
                else 0
            ),
        },
    }
