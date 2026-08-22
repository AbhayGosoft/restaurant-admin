import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed } from "lucide-react";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

// MapContainer only reads center/zoom once on mount, but the saved lat/lng
// usually arrives a tick later (async form reset), so re-center once when it shows up.
function RecenterOnceOnLoad({ hasPosition, center }: { hasPosition: boolean; center: [number, number] }) {
  const map = useMap();
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!hasPosition || hasCentered.current) return;
    hasCentered.current = true;
    map.setView(center, 16);
  }, [hasPosition, center, map]);

  return null;
}

export function MapPicker({ latitude, longitude, onChange }: { latitude?: number; longitude?: number; onChange: (lat: number, lng: number) => void }) {
  const hasPosition = typeof latitude === "number" && typeof longitude === "number" && !Number.isNaN(latitude) && !Number.isNaN(longitude);
  const center: [number, number] = hasPosition ? [latitude, longitude] : INDIA_CENTER;

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => onChange(position.coords.latitude, position.coords.longitude));
  };

  return (
    <div className="map-picker">
      <MapContainer center={center} zoom={hasPosition ? 16 : 5} scrollWheelZoom className="map-picker__map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onPick={onChange} />
        <RecenterOnceOnLoad hasPosition={hasPosition} center={center} />
        {hasPosition && (
          <Marker
            position={center}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const position = (event.target as L.Marker).getLatLng();
                onChange(position.lat, position.lng);
              },
            }}
          />
        )}
      </MapContainer>
      <div className="map-picker__footer">
        <p className="map-picker__hint">Tap the map to drop a pin, or drag the marker to fine-tune the location.</p>
        <button type="button" className="map-picker__locate" onClick={useMyLocation}><LocateFixed size={14} /> Use my location</button>
      </div>
      {hasPosition && (
        <p className="map-picker__coords">{latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
      )}
    </div>
  );
}
