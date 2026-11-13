import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { LAGOS_CENTER, RIDER_PROGRESS, coordsFor, nudge, pointBetween } from "@/lib/geo";

const STATUS_COLOR = {
  placed: "#A95400",
  accepted: "#2E3A9E",
  preparing: "#B05C00",
  ready_for_pickup: "#1F7A4C",
  rider_assigned: "#4B2080",
  picked_up: "#FF7A00",
};

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    else if (bounds.length === 1) map.setView(bounds[0], 13);
  }, [map, bounds]);
  return null;
}

export default function DeliveryFleetMap({ deliveries }) {
  const routes = useMemo(
    () =>
      deliveries.map((delivery) => {
        const store = nudge(coordsFor(delivery.address_area === delivery.store_name ? "" : delivery.store_name), delivery.store_id || delivery.code);
        const customer = nudge(coordsFor(delivery.address_area), delivery.address_area || delivery.code);
        const ratio = RIDER_PROGRESS[delivery.status] ?? 0;
        const rider = pointBetween(store, customer, ratio);
        return { ...delivery, store, customer, rider, color: STATUS_COLOR[delivery.status] ?? "#4B2080" };
      }),
    [deliveries]
  );

  const bounds = routes.flatMap((route) => [route.store, route.customer]);
  const center = routes[0]?.store ?? LAGOS_CENTER;

  return (
    <div className="h-[380px] overflow-hidden rounded-2xl ring-1 ring-[#EFE7F6] md:h-[460px]">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        {routes.map((route) => (
          <Fragment key={route.id}>
            <Polyline positions={[route.store, route.customer]} pathOptions={{ color: route.color, weight: 2, dashArray: "5 7", opacity: 0.6 }} />
            <CircleMarker center={route.store} radius={6} pathOptions={{ color: "#1F7A4C", fillColor: "#1F7A4C", fillOpacity: 1 }}>
              <Tooltip direction="top">{route.store_name}</Tooltip>
            </CircleMarker>
            <CircleMarker center={route.customer} radius={6} pathOptions={{ color: "#2B0B4D", fillColor: "#2B0B4D", fillOpacity: 1 }}>
              <Tooltip direction="top">{route.address_area || "Drop-off"}</Tooltip>
            </CircleMarker>
            <CircleMarker center={route.rider} radius={8} pathOptions={{ color: route.color, fillColor: route.color, fillOpacity: 0.95 }}>
              <Popup>
                <strong>{route.code}</strong>
                <br />
                {route.store_name} → {route.address_area || "customer"}
                <br />
                {route.rider_name ? `Rider · ${route.rider_name}` : "Awaiting a rider"}
              </Popup>
            </CircleMarker>
          </Fragment>
        ))}
      </MapContainer>
    </div>
  );
}