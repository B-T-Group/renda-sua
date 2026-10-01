import { Box } from '@mui/material';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import React, { useEffect, useRef } from 'react';
import { environment } from '../../../config/environment';
import { markerContent } from './adminMapMarker';
import { AdminMapPin, FOCUS_ZOOM, LABEL_ZOOM } from './adminMap.types';

interface AdminMapCanvasProps {
  pins: AdminMapPin[];
  filterKey: string;
  ready: boolean;
  zoom: number;
  activityLabel: (pin: AdminMapPin) => string;
  onZoom: (zoom: number) => void;
  onSelect: (pin: AdminMapPin) => void;
  focusPin: AdminMapPin | null;
  focusToken: number;
}

const AdminMapCanvas: React.FC<AdminMapCanvasProps> = (props) => (
  <APIProvider apiKey={environment.googleMapsBrowserApiKey} libraries={['marker']}>
    <Box sx={{ flex: 1, minHeight: 480 }}>
      <Map
        mapId={environment.googleMapId || 'DEMO_MAP_ID'}
        defaultCenter={{ lat: 4.05, lng: 9.7 }}
        defaultZoom={6}
        gestureHandling="greedy"
        style={{ width: '100%', height: '100%' }}
        onCameraChanged={(event) => props.onZoom(Math.round(event.detail.zoom))}
      >
        <FitPins
          pins={props.pins}
          filterKey={props.filterKey}
          ready={props.ready}
          focusToken={props.focusToken}
        />
        <FocusPin pin={props.focusPin} token={props.focusToken} />
        <PinLayer
          pins={withFocus(props.pins, props.focusPin)}
          showLabels={props.zoom >= LABEL_ZOOM}
          activityLabel={props.activityLabel}
          onSelect={props.onSelect}
        />
      </Map>
    </Box>
  </APIProvider>
);

function FitPins({
  pins,
  filterKey,
  ready,
  focusToken,
}: {
  pins: AdminMapPin[];
  filterKey: string;
  ready: boolean;
  focusToken: number;
}) {
  const map = useMap();
  const fitted = useRef('');
  useEffect(() => {
    if (!map || !ready || !pins.length || fitted.current === filterKey) return;
    fitted.current = filterKey;
    if (focusToken !== 0) return;
    framePins(map, pins);
  }, [map, pins, filterKey, ready, focusToken]);
  return null;
}

function FocusPin({ pin, token }: { pin: AdminMapPin | null; token: number }) {
  const map = useMap();
  const seen = useRef(0);
  useEffect(() => {
    if (!map || !pin || token === 0 || seen.current === token) return;
    seen.current = token;
    map.setCenter({ lat: pin.latitude, lng: pin.longitude });
    map.setZoom(FOCUS_ZOOM);
  }, [map, pin, token]);
  return null;
}

function withFocus(pins: AdminMapPin[], focus: AdminMapPin | null): AdminMapPin[] {
  if (!focus || pins.some((pin) => pin.id === focus.id)) return pins;
  return [...pins, focus];
}

function framePins(map: google.maps.Map, pins: AdminMapPin[]) {
  if (pins.length === 1) {
    map.setCenter({ lat: pins[0].latitude, lng: pins[0].longitude });
    map.setZoom(14);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  pins.forEach((pin) => bounds.extend({ lat: pin.latitude, lng: pin.longitude }));
  map.fitBounds(bounds, 48);
}

function PinLayer({
  pins,
  showLabels,
  activityLabel,
  onSelect,
}: {
  pins: AdminMapPin[];
  showLabels: boolean;
  activityLabel: (pin: AdminMapPin) => string;
  onSelect: (pin: AdminMapPin) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return undefined;
    return mountPins(map, pins, showLabels, activityLabel, onSelect);
  }, [map, pins, showLabels, activityLabel, onSelect]);
  return null;
}

function mountPins(
  map: google.maps.Map,
  pins: AdminMapPin[],
  showLabels: boolean,
  activityLabel: (pin: AdminMapPin) => string,
  onSelect: (pin: AdminMapPin) => void
) {
  const markers = pins.map((pin) => buildMarker(pin, showLabels, activityLabel(pin), onSelect));
  const clusterer = new MarkerClusterer({ map, markers });
  return () => {
    clusterer.clearMarkers();
    markers.forEach((marker) => {
      marker.map = null;
    });
  };
}

function buildMarker(
  pin: AdminMapPin,
  showLabels: boolean,
  label: string,
  onSelect: (pin: AdminMapPin) => void
) {
  const marker = new google.maps.marker.AdvancedMarkerElement({
    position: { lat: pin.latitude, lng: pin.longitude },
    content: markerContent(pin, showLabels, label),
    title: pin.title,
  });
  marker.addListener('click', () => onSelect(pin));
  return marker;
}

export default AdminMapCanvas;
