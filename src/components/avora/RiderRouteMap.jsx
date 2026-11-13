import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { pointBetween } from "@/lib/geo";

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, bounds]);
  return null;
}

export default function RiderRouteMap({ storePoint, customerPoint, riderRatio = 0, storeName, customerLabel }) {
  const rider = pointBetween(storePoint, customerPoint, riderRatio);
  const bounds = [storePoint, customerPoint];
  const remaining = Math.max(0, Math.round((1 - riderRatio) * 100));

  return (
    <div className="h-[300px] overflow-hidden rounded-2xl ring-1 ring-[#EFE7F6] md:h-[360px]">
      <MapContainer center={storePoint} zoom={13} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <Polyline positions={[storePoint, customerPoint]} pathOptions={{ color: "#4B2080", weight: 4, dashArray: "6 8" }} />
        <Polyline positions={[storePoint, rider]} pathOptions={{ color: "#FF7A00", weight: 5 }} />
        <CircleMarker center={storePoint} radius={9} pathOptions={{ color: "#1F7A4C", fillColor: "#1F7A4C", fillOpacity: 1 }}>
          <Tooltip direction="top">Pickup · {storeName}</Tooltip>
        </CircleMarker>
        <CircleMarker center={customerPoint} radius={9} pathOptions={{ color: "#2B0B4D", fillColor: "#2B0B4D", fillOpacity: 1 }}>
          <Tooltip direction="top">{customerLabel}</Tooltip>
        </CircleMarker>
        <CircleMarker center={rider} radius={7} pathOptions={{ color: "#FF7A00", fillColor: "#FF7A00", fillOpacity: 1 }}>
          <Popup>
            Rider · {remaining}% of the trip left
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}