const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PRESETS = [
  { label: "Summer Solstice", month: 6, hour: 12 },
  { label: "Winter Solstice", month: 12, hour: 12 },
  { label: "Equinox", month: 3, hour: 12 },
];

export default function TimeSlider({ hour, month, onHourChange, onMonthChange }) {
  return (
    <div className="bg-gray-900/90 backdrop-blur-sm rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-400">
          Shadow Simulation
        </span>
        <span className="text-sm font-mono text-amber-400">
          {MONTHS[month - 1]} &mdash; {String(hour).padStart(2, "0")}:00
        </span>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Hour</label>
          <input
            type="range"
            min={5}
            max={20}
            value={hour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">Month</label>
          <input
            type="range"
            min={1}
            max={12}
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              onHourChange(p.hour);
              onMonthChange(p.month);
            }}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-md transition"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
