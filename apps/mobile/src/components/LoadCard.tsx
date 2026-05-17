import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { StatusBadge } from './StatusBadge';
import { formatPrice } from '../lib/constants';

interface Props {
  load: any;
  onPress: () => void;
}

export function LoadCard({ load, onPress }: Props) {
  const price = load.offeredPrice;
  const currency = load.currency || 'ETB';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{load.title}</Text>
          <Text style={styles.route}>{load.pickupCity} → {load.deliveryCity}</Text>
        </View>
        <StatusBadge status={load.status} />
      </View>
      <View style={styles.divider} />
      <View style={styles.bottom}>
        <View style={styles.metaLeft}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{load.weightTons}t</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{load.truckTypeNeeded?.replace(/_/g, ' ')}</Text>
          </View>
          {load._count?.bids > 0 && (
            <View style={styles.bidBadge}>
              <Text style={styles.bidText}>{load._count.bids} bid{load._count.bids !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Text style={styles.price}>{formatPrice(price)} <Text style={styles.currency}>{currency}</Text></Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:     { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  top:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  title:    { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 3 },
  route:    { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  divider:  { height: 0.5, backgroundColor: theme.border, marginBottom: 12 },
  bottom:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  pill:     { backgroundColor: theme.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, color: theme.textMuted, fontWeight: '400' },
  price:    { fontSize: 15, fontWeight: '500', color: theme.accent },
  currency: { fontSize: 11, fontWeight: '400', color: theme.textMuted },
  bidBadge: { backgroundColor: theme.warningDim, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  bidText:  { fontSize: 10, fontWeight: '500', color: theme.warning },
});
