import {
  geoEquirectangular,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import countriesTopology from "world-atlas/countries-50m.json";

const topology = countriesTopology as unknown as Topology;
const countryCollection = feature(topology, topology.objects.countries);

export const countryFeatures =
  countryCollection.type === "FeatureCollection"
    ? countryCollection.features.filter(
        (country) => country.properties?.name !== "Antarctica",
      )
    : [countryCollection];

export type CountryBoundaryPath = {
  id: string;
  path: string;
};

function createCountryPaths(projection: GeoProjection): CountryBoundaryPath[] {
  const pathGenerator = geoPath(projection);

  return countryFeatures.flatMap((country, index) => {
    const path = pathGenerator(country);
    if (!path) return [];

    return [
      {
        id: `${String(country.id ?? country.properties?.name ?? "country")}-${index}`,
        path,
      },
    ];
  });
}

export function createOrthographicCountryPaths(
  longitudeOffset: number,
  latitudeOffset: number,
) {
  const projection = geoOrthographic()
    .rotate([longitudeOffset, -latitudeOffset])
    .translate([380, 215])
    .scale(164)
    .clipAngle(90);

  return createCountryPaths(projection);
}

export const equirectangularCountryPaths = createCountryPaths(
  geoEquirectangular()
    .translate([380, 190])
    .scale(760 / (2 * Math.PI)),
);