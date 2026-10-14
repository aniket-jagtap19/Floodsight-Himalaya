// Browser-only Leaflet module. Import only through ./index (lazy).
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  Popup,
  Rectangle,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { MAP } from "@/lib/map-palette";
import type { AreaPolygon, LatLng, RunResult, Village } from "@/lib/types";

export const BASEMAPS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: "© OpenStreetMap contributors © CARTO",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attr: "© OpenStreetMap contributors © CARTO",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Imagery",
  },
  terrain: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Hillshade",
  },
};
export type BasemapKey = keyof typeof BASEMAPS;

const toLL = (p: AreaPolygon) =>
  p.coordinates.map((r) => r.map(([lng, lat]) => [lat, lng] as LatLng));
const bboxBounds = (b: RunResult["bbox"]): L.LatLngBoundsExpression => [
  [b[1], b[0]],
  [b[3], b[2]],
];

const villageIcon = (cut: boolean, selected: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="fs-marker ${cut ? "fs-pulse" : ""}" style="width:18px;height:18px;border-radius:9999px"><div style="position:absolute;inset:3px;border-radius:9999px;background:${cut ? MAP.damage : MAP.safe};border:2px solid ${selected ? "#fff" : "rgba(15,20,30,.85)"};box-shadow:0 0 0 ${selected ? 3 : 0}px ${cut ? MAP.damage : MAP.safe}66"></div></div>`,
  });
const hospitalIcon = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:6px;background:${MAP.medical};display:grid;place-items:center;border:1.5px solid rgba(15,20,30,.8)"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M4.5 1h3v3.5H11v3H7.5V11h-3V7.5H1v-3h3.5z" fill="#fff"/></svg></div>`,
});
const townIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:4px;background:#3a4252;display:grid;place-items:center;border:1.5px solid rgba(255,255,255,.4)"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 9V4l3-2v2l3-2v7z" fill="#cfd5df"/></svg></div>`,
});
const bridgeIcon = (damaged: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:${damaged ? MAP.damage : "#5b6474"};display:grid;place-items:center;border:1.5px solid rgba(15,20,30,.85)"><svg width="12" height="10" viewBox="0 0 12 10"><path d="M0 6h12M2 6V9M10 6V9M0 6q6-7 12 0" stroke="#fff" stroke-width="1.4" fill="none"/></svg></div>`,
  });
const xIcon = L.divIcon({
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:rgba(15,20,30,.85);display:grid;place-items:center;border:2px solid ${MAP.damage}"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="${MAP.damage}" stroke-width="2.2"/></svg></div>`,
});

