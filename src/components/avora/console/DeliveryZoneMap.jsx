import { useEffect } from "react";
import { Circle, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function ClickCatcher({ onPick }) {
  useMapEvents({
    click: (event) => onPick([event.latlng.lat, event.latlng.lng]),
  });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center[0], center[1], map]);
  return null;
}

export default function DeliveryZoneMap({ center, radiusKm = 3, zones = [], onPick }) {
  return (
    <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-[#EFE7F6]">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher onPick={onPick} />
        <Recenter center={center} />
        {zones.map((zone) => (
          <Circle
            key={zone.id}
            center={[zone.center_lat ?? 6.5095, zone.center_lng ?? 3.3711]}
            radius={Math.max(1, zone.radius_km || 1) * 1000}
            pathOptions={{
              color: zone.is_active ? "#1F7A4C" : "#A797B4",
              weight: 2,
              fillOpacity: 0.1,
            }}
          />
        ))}
        <Circle
          center={center}
          radius={Math.max(1, radiusKm) * 1000}
          pathOptions={{ color: "#FF7A00", fillColor: "#FF7A00", fillOpacity: 0.16, weight: 3 }}
        />
      </MapContainer>
    </div>
  );
}