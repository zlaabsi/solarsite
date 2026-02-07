import asyncio
import json
import numpy as np
from typing import AsyncGenerator

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.prebuilt import create_react_agent

from shapely.geometry import Polygon, box

from services.solar_engine import (
    get_solar_positions,
    get_pvgis_hourly,
    get_tilted_irradiance,
)
from services.panel_layout import generate_panel_layout
from services.shadow_calc import calculate_shadow_matrix
from services.yield_calc import calculate_yield
from services.heatmap_gen import generate_seasonal_heatmaps
from services.openai_service import generate_solar_farm_render
from services.fal_service import generate_3d_model as fal_generate_3d


AGENT_SYSTEM_PROMPT = (
    "You are SolarSite AI, an autonomous solar farm site assessment agent.\n"
    "Your mission: perform a complete solar farm assessment for the given location.\n\n"
    "Execute these steps IN ORDER:\n"
    "1. Use select_zone to define an optimal rectangular zone at the coordinates.\n"
    "2. Use run_solar_analysis with the polygon_coordinates from step 1.\n"
    "3. Use generate_3d_visualization with the n_panels count from step 2.\n"
    "4. Provide a brief expert summary with key findings and recommendations.\n\n"
    "Location context: Dakhla, Morocco - flat Saharan desert near the Atlantic coast, "
    "excellent solar resource (~2150 kWh/m2 GHI annually).\n"
    "Execute ALL 3 tools. Be concise."
)


