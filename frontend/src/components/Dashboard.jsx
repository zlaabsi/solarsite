export default function Dashboard({ data, onGenerate3D }) {
  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        <div className="text-4xl mb-3 opacity-50">&#9728;</div>
        <p className="text-sm">Draw a zone on the map to start analysis</p>
      </div>
    );
  }

  const { yield_info, layout, solar_data, shadow_analysis } = data;

  const metrics = [
    {
      label: "Installed Capacity",
      value: yield_info.installed_capacity_mwc,
      unit: "MWc",
      accent: true,
    },
    {
      label: "Annual Yield",
      value: yield_info.annual_yield_kwh?.toLocaleString(),
      unit: "kWh/yr",
    },
    {
      label: "Specific Yield",
      value: yield_info.specific_yield_kwh_kwp,
      unit: "kWh/kWp",
    },
    {
      label: "Performance Ratio",
      value: `${(yield_info.performance_ratio * 100).toFixed(1)}`,
      unit: "%",
    },
    {
      label: "Shadow Loss",
      value: shadow_analysis.annual_shadow_loss_pct,
      unit: "%",
    },
    { label: "LCOE", value: yield_info.lcoe_eur_mwh, unit: "EUR/MWh" },
    {
      label: "CO2 Avoided",
      value: yield_info.co2_avoided_tons_yr,
      unit: "t/yr",
    },
    { label: "Panels", value: layout.n_panels?.toLocaleString(), unit: "" },
    { label: "Rows", value: layout.n_rows, unit: "" },
    {
      label: "GCR",
      value: `${(layout.ground_coverage_ratio * 100).toFixed(1)}`,
      unit: "%",
    },
    { label: "GHI", value: solar_data.annual_ghi_kwh_m2, unit: "kWh/m²/yr" },
    {
      label: "Avg Temp",
      value: solar_data.avg_temp_c,
      unit: "C",
    },
  ];

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold text-white mb-4">Site Analysis</h2>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-lg p-3 ${
              m.accent ? "bg-amber-500/10 border border-amber-500/30" : "bg-gray-800"
            }`}
          >
            <div className="text-xs text-gray-500">{m.label}</div>
            <div
              className={`text-lg font-bold ${
                m.accent ? "text-amber-400" : "text-white"
              }`}
            >
              {m.value}{" "}
              <span className="text-xs font-normal text-gray-500">
                {m.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onGenerate3D}
        className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold py-3 rounded-lg transition"
      >
        Generate 3D Model
      </button>
    </div>
  );
}
