// Genera src/data/cities/<ISO2>.json a partir del dataset completo de
// country-state-city, partido por país para poder cargarlo de forma
// diferida (import.meta.glob) y evitar bundlear las ~150k ciudades del
// mundo en un solo chunk.
//
// Re-ejecutar con `pnpm data:split-cities` si se actualiza la dependencia
// country-state-city (puede traer ciudades nuevas/renombradas).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "../node_modules/country-state-city/lib/assets/city.json");
const OUT_DIR = path.join(__dirname, "../src/data/cities");

// Filas originales: [name, countryCode, stateCode, latitude, longitude]
const rows = JSON.parse(readFileSync(SRC, "utf-8"));

const byCountry = new Map();
for (const [name, countryCode, stateCode, latitude, longitude] of rows) {
  if (!byCountry.has(countryCode)) byCountry.set(countryCode, []);
  // Se omite countryCode: queda implícito en el nombre del archivo.
  byCountry.get(countryCode).push([name, stateCode, latitude, longitude]);
}

if (existsSync(OUT_DIR)) {
  for (const file of readdirSync(OUT_DIR)) rmSync(path.join(OUT_DIR, file));
} else {
  mkdirSync(OUT_DIR, { recursive: true });
}

for (const [countryCode, cities] of byCountry) {
  writeFileSync(path.join(OUT_DIR, `${countryCode}.json`), JSON.stringify(cities));
}

console.log(`Generados ${byCountry.size} archivos de ciudades en ${path.relative(process.cwd(), OUT_DIR)}`);
