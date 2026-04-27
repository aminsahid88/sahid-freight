# Sahid Freight — Roadmap

## P1 — Critical path

(tracked elsewhere)

## P2 — Near-term improvements

### Embedded map view in tracking
- **Status**: Not started (placeholder + native maps handoff in place)
- **Complexity**: M
- **Priority**: P2
- **Notes**: react-native-maps removed because incompatible with dynamic frameworks (needed for Firebase). When ready: try react-native-maps with `:modular_headers => true`, or switch to Mapbox, or revisit static frameworks if Firebase Swift bridging is fixed upstream.

### Push notifications
- **Status**: Disabled (code commented out, stubs in place)
- **Complexity**: S
- **Priority**: P2
- **Notes**: Requires paid Apple Developer account ($99/yr). All push code is commented with TODO markers in `src/lib/notifications.ts`. Backend `notify.ts` and in-app notification bell are unaffected.
