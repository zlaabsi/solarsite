export function irradianceToColor(value, min = 0, max = 1200) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (t < 0.25) {
    const s = t / 0.25;
    return [0, Math.round(s * 100), Math.round(200 + s * 55)];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0, Math.round(100 + s * 155), Math.round(255 - s * 55)];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [Math.round(s * 255), 255, Math.round(200 - s * 200)];
  } else {
    const s = (t - 0.75) / 0.25;
    return [255, Math.round(255 - s * 155), 0];
  }
}

export function getColorScale() {
  const steps = 10;
  const colors = [];
  for (let i = 0; i <= steps; i++) {
    const value = (i / steps) * 1200;
    colors.push({ value, color: irradianceToColor(value) });
  }
  return colors;
}
