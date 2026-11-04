import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, StatusBar, Alert, TextInput, Modal,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { SkeletonList } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { StatusBadge } from '../../components/StatusBadge';
import { formatApiError } from '../../lib/errors';
import { theme } from '../../theme';

export default function DriversScreen({ navigation, route }: any) {
  const bookingId = route?.params?.bookingId;
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [phone, setPhone] = useState('');
  const [inviting, setInviting] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/drivers');
      setDrivers(res.data?.drivers || res.data || []);
    } catch (e) {
      console.warn('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const onRefresh = () => { setRefreshing(true); fetch(); };

  const handleInvite = async () => {
    if (!phone.trim()) { Alert.alert('Enter phone number', "Please enter the driver's phone number."); return; }
    setInviting(true);
    try {
      await api.post('/drivers/invite', { phone: phone.trim() });
      setShowInvite(false);
      setPhone('');
      await fetch();
      Alert.alert('Driver added', 'This driver is now part of your fleet.');
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === 'USER_NOT_FOUND' && data?.canInvite) {
        // User not registered — offer to send SMS invite
        Alert.alert(
          "This number isn't on Sahid Freight yet",
          "Send them an SMS invite to join as your driver — they'll be linked to your fleet when they register.",
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Send invite',
              onPress: async () => {
                try {
                  await api.post('/drivers/send-invite', { phone: phone.trim() });
                  setShowInvite(false);
                  setPhone('');
                  Alert.alert('Invite sent', "We'll link them to your fleet as soon as they register.");
                } catch (inviteErr: any) {
                  Alert.alert("Couldn't send invite", formatApiError(inviteErr, "We couldn't send the SMS invite. Please try again.", 'generic'));
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("Couldn't add driver", formatApiError(err, "We couldn't add this driver. Check the phone number and try again.", 'generic'));
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = (driverId: string, driverName: string) => {
    Alert.alert(
      `Remove ${driverName || 'this driver'}?`,
      "They'll be unassigned from any trucks and lose access to your fleet.",
      [
        { text: 'Keep driver', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/drivers/${driverId}`);
              setDrivers(prev => prev.filter(d => d.id !== driverId));
            } catch (err: any) {
              Alert.alert("Couldn't remove driver", formatApiError(err, "We couldn't remove this driver. Please try again.", 'generic'));
            }
          },
        },
      ]
    );
  };

  const handleAssign = async (driverId: string, driverName: string) => {
    if (!bookingId) return;
    setAssigning(driverId);
    try {
      await api.patch(`/bookings/${bookingId}/assign-driver`, { driverId });
      Alert.alert('Driver assigned', `${driverName || 'The driver'} is now driving this load.`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't assign driver", formatApiError(err, "We couldn't assign this driver. Please try again.", 'booking'));
    } finally {
      setAssigning(null);
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Feather name="chevron-left" size={20} color={theme.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{bookingId ? 'Assign driver' : 'Drivers'}</Text>
          {!bookingId && <Text style={styles.subtitle}>People who drive your trucks.</Text>}
        </View>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
          <Feather name="plus" size={14} color={theme.darkGreen} />
          <Text style={styles.inviteBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonList count={4} />
      ) : drivers.length === 0 ? (
        <EmptyState
          icon="users"
          title="No drivers yet"
          subtitle="Add drivers to assign them to your trucks."
          buttonLabel="Add driver"
          onButton={() => setShowInvite(true)}
        />
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarText}>{(item.fullName || 'D')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{item.fullName}</Text>
                <Text style={styles.driverPhone}>{item.phone}</Text>
                {item.truck && (
                  <Text style={styles.driverTruck}>Driving: {item.truck.plateNumber}</Text>
                )}
              </View>
              <View style={styles.right}>
                <StatusBadge status={item.status || 'ACTIVE'} />
                {bookingId ? (
                  <TouchableOpacity
                    style={[styles.assignDriverBtn, assigning === item.id && { opacity: 0.5 }]}
                    onPress={() => handleAssign(item.id, item.fullName)}
                    disabled={!!assigning}
                  >
                    {assigning === item.id
                      ? <Text style={styles.assignDriverText}>Assigning...</Text>
                      : <Text style={styles.assignDriverText}>Assign driver</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemove(item.id, item.fullName)}
                  >
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Invite Modal */}
      <Modal visible={showInvite} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScreenWrapper>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setShowInvite(false); setPhone(''); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add a driver</Text>
              <View style={{ width: 60 }} />
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Driver phone number</Text>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+251 9XX XXX XXXX"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                autoFocus
              />
              <Text style={styles.hint}>
                If they already have a Sahid Freight account, they'll be linked to your fleet right away. Otherwise we'll offer to send them an SMS invite.
              </Text>
              <TouchableOpacity
                style={[styles.submitBtn, inviting && { opacity: 0.6 }]}
                onPress={handleInvite}
                disabled={inviting}
              >
                {inviting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color={theme.darkGreen} />
                    <Text style={styles.submitText}>Adding driver...</Text>
                  </View>
                ) : (
                  <Text style={styles.submitText}>Add driver</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScreenWrapper>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  back:         { padding: 4, flexDirection: 'row', alignItems: 'center' },
  backText:     { fontSize: 15, color: theme.accent, fontWeight: '500' },
  title:        { fontSize: 17, fontWeight: '700', color: theme.text, fontFamily: 'Inter_700Bold' },
  subtitle:     { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  inviteBtn:    { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 4 },
  inviteBtnText:{ color: theme.darkGreen, fontSize: 13, fontWeight: '600' },
  list:         { padding: 16, paddingTop: 4 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 10, gap: 12 },
  avatarBox:    { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { fontSize: 15, fontWeight: '500', color: theme.lightGreen },
  driverName:   { fontSize: 14, fontWeight: '500', color: theme.text },
  driverPhone:  { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  driverTruck:  { fontSize: 11, color: theme.accent, marginTop: 2, fontWeight: '500' },
  right:        { alignItems: 'flex-end', gap: 8 },
  removeBtn:    { paddingHorizontal: 10, paddingVertical: 4 },
  removeBtnText:{ fontSize: 13, color: theme.danger, fontWeight: '500' },
  assignDriverBtn: { backgroundColor: theme.accentDim, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  assignDriverText:{ fontSize: 13, color: theme.accent, fontWeight: '500' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border },
  modalCancel:  { fontSize: 15, color: theme.accent, fontWeight: '500' },
  modalTitle:   { fontSize: 15, fontWeight: '500', color: theme.text },
  modalBody:    { padding: 20 },
  fieldLabel:   { fontSize: 12, fontWeight: '600', color: theme.textMuted, marginBottom: 8 },
  phoneInput:   { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text },
  hint:         { fontSize: 13, color: theme.textMuted, marginTop: 10, lineHeight: 18 },
  submitBtn:    { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 24 },
  submitText:   { color: theme.darkGreen, fontSize: 14, fontWeight: '600' },
});
