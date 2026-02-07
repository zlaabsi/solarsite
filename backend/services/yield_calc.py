import numpy as np
import pandas as pd


def calculate_yield(
    pvgis_data: pd.DataFrame,
    shadow_matrix: pd.DataFrame,
    n_panels: int,
    module_power_wc: float,
    system_loss_pct: float = 14,
    temp_coefficient: float = -0.0035,
    capex_eur_per_wc: float = 0.6,
    opex_eur_per_kwc_year: float = 10.0,
    wacc: float = 0.06,
    lifetime_years: int = 25,
    co2_factor_t_per_mwh: float = 0.47,
) -> dict:
    installed_capacity_wc = n_panels * module_power_wc
    installed_capacity_kwc = installed_capacity_wc / 1000

    if "poa_global" in pvgis_data.columns:
        poa = pvgis_data["poa_global"]
    else:
        poa = pvgis_data["ghi"]

    if shadow_matrix is not None and not shadow_matrix.empty:
        avg_shadow = shadow_matrix.mean(axis=1)
        avg_shadow = avg_shadow.reindex(poa.index, method="nearest", fill_value=0)
        effective_irradiance = poa * (1 - avg_shadow)
    else:
        effective_irradiance = poa

    if "temp_air" in pvgis_data.columns:
        t_ambient = pvgis_data["temp_air"]
        t_cell = t_ambient + 0.03 * effective_irradiance
        temp_factor = 1 + temp_coefficient * (t_cell - 25)
        temp_factor = temp_factor.clip(0.7, 1.1)
    else:
        temp_factor = pd.Series(1.0, index=poa.index)

    system_factor = 1 - system_loss_pct / 100
    hourly_specific_yield = (
        (effective_irradiance / 1000) * temp_factor * system_factor
    )

    annual_specific_yield = hourly_specific_yield.sum() / len(
        pvgis_data.index.year.unique()
    )
    annual_yield_kwh = annual_specific_yield * installed_capacity_kwc
    annual_yield_mwh = annual_yield_kwh / 1000

    annual_ghi = (
        pvgis_data["ghi"].sum() / len(pvgis_data.index.year.unique()) / 1000
    )
    pr = annual_specific_yield / annual_ghi if annual_ghi > 0 else 0.80

    if shadow_matrix is not None:
        total_unshaded = (poa / 1000).sum()
        total_shaded = (effective_irradiance / 1000).sum()
        shadow_loss_pct = (
            (1 - total_shaded / total_unshaded) * 100 if total_unshaded > 0 else 0
        )
    else:
        shadow_loss_pct = 0

    capex_eur = installed_capacity_wc * capex_eur_per_wc / 1000 * 1000
    opex_annual_eur = installed_capacity_kwc * opex_eur_per_kwc_year
    annuity_factor = (wacc * (1 + wacc) ** lifetime_years) / (
        (1 + wacc) ** lifetime_years - 1
    )
    annual_cost = capex_eur * annuity_factor + opex_annual_eur
    lcoe = (annual_cost / annual_yield_mwh) if annual_yield_mwh > 0 else 0

    co2_avoided = annual_yield_mwh * co2_factor_t_per_mwh

    return {
        "installed_capacity_kwc": round(installed_capacity_kwc, 1),
        "installed_capacity_mwc": round(installed_capacity_kwc / 1000, 3),
        "annual_yield_kwh": round(annual_yield_kwh),
        "annual_yield_mwh": round(annual_yield_mwh, 1),
        "specific_yield_kwh_kwp": round(annual_specific_yield, 1),
        "performance_ratio": round(pr, 3),
        "shadow_loss_pct": round(shadow_loss_pct, 2),
        "lcoe_eur_mwh": round(lcoe, 1),
        "co2_avoided_tons_yr": round(co2_avoided, 1),
        "capex_total_eur": round(capex_eur),
    }
