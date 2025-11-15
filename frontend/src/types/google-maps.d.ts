// Declare google maps on window
declare global {
  interface Window {
    google: {
      maps: typeof google.maps;
    };
  }
}

// Add visualization library types
declare namespace google.maps.visualization {
  class HeatmapLayer {
    constructor(opts?: HeatmapLayerOptions);
    getData(): MVCArray<LatLng | WeightedLocation>;
    getMap(): google.maps.Map | null;
    setData(data: MVCArray<LatLng | WeightedLocation> | Array<LatLng | WeightedLocation>): void;
    setMap(map: google.maps.Map | null): void;
    setOptions(options: HeatmapLayerOptions): void;
  }

  interface HeatmapLayerOptions {
    data: MVCArray<LatLng | WeightedLocation> | Array<LatLng | WeightedLocation>;
    dissipating?: boolean;
    gradient?: string[];
    map?: google.maps.Map | null;
    maxIntensity?: number;
    opacity?: number;
    radius?: number;
  }

  interface WeightedLocation {
    location: google.maps.LatLng;
    weight: number;
  }
}

export {};