function FeaturePopup(p: {
  type: string;
  name: string;
  status: string;
  hit: boolean;
  confidence?: number | null | undefined;
  reason?: string | null | undefined;
  osmId?: string | undefined;
}) {
  return (
    <div className="min-w-52">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.type}</div>
      <div className="mt-0.5 text-sm font-semibold">{p.name}</div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${p.hit ? "bg-damage/15 text-damage" : "bg-safe/15 text-safe"}`}
        >
          {p.status}
        </span>
        <span className="num text-[11px] text-muted-foreground">
          {p.confidence != null
            ? `conf. ${Math.round(p.confidence * 100)}%`
            : "conf. Not available"}
        </span>
      </div>
      {p.reason && (
        <div className="mt-2 text-[12px]">
          <span className="text-muted-foreground">Why: </span>
          {p.reason}
        </div>
      )}
      {p.osmId && <div className="num mt-1 text-[10px] text-muted-foreground">OSM {p.osmId}</div>}
    </div>
  );
}

function ScaleAndCoords({ onMove }: { onMove: (ll: L.LatLng) => void }) {
  useMapEvents({ mousemove: (e) => onMove(e.latlng) });
  return <ScaleControl position="bottomleft" imperial={false} />;
}

function FlyTo({
  target,
}: {
  target: { bounds?: L.LatLngBoundsExpression; center?: LatLng; zoom?: number; key: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (target.bounds) map.flyToBounds(target.bounds, { padding: [40, 40], duration: 0.8 });
    else if (target.center) map.flyTo(target.center, target.zoom ?? 14, { duration: 0.8 });
  }, [target, map]);
  return null;
}

/** Clips a pane to the left `pct` of the visible map (before/after swipe). */
function SwipeClip({ pane, pct }: { pane: string; pct: number }) {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      const el = map.getPane(pane);
      if (!el) return;
      const size = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      const x = nw.x + size.x * pct;
      el.style.clipPath = `polygon(${nw.x}px ${nw.y}px, ${x}px ${nw.y}px, ${x}px ${se.y}px, ${nw.x}px ${se.y}px)`;
    };
    apply();
    map.on("move zoom resize zoomend", apply);
    return () => {
      map.off("move zoom resize zoomend", apply);
    };
  }, [map, pane, pct]);
  return null;
}

export interface LayerState {
  flood: { on: boolean; opacity: number };
  debris: { on: boolean; opacity: number };
  confidence: { on: boolean; opacity: number };
  radar: { on: boolean; opacity: number };
  buildings: { on: boolean; opacity: number };
  roads: { on: boolean; opacity: number };
  bridges: { on: boolean; opacity: number };
  villages: { on: boolean; opacity: number };
  facilities: { on: boolean; opacity: number };
  flow: { on: boolean; opacity: number };
  terrain: { on: boolean; opacity: number };
}

export interface DashboardMapProps {
  run: RunResult;
  layers: LayerState;
  basemap: BasemapKey;
  selectedVillage: Village | null;
  onSelectVillage: (id: string | null) => void;
  swipe: { on: boolean; pct: number };
  focus: { bounds?: L.LatLngBoundsExpression; center?: LatLng; zoom?: number; key: number } | null;
  onCoords: (ll: { lat: number; lng: number }) => void;
}

export function DashboardMap({
  run,
  layers,
  basemap,
  selectedVillage,
  onSelectVillage,
  swipe,
  focus,
  onCoords,
}: DashboardMapProps) {
  const bm = BASEMAPS[basemap];
  const [flashKey, setFlashKey] = useState(0);
  const prevRoads = useRef(layers.roads.on);
  useEffect(() => {
    if (layers.roads.on && !prevRoads.current) setFlashKey((k) => k + 1);
    prevRoads.current = layers.roads.on;
  }, [layers.roads.on]);

  const radarBounds: L.LatLngBoundsExpression = [
    [27.9, 85.12],
    [28.3, 85.42],
  ];

  return (
    <MapContainer
      bounds={bboxBounds(run.bbox)}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer key={basemap} url={bm.url} attribution={bm.attr} />
      {layers.terrain.on && basemap !== "terrain" && (
        <TileLayer
          url={BASEMAPS.terrain.url}
          opacity={0.35 * layers.terrain.opacity}
          attribution={BASEMAPS.terrain.attr}
        />
      )}
      <ScaleAndCoords onMove={(ll) => onCoords(ll)} />
      <FlyTo target={focus} />

      {/* Radar before/after */}
      <Pane name="radar-before" style={{ zIndex: 250 }}>
        {(layers.radar.on || swipe.on) && (
          <ImageOverlay
            url="/images/radar-before.png"
            bounds={radarBounds}
            opacity={layers.radar.opacity * 0.85}
          />
        )}
      </Pane>
      <Pane name="radar-after" style={{ zIndex: 260 }}>
        {(layers.radar.on || swipe.on) && (
          <ImageOverlay
            url="/images/radar-after.png"
            bounds={radarBounds}
            opacity={layers.radar.opacity * 0.85}
          />
        )}
      </Pane>
      {swipe.on && <SwipeClip pane="radar-before" pct={swipe.pct} />}
      {swipe.on && <SwipeClip pane="radar-after" pct={1} />}

      {layers.terrain.on &&
        run.radarShadowPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{
              color: MAP.shadow,
              weight: 1,
              dashArray: "3 4",
              fillColor: MAP.shadow,
              fillOpacity: 0.18 * layers.terrain.opacity,
            }}
          >
            <Tooltip sticky>Radar shadow / steep slope — masked as false positive</Tooltip>
          </Polygon>
        ))}

      {layers.flood.on &&
        run.floodPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{
              color: MAP.flood,
              weight: 1,
              fillColor: MAP.flood,
              fillOpacity: 0.5 * layers.flood.opacity,
              opacity: layers.flood.opacity,
            }}
          >
            <Popup>
              <FeaturePopup
                type="Flood water"
                name={`${p.id} (${p.type})`}
                status="Detected water"
                hit
                confidence={p.confidence}
                reason="Backscatter drop > 3 dB between same-track passes"
              />
            </Popup>
          </Polygon>
        ))}
      {layers.debris.on &&
        run.debrisPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{
              color: MAP.debris,
              weight: 1,
              fillColor: MAP.debris,
              fillOpacity: 0.35 * layers.debris.opacity,
              opacity: layers.debris.opacity,
            }}
          >
            <Popup>
              <FeaturePopup
                type="Debris / mud corridor"
                name={p.id}
                status="Debris deposit"
                hit
                confidence={p.confidence}
                reason="Backscatter increase + texture change along channel"
              />
            </Popup>
          </Polygon>
        ))}
      {layers.confidence.on &&
        run.confidence.lowConfidencePolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{
              color: "#e8ecf2",
              weight: 1.5,
              dashArray: "4 4",
              fillOpacity: 0.08 * layers.confidence.opacity,
              fillColor: "#e8ecf2",
            }}
          >
            <Tooltip sticky>Low confidence ({Math.round((p.confidence ?? 0) * 100)}%)</Tooltip>
          </Polygon>
        ))}

      {layers.flow.on && (
        <>
          <Polyline
            positions={run.flowPath.coordinates}
            pathOptions={{
              color: MAP.flood,
              weight: 3,
              dashArray: "8 12",
              className: "fs-flow",
              opacity: layers.flow.opacity,
            }}
          />
          <CircleMarker
            center={run.flowPath.upstream}
            radius={6}
            pathOptions={{ color: "#fff", fillColor: MAP.flood, fillOpacity: 1, weight: 2 }}
          >
            <Tooltip permanent direction="right" className="fs-label">
              Upstream point
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {layers.roads.on &&
        run.roads.map((r) => {
          const hit = r.status === "flooded";
          return (
            <Polyline
              key={`${r.id}-${hit ? flashKey : 0}`}
              positions={r.coordinates.map(([lng, lat]) => [lat, lng] as LatLng)}
              pathOptions={{
                color: hit ? MAP.damage : MAP.intact,
                weight: r.roadClass === "track" ? 2 : 3.5,
                opacity: layers.roads.opacity,
                className: hit ? "fs-flash" : undefined,
              }}
              eventHandlers={{
                mouseover: (e) => e.target.setStyle({ weight: 6 }),
                mouseout: (e) => e.target.setStyle({ weight: r.roadClass === "track" ? 2 : 3.5 }),
              }}
            >
              <Popup>
                <FeaturePopup
                  type={`Road · ${r.roadClass}`}
                  name={`${r.name} (${r.id})`}
                  status={hit ? "Likely hit" : "Not hit"}
                  hit={hit}
                  confidence={r.confidence}
                  reason={r.reason}
                  osmId={r.osmId}
                />
              </Popup>
            </Polyline>
          );
        })}

      {/* Selected village route */}
      {selectedVillage && (
        <>
          <Polyline
            positions={selectedVillage.route.coordinates}
            pathOptions={
              selectedVillage.status === "cut_off"
                ? { color: "#e8ecf2", weight: 4, opacity: 0.45, dashArray: "6 6" }
                : { color: MAP.safe, weight: 5, opacity: 0.95 }
            }
          />
          {selectedVillage.route.breakPoints.map((p, i) => (
            <Marker key={i} position={p} icon={xIcon}>
              <Tooltip>Broken segment {selectedVillage.route.brokenSegmentIds[i]}</Tooltip>
            </Marker>
          ))}
        </>
      )}

      {layers.buildings.on &&
        run.buildings.map((b) => {
          const hit = b.status === "likely_hit";
          return (
            <CircleMarker
              key={b.id}
              center={[b.lat, b.lon]}
              radius={3.5}
              pathOptions={{
                color: hit ? MAP.damage : MAP.intact,
                fillColor: hit ? MAP.damage : MAP.intact,
                fillOpacity: 0.9 * layers.buildings.opacity,
                weight: 1,
                opacity: layers.buildings.opacity,
              }}
            >
              <Popup>
                <FeaturePopup
                  type={`Building · ${b.category}`}
                  name={b.name}
                  status={hit ? "Likely hit" : "Not hit"}
                  hit={hit}
                  confidence={b.confidence}
                  reason={b.reason}
                  osmId={b.osmId}
                />
              </Popup>
            </CircleMarker>
          );
        })}

      {layers.bridges.on &&
        run.bridges.map((b) => (
          <Marker
            key={b.id}
            position={[b.lat, b.lon]}
            icon={bridgeIcon(b.status === "damaged")}
            opacity={layers.bridges.opacity}
          >
            <Popup>
              <FeaturePopup
                type="Bridge"
                name={`${b.name} (${b.id})`}
                status={b.status === "damaged" ? "Likely hit" : "Not hit"}
                hit={b.status === "damaged"}
                confidence={b.confidence}
                reason={b.reason}
                osmId={b.osmId}
              />
            </Popup>
          </Marker>
        ))}

      {layers.facilities.on && (
        <>
          {run.towns.map((t) => (
            <Marker key={t.id} position={[t.lat, t.lon]} icon={townIcon}>
              <Tooltip>{t.name}</Tooltip>
            </Marker>
          ))}
          {run.hospitals.map((h) => (
            <Marker key={h.id} position={[h.lat, h.lon]} icon={hospitalIcon} zIndexOffset={500}>
              <Tooltip direction="top">{h.name}</Tooltip>
            </Marker>
          ))}
        </>
      )}

      {layers.villages.on &&
        run.villages.map((v) => (
          <Marker
            key={v.id + (selectedVillage?.id === v.id ? "-s" : "")}
            position={[v.lat, v.lon]}
            icon={villageIcon(v.status === "cut_off", selectedVillage?.id === v.id)}
            zIndexOffset={1000}
            eventHandlers={{ click: () => onSelectVillage(v.id) }}
          >
            <Tooltip permanent direction="right" offset={[10, 0]} className="fs-label">
              {v.name}
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}

// ---------------- Bounding-box picker ----------------

function BoxDrawer({
  drawing,
  onBox,
}: {
  drawing: boolean;
  onBox: (b: [number, number, number, number]) => void;
}) {
  const map = useMap();
  const start = useRef<L.LatLng | null>(null);
  const [temp, setTemp] = useState<L.LatLngBounds | null>(null);
  useEffect(() => {
    if (drawing) map.dragging.disable();
    else map.dragging.enable();
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
  }, [drawing, map]);
  useMapEvents({
    mousedown: (e) => {
      if (drawing) {
        start.current = e.latlng;
        setTemp(null);
      }
    },
    mousemove: (e) => {
      if (drawing && start.current) setTemp(L.latLngBounds(start.current, e.latlng));
    },
    mouseup: (e) => {
      if (drawing && start.current) {
        const b = L.latLngBounds(start.current, e.latlng);
        start.current = null;
        setTemp(null);
        onBox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      }
    },
  });
  return temp ? (
    <Rectangle bounds={temp} pathOptions={{ color: MAP.flood, dashArray: "4 4", weight: 1.5 }} />
  ) : null;
}

export function BboxMap({
  bbox,
  drawing,
  onBox,
  dark,
}: {
  bbox: [number, number, number, number] | null;
  drawing: boolean;
  onBox: (b: [number, number, number, number]) => void;
  dark: boolean;
}) {
  const bm = dark ? BASEMAPS.dark : BASEMAPS.light;
  const focus = useMemo(
    () => (bbox ? { bounds: bboxBounds(bbox), key: bbox.join(",").length + bbox[0] } : null),
    [bbox],
  );
  return (
    <MapContainer center={[28.1, 85.3]} zoom={10} className="h-full w-full" zoomControl>
      <TileLayer url={bm.url} attribution={bm.attr} />
      <TileLayer url={BASEMAPS.terrain.url} opacity={0.25} />
      <BoxDrawer drawing={drawing} onBox={onBox} />
      {bbox && (
        <Rectangle
          bounds={bboxBounds(bbox)}
          pathOptions={{ color: MAP.flood, weight: 2, fillOpacity: 0.08 }}
        />
      )}
      <FlyTo target={focus} />
      <ScaleControl position="bottomleft" imperial={false} />
    </MapContainer>
  );
}

// ---------------- Static mini map (copilot / report) ----------------

export function MiniMap({
  run,
  villageIds,
  dark,
  height = 180,
}: {
  run: RunResult;
  villageIds?: string[];
  dark: boolean;
  height?: number;
}) {
  const bm = dark ? BASEMAPS.dark : BASEMAPS.light;
  const vs = villageIds ? run.villages.filter((v) => villageIds.includes(v.id)) : run.villages;
  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border">
      <MapContainer
        bounds={bboxBounds(run.bbox)}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
        keyboard={false}
      >
        <TileLayer url={bm.url} />
        {run.floodPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{ color: MAP.flood, weight: 1, fillOpacity: 0.55 }}
          />
        ))}
        {run.debrisPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{ color: MAP.debris, weight: 0.5, fillOpacity: 0.35 }}
          />
        ))}
        {run.roads
          .filter((r) => r.status === "flooded")
          .map((r) => (
            <Polyline
              key={r.id}
              positions={r.coordinates.map(([a, b]) => [b, a] as LatLng)}
              pathOptions={{ color: MAP.damage, weight: 2.5 }}
            />
          ))}
        {vs.map((v) => (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lon]}
            radius={4}
            pathOptions={{
              color: "#111",
              weight: 1,
              fillColor: v.status === "cut_off" ? MAP.damage : MAP.safe,
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="right" className="fs-label">
              {v.name}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

// ---------------- Validation map ----------------

export function ValidationMap({
  run,
  mode,
  dark,
}: {
  run: RunResult;
  mode: "ours" | "reference" | "agreement";
  dark: boolean;
}) {
  const bm = dark ? BASEMAPS.dark : BASEMAPS.light;
  const ref = run.validation?.referencePolygons ?? [];
  return (
    <MapContainer bounds={bboxBounds(run.bbox)} className="h-full w-full" zoomControl={false}>
      <TileLayer url={bm.url} attribution={bm.attr} />
      {mode === "agreement" && (
        <>
          {ref.map((p) => (
            <Polygon
              key={p.id}
              positions={toLL(p)}
              pathOptions={{ color: MAP.fn, weight: 0, fillColor: MAP.fn, fillOpacity: 0.65 }}
            />
          ))}
          {run.floodPolygons.map((p) => (
            <Polygon
              key={p.id}
              positions={toLL(p)}
              pathOptions={{
                color: p.type === "main" ? MAP.tp : MAP.fp,
                weight: 0,
                fillColor: p.type === "main" ? MAP.tp : MAP.fp,
                fillOpacity: 0.8,
              }}
            />
          ))}
        </>
      )}
      {mode === "ours" &&
        run.floodPolygons.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{ color: MAP.flood, weight: 1, fillOpacity: 0.55 }}
          />
        ))}
      {mode === "reference" &&
        ref.map((p) => (
          <Polygon
            key={p.id}
            positions={toLL(p)}
            pathOptions={{ color: MAP.reference, weight: 1, fillOpacity: 0.5 }}
          />
        ))}
    </MapContainer>
  );
}
