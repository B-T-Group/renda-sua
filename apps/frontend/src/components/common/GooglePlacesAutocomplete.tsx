import { TextField, TextFieldProps } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { GooglePlaceResult } from '../../utils/addressConverter';

interface GooglePlacesAutocompleteProps
  extends Omit<TextFieldProps, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: GooglePlaceResult) => void;
  placeholder?: string;
  apiKey?: string;
}

declare global {
  interface Window {
    google: any;
  }
}

const GooglePlacesAutocomplete: React.FC<GooglePlacesAutocompleteProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
  apiKey,
  ...textFieldProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if Google Maps API is fully loaded
  const isGoogleMapsReady = () => {
    return (
      window.google &&
      window.google.maps &&
      window.google.maps.places &&
      (window.google.maps.places.Autocomplete ||
        window.google.maps.places.PlaceAutocompleteElement)
    );
  };

  // Check if PlaceAutocompleteElement is available and working
  const isPlaceAutocompleteElementAvailable = () => {
    try {
      return (
        window.google?.maps?.places?.PlaceAutocompleteElement &&
        typeof window.google.maps.places.PlaceAutocompleteElement === 'function'
      );
    } catch (err) {
      return false;
    }
  };

  // Check if traditional Autocomplete is available
  const isTraditionalAutocompleteAvailable = () => {
    try {
      return (
        window.google?.maps?.places?.Autocomplete &&
        typeof window.google.maps.places.Autocomplete === 'function'
      );
    } catch (err) {
      return false;
    }
  };

  // Load Google Places API
  useEffect(() => {
    const loadGooglePlacesAPI = () => {
      if (isGoogleMapsReady()) {
        setIsLoaded(true);
        return;
      }

      // Check if API key is provided
      if (!apiKey) {
        setError('Google Maps API key is required for address autocomplete');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // Wait a bit for the API to fully initialize
        const checkReady = () => {
          if (isGoogleMapsReady()) {
            setIsLoaded(true);
            setIsLoading(false);
          } else {
            // Retry after a short delay
            retryTimeoutRef.current = setTimeout(checkReady, 100);
          }
        };
        checkReady();
      };
      script.onerror = () => {
        console.error('Failed to load Google Places API');
        setError(
          'Failed to load Google Places API. Please check your API key and internet connection.'
        );
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    if (apiKey) {
      loadGooglePlacesAPI();
    } else {
      setError('Google Maps API key is required for address autocomplete');
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [apiKey]);

  // Initialize Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Add a small delay to ensure API is fully initialized
    const initializeAutocomplete = () => {
      try {
        // Ensure API is fully loaded
        if (!isGoogleMapsReady()) {
          console.warn('Google Maps API not fully loaded, retrying...');
          retryTimeoutRef.current = setTimeout(initializeAutocomplete, 200);
          return;
        }

        // Try PlaceAutocompleteElement first, fall back to traditional Autocomplete
        if (isPlaceAutocompleteElementAvailable()) {
          try {
            // Use PlaceAutocompleteElement if available
            const placeAutocompleteElement =
              new window.google.maps.places.PlaceAutocompleteElement({
                types: ['address'],
              });

            // PlaceAutocompleteElement uses addEventListener instead of addListener
            placeAutocompleteElement.addEventListener('place_changed', () => {
              try {
                const place = placeAutocompleteElement.getPlace();

                if (place.formatted_address) {
                  onChange(place.formatted_address);
                }

                if (onPlaceSelect && place) {
                  onPlaceSelect(place);
                }
              } catch (err) {
                console.error('Error handling place selection:', err);
                setError('Error processing selected address');
              }
            });

            // Replace the input with the PlaceAutocompleteElement
            if (inputRef.current && inputRef.current.parentNode) {
              inputRef.current.parentNode.replaceChild(
                placeAutocompleteElement,
                inputRef.current
              );
            }

            autocompleteRef.current = placeAutocompleteElement;
            return; // Successfully initialized PlaceAutocompleteElement
          } catch (placeElementErr) {
            console.warn(
              'PlaceAutocompleteElement failed, falling back to traditional Autocomplete:',
              placeElementErr
            );
            // Fall through to traditional Autocomplete
          }
        }

        // Fall back to traditional Autocomplete
        if (isTraditionalAutocompleteAvailable()) {
          const autocomplete = new window.google.maps.places.Autocomplete(
            inputRef.current,
            {
              types: ['address'],
              fields: ['address_components', 'formatted_address', 'geometry'],
            }
          );

          autocomplete.addListener('place_changed', () => {
            try {
              const place = autocomplete.getPlace();

              if (place.formatted_address) {
                onChange(place.formatted_address);
              }

              if (onPlaceSelect && place) {
                onPlaceSelect(place);
              }
            } catch (err) {
              console.error('Error handling place selection:', err);
              setError('Error processing selected address');
            }
          });

          autocompleteRef.current = autocomplete;
        } else {
          throw new Error(
            'Neither PlaceAutocompleteElement nor Autocomplete is available'
          );
        }
      } catch (err) {
        console.error('Error initializing Google Places Autocomplete:', err);

        // Check if it's a network-related error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('jI')) {
          setError(
            'Google Places API network error. Please check your API key and internet connection.'
          );
        } else {
          setError(
            'Error initializing address autocomplete. Please try again later.'
          );
        }
      }
    };

    // Add a small delay to ensure API is fully initialized before first attempt
    setTimeout(initializeAutocomplete, 100);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (autocompleteRef.current) {
        try {
          // Handle cleanup for both PlaceAutocompleteElement and traditional Autocomplete
          if (autocompleteRef.current.removeEventListener) {
            // PlaceAutocompleteElement cleanup
            autocompleteRef.current.removeEventListener(
              'place_changed',
              () => {}
            );
          } else if (window.google?.maps?.event?.clearInstanceListeners) {
            // Traditional Autocomplete cleanup
            window.google.maps.event.clearInstanceListeners(
              autocompleteRef.current
            );
          }
        } catch (err) {
          console.error('Error cleaning up autocomplete:', err);
        }
      }
    };
  }, [isLoaded, onChange, onPlaceSelect]);

  // Show error state
  if (error) {
    return (
      <TextField
        {...textFieldProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        error={true}
        helperText={error}
        fullWidth
      />
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <TextField
        {...textFieldProps}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={true}
        helperText="Loading Google Places API..."
        fullWidth
      />
    );
  }

  return (
    <TextField
      {...textFieldProps}
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={!isLoaded}
      helperText={!isLoaded ? 'Loading Google Places API...' : ''}
      fullWidth
    />
  );
};

export default GooglePlacesAutocomplete;
