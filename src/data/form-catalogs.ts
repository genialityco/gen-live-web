/**
 * Catálogos de datos para formularios personalizados
 * Usando librería country-state-city para datos completos del mundo
 */

import { Country, State, City } from "country-state-city";
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

// Obtener ciudades de un estado/departamento
export const getCitiesByState = (
  countryCode: string,
  stateCode: string
): ICity[] => {
  return City.getCitiesOfState(countryCode, stateCode);
};

// Obtener todas las ciudades de un país
export const getCitiesByCountry = (countryCode: string): ICity[] => {
  return City.getCitiesOfCountry(countryCode) || [];
};

// Obtener información de un país por código
export const getCountryByCode = (countryCode: string): ICountry | undefined => {
  return Country.getCountryByCode(countryCode);
};

// Obtener información de un estado por código
export const getStateByCode = (
  countryCode: string,
  stateCode: string
): IState | undefined => {
  return State.getStateByCodeAndCountry(stateCode, countryCode);
};

// Helper: Obtener ciudades de Colombia (código CO)
export const getColombianCities = (): ICity[] => {
  return City.getCitiesOfCountry("CO") || [];
};

// Helper: Obtener departamentos de Colombia
export const getColombianStates = (): IState[] => {
  return State.getStatesOfCountry("CO") || [];
};

// Helper: Obtener código telefónico por país
export function getDialCodeByCountry(countryCode: string): string {
  const country = Country.getCountryByCode(countryCode);
  return country?.phonecode || "";
}

// Helper: Obtener estado/departamento de una ciudad
export function getStateByCity(
  countryCode: string,
  cityName: string
): IState | undefined {
  const cities = City.getCitiesOfCountry(countryCode) || [];
  const city = cities.find((c) => c.name === cityName);
  if (city && city.stateCode) {
    return State.getStateByCodeAndCountry(city.stateCode, countryCode);
  }
  return undefined;
}

// Helper: Construir mapa dinámico de ciudad → estado para un país
export function buildCityToStateMap(
  countryCode: string
): Record<string, string> {
  const cities = City.getCitiesOfCountry(countryCode) || [];
  const map: Record<string, string> = {};

  cities.forEach((city) => {
    if (city.stateCode) {
      const state = State.getStateByCodeAndCountry(city.stateCode, countryCode);
      if (state) {
        map[city.name] = state.name;
      }
    }
  });

  return map;
}

// Obtener mapa de ciudades colombianas (cache)
let colombianCityMap: Record<string, string> | null = null;
export function getCityToStateMapColombia(): Record<string, string> {
  if (!colombianCityMap) {
    colombianCityMap = buildCityToStateMap("CO");
  }
  return colombianCityMap;
}

// Helper: Formatear código telefónico para mostrar (ej: "+57" o "+1")
export function formatDialCode(countryCode: string): string {
  const dialCode = getDialCodeByCountry(countryCode);
  return dialCode ? `+${dialCode}` : "";
}

// Helper: Obtener opciones de países con código telefónico para select
export function getCountriesWithDialCode(): Array<{ value: string; label: string; dialCode: string }> {
  const countries = getAllCountries();
  return countries.map((country) => ({
    value: country.isoCode,
    label: country.name,
    dialCode: country.phonecode ? `+${country.phonecode}` : "",
  }));
}
