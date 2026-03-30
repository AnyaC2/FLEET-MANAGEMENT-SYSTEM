export type LocationSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return [];
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', trimmedQuery);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to search locations');
  }

  const results = (await response.json()) as NominatimResult[];

  return results.map((result) => ({
    label: result.display_name,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  }));
}

export async function calculateRouteDistanceKm(
  origin: LocationSuggestion,
  destination: LocationSuggestion,
  signal?: AbortSignal
): Promise<number> {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${coordinates}`);
  url.searchParams.set('overview', 'false');

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to calculate route distance');
  }

  const data = await response.json() as {
    routes?: Array<{ distance?: number }>;
  };

  const meters = data.routes?.[0]?.distance;
  if (!meters || meters <= 0) {
    throw new Error('No route distance returned');
  }

  return Number((meters / 1000).toFixed(1));
}