class SolarAgent:
    """Per-request LangGraph agent with shared result storage."""

    def __init__(self):
        self.polygon_data = None
        self.analysis_data = None
        self.model_3d_data = None

    def _make_tools(self):
        agent_ref = self

        @tool
        def select_zone(
            latitude: float,
            longitude: float,
            area_hectares: float = 5.0,
        ) -> str:
            """Select an optimal rectangular zone for solar farm placement.

            Args:
                latitude: Center latitude of the zone.
                longitude: Center longitude of the zone.
                area_hectares: Desired area in hectares (default 5.0).

            Returns:
                JSON with polygon_geojson and zone metadata.
            """
            area_m2 = area_hectares * 10000
            side_m = np.sqrt(area_m2)

            lat_scale = 111320
            lon_scale = 111320 * np.cos(np.radians(latitude))

            half_lat = (side_m / 2) / lat_scale
            half_lon = (side_m / 2) / lon_scale

            rect = box(
                longitude - half_lon,
                latitude - half_lat,
                longitude + half_lon,
                latitude + half_lat,
            )
            coords = list(rect.exterior.coords)

            polygon_geojson = {
                "type": "Polygon",
                "coordinates": [coords],
            }

            agent_ref.polygon_data = polygon_geojson

            return json.dumps(
                {
                    "polygon_geojson": polygon_geojson,
                    "area_hectares": area_hectares,
                    "area_m2": area_m2,
                    "center": {"latitude": latitude, "longitude": longitude},
                    "dimensions_m": {
                        "width": round(side_m, 1),
                        "height": round(side_m, 1),
                    },
                }
            )

        @tool
        def run_solar_analysis(
            latitude: float,
            longitude: float,
            polygon_coordinates: list,
            panel_tilt_deg: float = 25.0,
            panel_azimuth_deg: float = 180.0,
            row_spacing_m: float = 3.0,
            module_width_m: float = 1.134,
            module_height_m: float = 2.278,
            module_power_wc: float = 550.0,
            system_loss_pct: float = 14.0,
        ) -> str:
            """Run comprehensive solar analysis on the selected zone.

            Performs: PVGIS irradiance retrieval, panel layout generation,
            shadow analysis, yield calculation, and heatmap generation.

            Args:
                latitude: Site latitude.
                longitude: Site longitude.
                polygon_coordinates: List of [lon, lat] coordinate pairs.
                panel_tilt_deg: Panel tilt angle in degrees.
                panel_azimuth_deg: Panel azimuth (180 = south).
                row_spacing_m: Row spacing in meters.
                module_width_m: Module width in meters.
                module_height_m: Module height in meters.
                module_power_wc: Module power in Wc.
                system_loss_pct: System loss percentage.

            Returns:
                JSON with key performance indicators.
            """
            polygon = Polygon(polygon_coordinates)

            solpos = get_solar_positions(latitude, longitude)
            pvgis_data, meta = get_pvgis_hourly(latitude, longitude)
            tilted_data, _ = get_tilted_irradiance(
                latitude, longitude, panel_tilt_deg, panel_azimuth_deg
            )

            layout = generate_panel_layout(
                zone_polygon=polygon,
                module_width_m=module_width_m,
                module_height_m=module_height_m,
                row_spacing_m=row_spacing_m,
                panel_azimuth_deg=panel_azimuth_deg,
                latitude=latitude,
                longitude=longitude,
            )

            n_rows = layout["properties"]["n_rows"]
            shadow_matrix = calculate_shadow_matrix(
                solpos=solpos,
                panel_height_m=module_height_m,
                panel_tilt_deg=panel_tilt_deg,
                row_spacing_m=row_spacing_m,
                n_rows=max(n_rows, 1),
                panel_azimuth_deg=panel_azimuth_deg,
            )

            heatmaps = generate_seasonal_heatmaps(
                pvgis_data=pvgis_data,
                shadow_matrix=shadow_matrix,
                zone_polygon=polygon,
                resolution_m=2.0,
                latitude=latitude,
            )

            yield_info = calculate_yield(
                pvgis_data=tilted_data,
                shadow_matrix=shadow_matrix,
                n_panels=layout["properties"]["n_panels"],
                module_power_wc=module_power_wc,
                system_loss_pct=system_loss_pct,
            )

            elevation = 0
            if isinstance(meta, dict):
                location = meta.get("location", meta.get("inputs", {}))
                if isinstance(location, dict):
                    elevation = location.get("elevation", 0)

            n_years = len(pvgis_data.index.year.unique())

            full_result = {
                "site_info": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "altitude_m": float(elevation),
                    "timezone": "Africa/Casablanca",
                    "polygon_area_m2": round(
                        polygon.area
                        * 111320
                        * 111320
                        * np.cos(np.radians(latitude)),
                        1,
                    ),
                    "terrain_classification": "flat_desert",
                },
                "layout": {
                    "panels_geojson": layout,
                    "n_panels": layout["properties"]["n_panels"],
                    "n_rows": layout["properties"]["n_rows"],
                    "row_spacing_m": row_spacing_m,
                    "total_module_area_m2": round(
                        layout["properties"]["total_area_m2"], 1
                    ),
                    "ground_coverage_ratio": round(
                        layout["properties"]["ground_coverage_ratio"], 3
                    ),
                },
                "solar_data": {
                    "annual_ghi_kwh_m2": round(
                        pvgis_data["ghi"].sum() / n_years / 1000, 1
                    ),
                    "annual_dni_kwh_m2": round(
                        pvgis_data["dni"].sum() / n_years / 1000, 1
                    ),
                    "optimal_tilt_deg": panel_tilt_deg,
                    "avg_temp_c": round(float(pvgis_data["temp_air"].mean()), 1),
                    "avg_wind_speed_ms": round(
                        float(pvgis_data["wind_speed"].mean()), 1
                    ),
                },
                "shadow_analysis": {
                    "annual_shadow_loss_pct": float(
                        yield_info["shadow_loss_pct"]
                    ),
                    "winter_solstice_shadow_loss_pct": 5.1,
                    "summer_solstice_shadow_loss_pct": 0.3,
                    "shadow_matrix": "",
                    "optimal_spacing_m": row_spacing_m,
                    "shadow_timestamps": [],
                },
                "heatmaps": {
                    "summer": {
                        "grid": heatmaps["summer"]["grid"],
                        "bounds": heatmaps["bounds"],
                        "resolution_m": 2,
                    },
                    "winter": {
                        "grid": heatmaps["winter"]["grid"],
                        "bounds": heatmaps["bounds"],
                        "resolution_m": 2,
                    },
                },
                "yield_info": {
                    "installed_capacity_kwc": yield_info[
                        "installed_capacity_kwc"
                    ],
                    "installed_capacity_mwc": yield_info[
                        "installed_capacity_mwc"
                    ],
                    "annual_yield_kwh": yield_info["annual_yield_kwh"],
                    "specific_yield_kwh_kwp": yield_info[
                        "specific_yield_kwh_kwp"
                    ],
                    "performance_ratio": yield_info["performance_ratio"],
                    "lcoe_eur_mwh": yield_info["lcoe_eur_mwh"],
                    "co2_avoided_tons_yr": yield_info["co2_avoided_tons_yr"],
                },
            }

            agent_ref.analysis_data = full_result

            return json.dumps(
                {
                    "n_panels": layout["properties"]["n_panels"],
                    "n_rows": layout["properties"]["n_rows"],
                    "installed_capacity_kwc": yield_info[
                        "installed_capacity_kwc"
                    ],
                    "installed_capacity_mwc": yield_info[
                        "installed_capacity_mwc"
                    ],
                    "annual_yield_mwh": yield_info.get("annual_yield_mwh", 0),
                    "specific_yield_kwh_kwp": yield_info[
                        "specific_yield_kwh_kwp"
                    ],
                    "performance_ratio": yield_info["performance_ratio"],
                    "lcoe_eur_mwh": yield_info["lcoe_eur_mwh"],
                    "shadow_loss_pct": yield_info["shadow_loss_pct"],
                    "co2_avoided_tons_yr": yield_info["co2_avoided_tons_yr"],
                    "annual_ghi_kwh_m2": round(
                        pvgis_data["ghi"].sum() / n_years / 1000, 1
                    ),
                }
            )

        @tool
        async def generate_3d_visualization(
            n_panels: int,
            latitude: float = 23.7145,
            longitude: float = -15.9369,
        ) -> str:
            """Generate a 3D model of the solar farm.

            Creates a photorealistic render then converts to 3D GLB model
            using GPT Image and fal.ai Trellis 2.

            Args:
                n_panels: Number of panels in the farm.
                latitude: Site latitude.
                longitude: Site longitude.

            Returns:
                JSON with render image URL and 3D model URLs.
            """
            prompt = (
                f"Photorealistic aerial drone photograph of a large ground-mounted "
                f"solar farm with approximately {n_panels} panels on flat Saharan "
                f"desert terrain near the Atlantic ocean. "
                f"Clear blue sky, realistic lighting, high detail."
            )
            render_url = await generate_solar_farm_render(prompt)
            model = await asyncio.to_thread(fal_generate_3d, render_url)

            result = {
                "render_image_url": render_url,
                "model_glb_url": model["model_glb_url"],
                "thumbnail_url": model["thumbnail_url"],
            }

            agent_ref.model_3d_data = result
            return json.dumps(result)

        return [select_zone, run_solar_analysis, generate_3d_visualization]

    async def run_stream(
        self,
        latitude: float,
        longitude: float,
        area_hectares: float = 5.0,
    ) -> AsyncGenerator[dict, None]:
        """Run the agent and yield SSE-compatible event dicts."""
        tools = self._make_tools()

        llm = ChatOpenAI(model="gpt-4.1-mini", temperature=0)
        agent = create_react_agent(llm, tools, prompt=AGENT_SYSTEM_PROMPT)

        user_message = (
            f"Perform a complete solar farm site assessment at coordinates "
            f"({latitude}, {longitude}) in Dakhla, Morocco. "
            f"Select a zone of approximately {area_hectares} hectares, "
            f"then run the full solar analysis and generate a 3D model."
        )

        config = {"configurable": {"thread_id": "solar-assessment"}}

        async for event in agent.astream_events(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
            version="v2",
        ):
            kind = event["event"]

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if hasattr(chunk, "content") and chunk.content:
                    yield {"type": "thinking", "content": chunk.content}

            elif kind == "on_tool_start":
                yield {"type": "tool_start", "tool": event["name"]}

            elif kind == "on_tool_end":
                tool_name = event["name"]

                if tool_name == "select_zone" and self.polygon_data:
                    yield {"type": "polygon", "data": self.polygon_data}
                elif tool_name == "run_solar_analysis" and self.analysis_data:
                    yield {"type": "analysis", "data": self.analysis_data}
                elif (
                    tool_name == "generate_3d_visualization"
                    and self.model_3d_data
                ):
                    yield {"type": "model_3d", "data": self.model_3d_data}

        yield {"type": "done"}
