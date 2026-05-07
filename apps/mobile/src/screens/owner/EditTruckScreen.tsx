import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { TRUCK_TYPES, COUNTRIES } from '../../lib/constants';

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PickerRow({ label, value, options, onChange }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((opt: string) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>
              {opt.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function EditTruckScreen({ route, navigation }: any) {
  const { truckId } = route.params;
  const [form, setForm] = useState({
    plateNumber: '',
    truckType: 'FLATBED',
    capacityTons: '',
    currentCity: '',
    currentCountry: 'ETHIOPIA',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/trucks/my');
        const trucks = res.data?.trucks || res.data || [];
        const truck = trucks.find((t: any) => t.id === truckId);
        if (truck) {
          setForm({
            plateNumber: truck.plateNumber || '',
            truckType: truck.truckType || 'FLATBED',
            capacityTons: String(truck.capacityTons || ''),
            currentCity: truck.currentCity || '',
            currentCountry: truck.currentCountry || 'ETHIOPIA',
          });
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [truckId]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.plateNumber.trim()) { Alert.alert('Missing Info', 'Please enter plate number.'); return; }
    if (!form.capacityTons || isNaN(parseFloat(form.capacityTons))) { Alert.alert('Missing Info', 'Please enter valid capacity.'); return; }
    setSubmitting(true);
    try {
      await api.patch(`/trucks/${truckId}`, {
        plateNumber: form.plateNumber,
        truckType: form.truckType,
        capacityTons: parseFloat(form.capacityTons),
        currentCity: form.currentCity,
        currentCountry: form.currentCountry,
      });
      Alert.alert('Truck Updated!', 'Your truck details have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update truck. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Truck</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Field label="Plate Number *" value={form.plateNumber} onChangeText={set('plateNumber')} placeholder="e.g. AA-12345" />
          <PickerRow label="Truck Type" value={form.truckType} options={TRUCK_TYPES} onChange={set('truckType')} />
          <Field label="Capacity (tons) *" value={form.capacityTons} onChangeText={set('capacityTons')} placeholder="e.g. 30" keyboardType="decimal-pad" />
          <Field label="Current City" value={form.currentCity} onChangeText={set('currentCity')} placeholder="e.g. Addis Ababa" />
          <PickerRow label="Current Country" value={form.currentCountry} options={COUNTRIES} onChange={set('currentCountry')} />
          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={theme.darkGreen} /> : <Text style={styles.submitText}>Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border, backgroundColor: theme.bg },
  headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
  cancel:         { fontSize: 15, color: theme.accent, fontWeight: '500' },
  content:        { padding: 16, paddingBottom: 40 },
  field:          { marginBottom: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '500', color: theme.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.9 },
  input:          { backgroundColor: theme.surface, color: theme.text, borderRadius: 12, paddingHorizontal: 14, height: 52, fontSize: 15 },
  chip:           { borderRadius: 999, paddingHorizontal: 16, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
