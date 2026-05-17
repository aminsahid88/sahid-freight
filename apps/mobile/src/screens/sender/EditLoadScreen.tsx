import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { TRUCK_TYPES, COUNTRIES, CURRENCIES } from '../../lib/constants';

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 90, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function PickerRow({ label, value, options, onChange }: any) {
  return (
    <View style={styles.fieldWrap}>
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

export default function EditLoadScreen({ route, navigation }: any) {
  const { loadId } = route.params;
  const [form, setForm] = useState({
    title: '',
    description: '',
    pickupCity: '',
    pickupCountry: 'ETHIOPIA',
    deliveryCity: '',
    deliveryCountry: 'ETHIOPIA',
    weightTons: '',
    truckTypeNeeded: 'FLATBED',
    offeredPrice: '',
    currency: 'USD',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/loads/${loadId}`);
        const l = res.data?.load || res.data;
        if (l) {
          setForm({
            title: l.title || '',
            description: l.description || '',
            pickupCity: l.pickupCity || '',
            pickupCountry: l.pickupCountry || 'ETHIOPIA',
            deliveryCity: l.deliveryCity || '',
            deliveryCountry: l.deliveryCountry || 'ETHIOPIA',
            weightTons: String(l.weightTons || ''),
            truckTypeNeeded: l.truckTypeNeeded || 'FLATBED',
            offeredPrice: String(l.offeredPrice || ''),
            currency: l.currency || 'USD',
          });
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadId]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    if (!form.title.trim()) return 'Please enter a load title.';
    if (!form.pickupCity.trim()) return 'Please enter a pickup city.';
    if (!form.deliveryCity.trim()) return 'Please enter a delivery city.';
    if (!form.weightTons || isNaN(parseFloat(form.weightTons))) return 'Please enter valid weight.';
    if (!form.offeredPrice || isNaN(parseFloat(form.offeredPrice))) return 'Please enter a valid price.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing Info', err); return; }
    setSubmitting(true);
    try {
      await api.patch(`/loads/${loadId}`, {
        ...form,
        weightTons: parseFloat(form.weightTons),
        offeredPrice: parseFloat(form.offeredPrice),
      });
      Alert.alert('Load Updated!', 'Your load has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to update load. Try again.');
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
          <Text style={styles.headerTitle}>Edit Load</Text>
          <View style={{ width: 56 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Field label="Load Title *" value={form.title} onChangeText={set('title')} placeholder="e.g. Cement bags" />
          <Field label="Description" value={form.description} onChangeText={set('description')} placeholder="Optional details..." multiline />
          <Field label="Pickup City *" value={form.pickupCity} onChangeText={set('pickupCity')} placeholder="e.g. Addis Ababa" />
          <PickerRow label="Pickup Country" value={form.pickupCountry} options={COUNTRIES} onChange={set('pickupCountry')} />
          <Field label="Delivery City *" value={form.deliveryCity} onChangeText={set('deliveryCity')} placeholder="e.g. Djibouti City" />
          <PickerRow label="Delivery Country" value={form.deliveryCountry} options={COUNTRIES} onChange={set('deliveryCountry')} />
          <PickerRow label="Truck Type" value={form.truckTypeNeeded} options={TRUCK_TYPES} onChange={set('truckTypeNeeded')} />
          <Field label="Weight (tons) *" value={form.weightTons} onChangeText={set('weightTons')} placeholder="e.g. 20" keyboardType="decimal-pad" />
          <Field label="Offered Price *" value={form.offeredPrice} onChangeText={set('offeredPrice')} placeholder="e.g. 4500" keyboardType="decimal-pad" />
          <PickerRow label="Currency" value={form.currency} options={CURRENCIES} onChange={set('currency')} />
          <View style={{ height: 20 }} />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={theme.darkGreen} /> : <Text style={styles.submitText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border, backgroundColor: theme.bg },
  headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
  cancel:         { fontSize: 15, color: theme.accent, fontWeight: '500' },
  content:        { padding: 16 },
  fieldWrap:      { marginBottom: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '500', color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.9 },
  fieldInput:     { backgroundColor: theme.inputBg, color: theme.inputText, borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 12, paddingHorizontal: 14, height: 52, fontSize: 15, fontWeight: '400' },
  chip:           { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface2 },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen },
  footer:         { padding: 16, paddingBottom: 8, backgroundColor: theme.bg, borderTopWidth: 0.5, borderTopColor: theme.border },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
