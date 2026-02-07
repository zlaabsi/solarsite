import { getColorScale } from "../utils/color-scales";

export default function SeasonCompare({ summerData, winterData }) {
  const scale = getColorScale();

  if (!summerData || !winterData) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        Run analysis to compare seasons
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Summer vs Winter Irradiance
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Summer (Jun-Aug)</div>
          <div className="text-2xl font-bold text-amber-400">
            {summerData.avg_irradiance_w_m2}
          </div>
          <div className="text-xs text-gray-500">W/m² avg</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Winter (Dec-Feb)</div>
          <div className="text-2xl font-bold text-blue-400">
            {winterData.avg_irradiance_w_m2}
          </div>
          <div className="text-xs text-gray-500">W/m² avg</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {scale.map((s, i) => (
          <div
            key={i}
            className="flex-1 h-3 rounded-sm"
            style={{
              backgroundColor: `rgb(${s.color[0]},${s.color[1]},${s.color[2]})`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>0</span>
        <span>600</span>
        <span>1200 W/m²</span>
      </div>
    </div>
  );
}
