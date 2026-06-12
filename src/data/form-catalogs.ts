/**
 * Catálogos de datos para formularios personalizados.
 *
 * País y Estado/Departamento usan country-state-city directamente (datasets
 * pequeños: ~95KB y ~554KB). Ciudad usa un dataset propio partido por país
 * en src/data/cities/<ISO2>.json (generado por scripts/split-cities.mjs a
 * partir de country-state-city), cargado de forma diferida vía
 * import.meta.glob — evita bundlear las ~150k ciudades del mundo (~8MB) en
 * un solo chunk cuando solo se necesitan las del país seleccionado.
 */

import { Country, State } from "country-state-city";
import type { ICountry, IState, ICity } from "country-state-city";

// Re-exportar tipos de la librería
export type { ICountry, IState, ICity };

// Obtener todos los países
export const getAllCountries = (): ICountry[] => {
  return Country.getAllCountries();
};

// Obtener estados/departamentos de un país
export const getStatesByCountry = (countryCode: string): IState[] => {
  return State.getStatesOfCountry(countryCode);
};

// Obtener información de un país por código
export const getCountryByCode = (countryCode: string): ICountry | undefined => {
  return Country.getCountryByCode(countryCode);
};

// Helper: Obtener código telefónico por país
export function getDialCodeByCountry(countryCode: string): string {
  const country = Country.getCountryByCode(countryCode);
  const raw = country?.phonecode || "";
  // Algunos países tienen múltiples códigos (ej: "1-809 and 1-829" para DO)
  // Tomamos solo el primero y eliminamos el "+" inicial si ya viene incluido
  const first = raw.split(/\s+and\s+/i)[0].trim().replace(/^\+/, "");
  return first;
}

// ─── Ciudades: dataset propio partido por país (carga diferida) ────────────

// Filas comprimidas: [name, stateCode, latitude, longitude]
type CityRow = [name: string, stateCode: string, latitude: string, longitude: string];

const cityModules = import.meta.glob<{ default: CityRow[] }>("./cities/*.json");

const cityCache = new Map<string, ICity[]>();

// Obtener todas las ciudades de un país (carga el chunk del país la primera vez)
export async function getCitiesByCountry(countryCode: string): Promise<ICity[]> {
  const cached = cityCache.get(countryCode);
  if (cached) return cached;

  const loadModule = cityModules[`./cities/${countryCode}.json`];
  if (!loadModule) return [];

  const rows = (await loadModule()).default;
  const cities: ICity[] = rows.map(([name, stateCode, latitude, longitude]) => ({
    name,
    countryCode,
    stateCode,
    latitude,
    longitude,
  }));

  cityCache.set(countryCode, cities);
  return cities;
}
