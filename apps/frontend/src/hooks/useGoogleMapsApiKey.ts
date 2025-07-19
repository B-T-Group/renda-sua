export const useGoogleMapsApiKey = (): string | undefined => {
  // Get API key from environment variables
  const apiKey = 'AIzaSyDpI80RcSNpjLNybedvZ62QFyV4485tiyI';

  // Log warning if API key is not set
  if (!apiKey) {
    console.warn(
      'Google Maps API key not found. Please set REACT_APP_GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY environment variable.'
    );
  }

  return apiKey;
};
