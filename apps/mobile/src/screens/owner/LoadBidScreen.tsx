import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput,
  RefreshControl,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { StatusBadge } from '../../components/StatusBadge';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { useAuthStore } from '../../store/auth';

export default function LoadBidScreen({ route, navigation }: any) {
  const { user } = useAuthStore();
  const { loadId } = route.params;
  const [load, setLoad] = useState<any>(null);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [loadRes, truckRes] = await Promise.all([
        api.get(`/loads/${loadId}`),
        api.get('/trucks/my'),
      ]);
      const loadData = loadRes.data?.load || loadRes.data;
      const truckData = truckRes.data?.trucks || truckRes.data || [];
      setLoad(loadData);
      const available = truckData.filter((t: any) =>
        t.isAvailable && (!loadData?.truckTypeNeeded || t.truckType === loadData.truckTypeNeeded)
      );
      setTrucks(available.length > 0 ? available : truckData.filter((t: any) => t.isAvailable));
      if (loadData?.offeredPrice) setBidPrice(String(loadData.offeredPrice));
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const handleSubmit = async () => {
    if (!user?.isVerified) {
      Alert.alert(
        'Complete your verification',
        'You need to upload all required documents and have them approved before you can place a bid.',
        [
          { text: 'Go to Verification', onPress: () => navigation.navigate('Verification') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    const truck = trucks.find((t: any) => t.id === selectedTruck);
    if (truck && !truck.isVerified) {
      Alert.alert(
        'Truck not verified',
        "This truck's documents need verification before it can be used for bidding.",
        [{ text: 'OK' }],
      );
      return;
    }
    if (!selectedTruck) { Alert.alert('Select Truck', 'Please select a truck to bid with.'); return; }
    if (!bidPrice || isNaN(parseFloat(bidPrice))) { Alert.alert('Enter Price', 'Please enter a valid bid price.'); return; }

    setSubmitting(true);
    try {
      await api.post('/bids', {
        loadId,
        truckId: selectedTruck,
        price: parseFloat(bidPrice),
        currency: load?.currency || 'USD',
        message: note.trim() || undefined,
      });
      Alert.alert('Bid Placed!', 'Your bid has been submitted. You will be notified when the sender responds.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'Failed to place bid.';
      const detail = status === 500 ? `${msg} (server error — try again later)` : msg;
      Alert.alert('Bid failed', detail);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <SkeletonList count={4} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Place Bid</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Load Summary Card */}
        <View style={styles.loadCard}>
          <View style={styles.loadTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.loadTitle}>{load?.title}</Text>
              <Text style={styles.loadRoute}>{load?.pickupCity} → {load?.deliveryCity}</Text>
            </View>
            <StatusBadge status={load?.status} />
          </View>
          <View style={styles.loadMeta}>
            <View style={styles.pill}><Text style={styles.pillText}>{load?.weightTons}t</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>{load?.truckTypeNeeded?.replace(/_/g, ' ')}</Text></View>
            <View style={{ flex: 1 }} />
            <Text style={styles.loadPrice}>
              Offer: {formatPrice(load?.offeredPrice, load?.currency)}
            </Text>
          </View>
        </View>

        {/* Select Truck */}
        <Text style={styles.sectionLabel}>SELECT TRUCK</Text>
        {trucks.length === 0 ? (
          <View style={styles.noTruck}>
            <Text style={styles.noTruckText}>No available trucks match this load type.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AddTruck')}>
              <Text style={styles.noTruckLink}>Add a truck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          trucks.map(truck => (
            <TouchableOpacity
              key={truck.id}
              style={[styles.truckCard, selectedTruck === truck.id && styles.truckCardActive]}
              onPress={() => setSelectedTruck(truck.id)}
            >
              <View style={[styles.radio, selectedTruck === truck.id && styles.radioActive]}>
                {selectedTruck === truck.id && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.truckPlate}>{truck.plateNumber}</Text>
                <Text style={styles.truckType}>{truck.truckType?.replace(/_/g, ' ')} · {truck.capacityTons}t capacity</Text>
                {truck.driver && (
                  <Text style={styles.truckDriver}>Driver: {truck.driver.fullName}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bid Price */}
        <Text style={styles.sectionLabel}>BID PRICE ({load?.currency})</Text>
        <TextInput
          style={styles.input}
          value={bidPrice}
          onChangeText={setBidPrice}
          keyboardType="decimal-pad"
          placeholder={`e.g. ${load?.offeredPrice}`}
          placeholderTextColor={theme.textMuted}
        />

        {/* Note */}
        <Text style={styles.sectionLabel}>NOTE (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          value={note}
          onChangeText={setNote}
          placeholder="Any message to the cargo sender..."
          placeholderTextColor={theme.textMuted}
          multiline
        />

        {/* Bottom spacing for fixed button */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Submit button fixed at bottom */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !selectedTruck) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting || !selectedTruck}
        >
          {submitting
            ? <ActivityIndicator color={theme.darkGreen} />
            : <Text style={styles.submitText}>Place Bid</Text>
          }
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back:           { padding: 4 },
  backText:       { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
  content:        { padding: 16 },
  loadCard:       { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 20 },
  loadTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  loadTitle:      { fontSize: 15, fontWeight: '500', color: theme.text },
  loadRoute:      { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  loadMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill:           { backgroundColor: theme.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillText:       { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  loadPrice:      { fontSize: 13, fontWeight: '500', color: theme.accent },
  sectionLabel:   { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 10 },
  noTruck:        { backgroundColor: theme.warningDim, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: theme.warning, marginBottom: 16, alignItems: 'center' },
  noTruckText:    { fontSize: 13, color: theme.warning, textAlign: 'center', marginBottom: 8 },
  noTruckLink:    { fontSize: 13, color: theme.accent, fontWeight: '500' },
  truckCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  truckCardActive:{ backgroundColor: theme.accentDim },
  radio:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:    { borderColor: theme.accent },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent },
  truckPlate:     { fontSize: 14, fontWeight: '500', color: theme.text },
  truckType:      { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  truckDriver:    { fontSize: 11, color: theme.accent, marginTop: 2, fontWeight: '500' },
  input:          { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, marginBottom: 16 },
  bottomBar:      { padding: 16, paddingBottom: 24, borderTopWidth: 0.5, borderTopColor: theme.border, backgroundColor: theme.bg },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
