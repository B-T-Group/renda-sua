// Distance Matrix API Types
export interface DistanceMatrixResponse {
  destination_addresses: string[];
  origin_addresses: string[];
  rows: DistanceMatrixRow[];
  status: string;
}

export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

export interface DistanceMatrixElement {
  status: string; // e.g. "OK", "NOT_FOUND", "ZERO_RESULTS"
  duration?: DistanceMatrixValue;
  duration_in_traffic?: DistanceMatrixValue;
  distance?: DistanceMatrixValue;
  fare?: DistanceMatrixFare;
}

export interface DistanceMatrixValue {
  text: string; // e.g. "1 hour 3 mins"
  value: number; // in seconds (for duration) or meters (for distance)
}

export interface DistanceMatrixFare {
  currency: string; // e.g. "USD"
  value: number; // numeric value of fare
  text: string; // formatted fare string
}
