import { useEffect, useRef } from 'react';

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-places]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Google Maps script failed')),
        { once: true }
      );
      return;
    }
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.dataset.googleMapsPlaces = 'true';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Google Maps script failed'));
    document.head.appendChild(s);
  });
  return mapsScriptPromise;
}

export interface UseGooglePlacesAutocompleteOptions {
  apiKey: string | undefined;
  /** ISO 3166-1 alpha-2, e.g. CM — limits predictions when set */
  countryRestriction?: string | null;
  enabled?: boolean;
  onPlaceSelected: (place: google.maps.places.PlaceResult) => void;
  onLoadError?: (message: string) => void;
}

/**
 * Attaches `google.maps.places.Autocomplete` to a text input element.
 * Pass the real DOM node (e.g. from `inputRef` callback) so Dialogs re-bind when the input mounts.
 */
export function useGooglePlacesAutocomplete(
  inputEl: HTMLInputElement | null,
  {
    apiKey,
    countryRestriction,
    enabled = true,
    onPlaceSelected,
    onLoadError,
  }: UseGooglePlacesAutocompleteOptions
): void {
  const onSelectRef = useRef(onPlaceSelected);
  onSelectRef.current = onPlaceSelected;
  const onErrRef = useRef(onLoadError);
  onErrRef.current = onLoadError;

  useEffect(() => {
    if (!enabled || !apiKey || !inputEl) return;

    let cancelled = false;
    let autocomplete: google.maps.places.Autocomplete | null = null;

    const run = async () => {
      try {
        await loadGoogleMapsPlaces(apiKey);
        if (cancelled) return;
        const cc = countryRestriction?.trim();
        const ac = new google.maps.places.Autocomplete(inputEl, {
          fields: ['address_components', 'geometry', 'formatted_address'],
          types: ['address'],
          ...(cc
            ? {
                componentRestrictions: {
                  country: cc.toLowerCase(),
                },
              }
            : {}),
        });
        autocomplete = ac;
        ac.addListener('place_changed', () => {
          const place = ac.getPlace();
          if (place?.address_components?.length) {
            onSelectRef.current(place);
          }
        });
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Google Places failed to load';
        onErrRef.current?.(msg);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (autocomplete) {
        google.maps.event.clearInstanceListeners(autocomplete);
        autocomplete = null;
      }
    };
  }, [enabled, apiKey, countryRestriction, inputEl]);
}
