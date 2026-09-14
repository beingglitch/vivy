'use client';

import { useEffect, useRef, useState } from 'react';
import { RADII } from '@/lib/task-scales';

export interface PickedPlace {
  label: string;
  lat: number;
  lng: number;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

interface GoogleListener {
  remove(): void;
}

interface GoogleMap {
  getCenter(): GoogleLatLng | null;
  setCenter(position: Coordinates): void;
  setZoom(zoom: number): void;
  addListener(eventName: string, handler: () => void): GoogleListener;
}

interface GoogleMapsApi {
  Map: new (
    element: HTMLElement,
    options: {
      center: Coordinates;
      zoom: number;
      mapTypeControl: boolean;
      streetViewControl: boolean;
      fullscreenControl: boolean;
    },
  ) => GoogleMap;
  Geocoder: new () => {
    geocode(request: { address: string }): Promise<{
      results: Array<{ formatted_address: string; geometry: { location: GoogleLatLng } }>;
    }>;
  };
}

interface MapsWindow extends Window {
  google?: { maps: GoogleMapsApi };
  __vivyGoogleMapsReady?: () => void;
}

const INDIA: Coordinates = { lat: 20.5937, lng: 78.9629 };
let mapsPromise: Promise<GoogleMapsApi> | null = null;

function currentLocation(): Promise<Coordinates | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  });
}

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  const mapsWindow = window as MapsWindow;
  if (mapsWindow.google?.maps.Map) return Promise.resolve(mapsWindow.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    mapsWindow.__vivyGoogleMapsReady = () => {
      const maps = mapsWindow.google?.maps;
      if (maps) resolve(maps);
      else reject(new Error('Google Maps did not initialise.'));
    };

    const script = document.createElement('script');
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&loading=async&libraries=maps,geocoding&v=weekly&callback=__vivyGoogleMapsReady';
    script.async = true;
    script.onerror = () => reject(new Error('Could not load Google Maps.'));
    document.head.append(script);
  });

  return mapsPromise;
}

export function LocationPicker({
  apiKey,
  value,
  radius,
  onChoose,
  onClose,
}: {
  apiKey: string;
  value: PickedPlace | null;
  radius: number;
  onChoose: (place: PickedPlace, radius: number) => void;
  onClose: () => void;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<GoogleMap | null>(null);
  const geocoder = useRef<InstanceType<GoogleMapsApi['Geocoder']> | null>(null);
  const label = useRef(value?.label ?? 'Pinned location');
  const [picked, setPicked] = useState<PickedPlace | null>(value);
  const [selectedRadius, setSelectedRadius] = useState(radius);
  const [customRadius, setCustomRadius] = useState(
    !RADII.some((option) => option.value === radius),
  );
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey || !mapElement.current) return;
    let active = true;
    let idleListener: GoogleListener | null = null;
    let dragListener: GoogleListener | null = null;

    void Promise.all([loadGoogleMaps(apiKey), value ? Promise.resolve(null) : currentLocation()])
      .then(([maps, deviceLocation]) => {
        if (!active || !mapElement.current) return;
        const center = value ?? deviceLocation ?? INDIA;
        label.current = value?.label ?? (deviceLocation ? 'Current location' : 'Pinned location');
        setPicked({
          label: label.current,
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
        });
        const instance = new maps.Map(mapElement.current, {
          center,
          zoom: deviceLocation || value ? 15 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        map.current = instance;
        geocoder.current = new maps.Geocoder();

        dragListener = instance.addListener('dragstart', () => {
          label.current = 'Pinned location';
        });
        idleListener = instance.addListener('idle', () => {
          const point = instance.getCenter();
          if (!point) return;
          setPicked({
            label: label.current,
            lat: Number(point.lat().toFixed(6)),
            lng: Number(point.lng().toFixed(6)),
          });
        });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Could not load Google Maps.');
      });

    return () => {
      active = false;
      idleListener?.remove();
      dragListener?.remove();
    };
  }, [apiKey, value]);

  async function search() {
    const address = query.trim();
    if (!address || !geocoder.current || !map.current) return;
    setSearching(true);
    setError(null);
    try {
      const result = await geocoder.current.geocode({ address });
      const match = result.results[0];
      if (!match) throw new Error('No place found.');
      label.current = match.formatted_address;
      map.current.setCenter({
        lat: match.geometry.location.lat(),
        lng: match.geometry.location.lng(),
      });
      map.current.setZoom(17);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not find that place.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="map-picker" role="dialog" aria-modal="true" aria-label="Choose a place">
      <div className="map-picker__header">
        <div>
          <strong>Choose a place</strong>
          <span>Move the map until the pin is in the right spot.</span>
        </div>
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Close
        </button>
      </div>

      {apiKey ? (
        <>
          <form
            className="map-picker__search"
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
          >
            <input
              className="field__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Google Maps"
              aria-label="Search Google Maps"
            />
            <button className="btn btn--primary" disabled={searching || !query.trim()}>
              {searching ? 'Finding…' : 'Search'}
            </button>
          </form>
          <div className="map-picker__canvasWrap">
            <div ref={mapElement} className="map-picker__canvas" />
            <div className="map-picker__pin" aria-hidden>
              <i />
            </div>
          </div>
        </>
      ) : (
        <div className="map-picker__missing">
          Add <code>GOOGLE_MAPS_API_KEY</code> to enable map search and selection.
        </div>
      )}

      <span className="field__label">Alert radius</span>
      <div className="chips">
        {RADII.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`chip${!customRadius && selectedRadius === option.value ? ' chip--on' : ''}`}
            onClick={() => {
              setSelectedRadius(option.value);
              setCustomRadius(false);
            }}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className={`chip${customRadius ? ' chip--on' : ''}`}
          onClick={() => setCustomRadius(true)}
        >
          Custom
        </button>
      </div>
      {customRadius ? (
        <label className="map-picker__custom-radius">
          <input
            className="field__input"
            type="number"
            inputMode="numeric"
            min={25}
            max={50_000}
            step={25}
            value={selectedRadius}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) setSelectedRadius(value);
            }}
            onBlur={() => setSelectedRadius((current) => Math.min(50_000, Math.max(25, current)))}
            aria-label="Custom alert radius in metres"
          />
          <span>metres</span>
        </label>
      ) : null}

      {picked ? (
        <p className="map-picker__coords">
          {picked.label} · {picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
        </p>
      ) : null}
      {error ? <p className="pair__error">{error}</p> : null}

      <button
        type="button"
        className="btn btn--primary map-picker__choose"
        disabled={!picked || selectedRadius < 25 || selectedRadius > 50_000}
        onClick={() => picked && onChoose(picked, selectedRadius)}
      >
        Use this place
      </button>
    </div>
  );
}
