import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Switch, Alert,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { NotificationBell } from '../../components/NotificationBell';
import { formatApiError } from '../../lib/errors';
import { theme } from '../../theme';

export default function MyFleetScreen({ navigation }: any) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/trucks/my');
      setTrucks(res.data?.trucks || res.data || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const toggleAvailability = async (truck: any) => {
    try {
      await api.patch(`/trucks/${truck.id}`, { isAvailable: !truck.isAvailable });
      setTrucks(prev => prev.map(t => t.id === truck.id ? { ...t, isAvailable: !t.isAvailable } : t));
    } catch (e: any) {
      Alert.alert('Error', formatApiError(e, 'Could not update truck availability.'));
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.header}>
        <Text style={styles.title}>My Fleet</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <NotificationBell navigation={navigation} />
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddTruck')}>
            <Text style={styles.addBtnText}>+ Add Truck</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : trucks.length === 0 ? (
        <EmptyState
          emoji="🚛"
          title="No trucks yet"
          subtitle="Add your trucks to start bidding on loads."
          buttonLabel="Add a Truck"
          onButton={() => navigation.navigate('AddTruck')}
        />
      ) : (
        <FlatList
          data={trucks}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.plate}>{item.plateNumber}</Text>
                  <Text style={styles.type}>{item.truckType?.replace(/_/g, ' ')} · {item.capacityTons}t</Text>
                </View>
                <View style={styles.availRow}>
                  <Text style={[styles.availText, { color: item.isAvailable ? theme.accent : theme.textMuted }]}>
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </Text>
                  <Switch
                    value={item.isAvailable}
                    onValueChange={() => toggleAvailability(item)}
                    trackColor={{ false: theme.border, true: theme.accentBorder }}
                    thumbColor={item.isAvailable ? theme.accent : theme.textMuted}
                  />
                </View>
              </View>

              {/* Driver info */}
              {item.driver ? (
                <View style={styles.driverRow}>
                  <Text style={styles.driverLabel}>Driver:</Text>
                  <Text style={styles.driverName}>{item.driver.name}</Text>
                  <StatusBadge status={item.driver.status || 'ACTIVE'} />
                </View>
              ) : (
                <View style={styles.noDriverRow}>
                  <Text style={styles.noDriverText}>No driver assigned</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Drivers')}>
                    <Text style={styles.assignLink}>Assign driver</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Meta */}
              <View style={styles.meta}>
                {item.make && <Text style={styles.metaText}>{item.make} {item.model} {item.year}</Text>}
                {item.country && <Text style={styles.metaText}>{item.country}</Text>}
              </View>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditTruck', { truckId: item.id })}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => {
                  Alert.alert('Delete Truck', 'Are you sure you want to delete this truck?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: async () => {
                      try {
                        await api.delete(`/trucks/${item.id}`);
                        setTrucks(prev => prev.filter(t => t.id !== item.id));
                      } catch (e: any) { Alert.alert('Error', formatApiError(e, 'Could not delete truck.')); }
                    }},
                  ]);
                }}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title:        { fontSize: 22, fontWeight: '500', color: theme.text },
  addBtn:       { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
  addBtnText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  list:         { padding: 16, paddingTop: 4 },
  card:         { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  plate:        { fontSize: 15, fontWeight: '500', color: theme.text },
  type:         { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  availRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availText:    { fontSize: 13, fontWeight: '500' },
  driverRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: theme.border },
  driverLabel:  { fontSize: 13, color: theme.textMuted },
  driverName:   { fontSize: 13, fontWeight: '500', color: theme.text, flex: 1 },
  noDriverRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: theme.border },
  noDriverText: { fontSize: 13, color: theme.textMuted },
  assignLink:   { fontSize: 13, color: theme.accent, fontWeight: '500' },
  meta:         { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaText:     { fontSize: 11, color: theme.textMuted },
  actions:        { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: theme.border },
  editBtn:        { flex: 1, backgroundColor: theme.surface2, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  editBtnText:    { fontSize: 13, color: theme.text, fontWeight: '500' },
  deleteBtn:      { flex: 1, backgroundColor: theme.dangerDim, borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 0.5, borderColor: theme.danger },
  deleteBtnText:  { fontSize: 13, color: theme.danger, fontWeight: '500' },
});
