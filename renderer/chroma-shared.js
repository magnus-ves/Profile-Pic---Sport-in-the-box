'use strict';

// Delt grønnskjerm-logikk brukt av både hovedvinduet (app.js) og visningsskjermen (display.js).

function chromaColorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Erstatter piksler nær nøkkelfargen med tilsvarende piksel fra et bakgrunnsbilde (samme dimensjoner).
function compositeChromaOntoBackground(imageData, bgImageData, keyColor, tolerance, feather) {
  const data = imageData.data;
  const bgData = bgImageData.data;
  const { r: kr, g: kg, b: kb } = keyColor;
  const tol = tolerance;
  const feath = Math.max(feather, 1);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = chromaColorDistance(r, g, b, kr, kg, kb);

    let keyness = 0;
    if (dist < tol) keyness = 1;
    else if (dist < tol + feath) keyness = 1 - (dist - tol) / feath;
    if (keyness <= 0) continue;

    data[i] = r * (1 - keyness) + bgData[i] * keyness;
    data[i + 1] = g * (1 - keyness) + bgData[i + 1] * keyness;
    data[i + 2] = b * (1 - keyness) + bgData[i + 2] * keyness;
  }
  return imageData;
}
