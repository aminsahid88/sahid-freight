"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import api from "@/lib/api";
import { Socket } from "socket.io-client";
import { connectAuthedSocket } from "@/lib/socket";
import { formatApiError } from "@/lib/errors";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://sahid-freight-production.up.railway.app").replace("/api", "");

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function TrackingPage() {
  const router = useRouter();
  const { bookingId } = useParams();
  const { user } = useAuthStore();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; timestamp?: string } | null>(null);
  const [status, setStatus] = useState("Waiting for a location update…");
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const watchRef = useRef<number | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pathRef = useRef<any>(null);
  const pathPointsRef = useRef<{lat: number; lng: number}[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchBooking();
    return () => {
      stopSharing();
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchBooking = async () => {
    try {
      const res = await api.get("/bookings/" + bookingId);
      setBooking(res.data.booking);
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't find this booking. It may have been cancelled or removed.", "booking"));
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (loading || mapInitialized.current || !mapContainerRef.current) return;
    mapInitialized.current = true;
    loadGoogleMaps();
  }, [loading]);

  const loadGoogleMaps = () => {
    if (window.google) {
      initializeMap();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&callback=initMap`;
    script.async = true;
    script.defer = true;
    window.initMap = initializeMap;
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapContainerRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: 9.0320, lng: 38.7469 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#0A1F44" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#F8FAFC" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#0A1F44" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#13316B" }] },
        { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0A1F44" }] },
        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3D7BFF" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A1F44" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    });
    mapRef.current = map;

    // Draw route if we have pickup and delivery coords
    if (booking?.load?.pickupLat && booking?.load?.deliveryLat) {
      const directionsService = new window.google.maps.DirectionsService();
      const directionsRenderer = new window.google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#3D7BFF", strokeWeight: 4, strokeOpacity: 0.6 },
      });

      directionsService.route({
        origin: { lat: booking.load.pickupLat, lng: booking.load.pickupLng },
        destination: { lat: booking.load.deliveryLat, lng: booking.load.deliveryLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result: any, status: any) => {
        if (status === "OK") directionsRenderer.setDirections(result);
      });

      // Pickup marker
      new window.google.maps.Marker({
        position: { lat: booking.load.pickupLat, lng: booking.load.pickupLng },
        map,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#16A34A", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        title: "Pickup: " + booking.load.pickupCity,
      });

      // Delivery marker
      new window.google.maps.Marker({
        position: { lat: booking.load.deliveryLat, lng: booking.load.deliveryLng },
        map,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#f87171", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 },
        title: "Delivery: " + booking.load.deliveryCity,
      });
    }

    // Truck path line
    pathRef.current = new window.google.maps.Polyline({
      map,
      path: [],
      strokeColor: "#3D7BFF",
      strokeWeight: 3,
      strokeOpacity: 1,
    });

    // Connect socket (JWT attached; refreshes once on auth failure)
    const socket = connectAuthedSocket();
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("join_tracking", bookingId));
    socket.on("tracking_error", (e: any) => setError(e?.message || "We lost the live tracking connection. Please refresh."));

    socket.on("location_updated", (data: any) => {
      setLocation(data);
      setStatus("Live · updated " + new Date(data.timestamp).toLocaleTimeString());

      const pos = { lat: data.lat, lng: data.lng };
      pathPointsRef.current.push(pos);
      pathRef.current?.setPath(pathPointsRef.current);

      if (markerRef.current) {
        markerRef.current.setPosition(pos);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: pos,
          map,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="22" fill="#3D7BFF" stroke="white" stroke-width="3"/>
                <path d="M10 20h18v12H10z" fill="white"/>
                <path d="M28 23h6l4 4v5h-10z" fill="white"/>
                <circle cx="16" cy="33" r="3" fill="#3D7BFF"/>
                <circle cx="32" cy="33" r="3" fill="#3D7BFF"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(48, 48),
            anchor: new window.google.maps.Point(24, 24),
          },
          title: "Truck location",
        });
      }
      map.panTo(pos);
    });

    socket.on("tracking_stopped", () => {
      setStatus("Location sharing paused.");
      setIsSharing(false);
    });

    socket.on("journey_started", () => {
      setStatus("Journey started — waiting for the first location update…");
      fetchBooking();
    });

    socket.on("delivered", () => {
      setStatus("Load delivered.");
      fetchBooking();
    });
  };

  const startSharing = () => {
    if (!navigator.geolocation) { setError("This device doesn't support GPS location sharing."); return; }
    setIsSharing(true);
    setStatus("Sharing your live location…");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const data = { bookingId, lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed || 0 };
        socketRef.current?.emit("location_update", data);
        setLocation({ lat: data.lat, lng: data.lng, timestamp: new Date().toISOString() });
      },
      (err) => { setError("We couldn't read your GPS location: " + err.message); setIsSharing(false); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const stopSharing = () => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    socketRef.current?.emit("stop_tracking", bookingId);
    setIsSharing(false);
  };

  const handleStartJourney = async () => {
    setActionLoading(true);
    try {
      await api.patch("/bookings/" + bookingId + "/start");
      socketRef.current?.emit("journey_started_broadcast", { bookingId });
      await fetchBooking();
      startSharing();
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't start the journey. Please try again.", "booking"));
    } finally { setActionLoading(false); }
  };

  const handleMarkDelivered = async () => {
    setActionLoading(true);
    try {
      stopSharing();
      await api.patch("/bookings/" + bookingId + "/deliver");
      socketRef.current?.emit("delivered_broadcast", { bookingId });
      await fetchBooking();
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't mark this load as delivered. Please try again.", "booking"));
    } finally { setActionLoading(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0A1F44", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "3px solid rgba(255,255,255,0.2)", borderTop: "3px solid #3D7BFF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  const isTruckOwner = user?.role === "TRUCK_OWNER";
  const bStatus = booking?.status;
  const loadStatus = booking?.load?.status;
  const isDelivered = bStatus === "COMPLETED";
  const isInTransit = loadStatus === "IN_TRANSIT";

  return (
    <div style={{ height: "100vh", background: "#0A1F44", fontFamily: "\'Helvetica Neue\', Arial, sans-serif", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, background: "#0A1F44", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => router.back()} aria-label="Go back" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", padding: "7px 10px", color: "#F8FAFC", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#F8FAFC" }}>{booking?.load?.title || "Live tracking"}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "1px" }}>{booking?.load?.pickupCity} → {booking?.load?.deliveryCity}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isSharing ? "#5BE3C4" : isDelivered ? "#16A34A" : "#6b7280", animation: isSharing ? "pulse 1.5s infinite" : "none" }} />
          <span style={{ fontSize: "11px", color: isSharing ? "#5BE3C4" : "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: "0.5px" }}>
            {isSharing ? "Live" : isDelivered ? "Delivered" : isInTransit ? "In transit" : bStatus || "—"}
          </span>
        </div>
      </div>

      {/* Map - takes most of screen */}
      <div ref={mapContainerRef} style={{ flex: 1 }} />

      {/* Bottom panel */}
      <div style={{ background: "#0A1F44", padding: "16px 20px", flexShrink: 0, zIndex: 10 }}>
        {error && <div style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "8px", padding: "10px 14px", color: "#fca5a5", fontSize: "13px", marginBottom: "10px" }}>{error}</div>}

        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginBottom: "10px" }}>{status}</div>

        {location && (
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px 12px", flex: 1, textAlign: "center" as const }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "3px" }}>Lat</div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#F8FAFC", fontFamily: "monospace" }}>{location.lat.toFixed(5)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px 12px", flex: 1, textAlign: "center" as const }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "3px" }}>Lng</div>
              <div style={{ fontSize: "12px", fontWeight: "700", color: "#F8FAFC", fontFamily: "monospace" }}>{location.lng.toFixed(5)}</div>
            </div>
          </div>
        )}

        {isTruckOwner && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "8px" }}>
            {!isInTransit && !isDelivered && (
              <button onClick={handleStartJourney} disabled={actionLoading}
                style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: "#3D7BFF", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? "Starting journey…" : "Start journey"}
              </button>
            )}
            {isInTransit && !isDelivered && (
              <>
                <button onClick={isSharing ? stopSharing : startSharing}
                  style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", color: "#F8FAFC", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                  {isSharing ? "Pause location sharing" : "Resume location sharing"}
                </button>
                <button onClick={handleMarkDelivered} disabled={actionLoading}
                  style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: "#16a34a", color: "#fff", fontSize: "14px", fontWeight: "700", cursor: actionLoading ? "not-allowed" : "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                  {actionLoading ? "Marking delivered…" : "Mark delivered"}
                </button>
              </>
            )}
            {isDelivered && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", background: "rgba(22,163,74,0.1)", borderRadius: "10px", color: "#16A34A", fontSize: "14px", fontWeight: "600" }}>
                <CheckCircle2 size={16} /> Delivery completed
              </div>
            )}
          </div>
        )}

        {!isTruckOwner && (
          <div>
            {!isInTransit && !isDelivered && (
              <div style={{ textAlign: "center" as const, padding: "12px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Waiting for the truck owner to start the journey…
              </div>
            )}
            {isInTransit && !location && (
              <div style={{ textAlign: "center" as const, padding: "12px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Journey started — waiting for the first location update…
              </div>
            )}
            {isInTransit && location && (
              <a href={"https://maps.google.com/?q=" + location.lat + "," + location.lng} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", width: "100%", padding: "14px", borderRadius: "10px", background: "#3D7BFF", color: "#fff", fontSize: "14px", fontWeight: "700", textAlign: "center" as const, textDecoration: "none" }}>
                Open in Google Maps
              </a>
            )}
            {isDelivered && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", background: "rgba(22,163,74,0.1)", borderRadius: "10px", color: "#16A34A", fontSize: "14px", fontWeight: "600" }}>
                <CheckCircle2 size={16} /> Your load has been delivered.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
