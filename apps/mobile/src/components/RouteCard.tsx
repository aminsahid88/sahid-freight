import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  Platform,
} from "react-native";
import { COLORS } from "../constants";

// TODO: re-enable react-native-maps when paid Apple Developer account + static frameworks setup

interface RouteCardProps {
  pickupCity: string;
  deliveryCity: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: string | null;
  status?: string | null;
  statusTimestamp?: string | null;
  driverPhone?: string | null;
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function openInMaps(
  lat?: number | null,
  lng?: number | null,
  address?: string | null
) {
  let url: string;
  if (lat && lng) {
    url =
      Platform.OS === "ios"
        ? `maps://?daddr=${lat},${lng}`
        : `geo:0,0?q=${lat},${lng}`;
  } else if (address) {
    url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`
        : `geo:0,0?q=${encodeURIComponent(address)}`;
  } else {
    return;
  }
  Linking.openURL(url);
}

export default function RouteCard({
  pickupCity,
  deliveryCity,
  deliveryLat,
  deliveryLng,
  deliveryAddress,
  status,
  statusTimestamp,
  driverPhone,
}: RouteCardProps) {
  const canOpenMaps = !!(deliveryLat && deliveryLng) || !!deliveryAddress;
  const canCallDriver = !!driverPhone;

  return (
    <View style={styles.card}>
      <View style={styles.routeRow}>
        <Text style={styles.city}>{pickupCity}</Text>
        <Text style={styles.arrow}> → </Text>
        <Text style={styles.city}>{deliveryCity}</Text>
      </View>

      {status && (
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
          {statusTimestamp && (
            <Text style={styles.timestamp}>
              {" · "}
              {formatTimeAgo(statusTimestamp)}
            </Text>
          )}
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.mapsButton, !canOpenMaps && styles.disabled]}
          onPress={() => openInMaps(deliveryLat, deliveryLng, deliveryAddress)}
          disabled={!canOpenMaps}
        >
          <Text style={styles.mapsButtonText}>Open in Maps</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.callButton, !canCallDriver && styles.disabled]}
          onPress={() => driverPhone && Linking.openURL(`tel:${driverPhone}`)}
          disabled={!canCallDriver}
        >
          <Text style={styles.callButtonText}>Contact Driver</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  city: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  arrow: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusPill: {
    backgroundColor: "rgba(232, 160, 32, 0.15)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  timestamp: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  mapsButton: {
    backgroundColor: COLORS.accent,
  },
  mapsButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  callButton: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.4,
  },
});
