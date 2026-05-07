import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { TRUCK_TYPES, COUNTRIES } from '../../lib/constants';
import { theme } from '../../theme';

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

export default function AddTruckScreen({ navigation }: any) {
  const [form, setForm] = useState({
    plateNumber: '',
    truckType: 'FLATBED',
    capacityTons: '',
    currentCity: '',
    currentCountry: 'ETHIOPIA',
  });
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<{ label: string; uri: string }[]>([]);

  const pickDoc = async (label: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      setDocs(prev => [...prev.filter(d => d.label !== label), { label, uri: result.assets[0].uri }]);
    }
  };

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    if (!form.plateNumber.trim()) return 'Please enter a plate number.';
    if (!form.capacityTons || isNaN(parseFloat(form.capacityTons))) return 'Please enter a valid capacity in tons.';
    return null;
  };

  const handleSubmit = async () => {
    if (!form.currentCity.trim()) { Alert.alert('Missing Info', 'Please enter the truck\'s current city.'); return; }
    const err = validate();
    if (err) { Alert.alert('Missing Info', err); return; }

    setLoading(true);
    try {
      await api.post('/trucks', {
        plateNumber: form.plateNumber,
        truckType: form.truckType,
        capacityTons: parseFloat(form.capacityTons),
        currentCity: form.currentCity,
        currentCountry: form.currentCountry,
      });
      Alert.alert('Truck Added!', 'Your truck has been added to your fleet.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add truck. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Truck</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Field label="Plate Number *" value={form.plateNumber} onChangeText={set('plateNumber')} placeholder="e.g. AA-12345" />
          <PickerRow label="Truck Type" value={form.truckType} options={TRUCK_TYPES} onChange={set('truckType')} />
          <Field label="Capacity (tons) *" value={form.capacityTons} onChangeText={set('capacityTons')} placeholder="e.g. 30" keyboardType="decimal-pad" />
          <Field label="Current City *" value={form.currentCity} onChangeText={set('currentCity')} placeholder="e.g. Addis Ababa" />
          <PickerRow label="Current Country" value={form.currentCountry} options={COUNTRIES} onChange={set('currentCountry')} />

          {/* Document uploads */}
          <Text style={styles.docSectionLabel}>DOCUMENTS (OPTIONAL)</Text>
          {['Vehicle registration', 'Insurance certificate', 'Truck photo'].map(label => {
            const doc = docs.find(d => d.label === label);
            return (
              <TouchableOpacity key={label} style={styles.docRow} onPress={() => pickDoc(label)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docLabel}>{label}</Text>
                  {doc ? (
                    <View style={styles.docPreview}>
                      <Image source={{ uri: doc.uri }} style={styles.docThumb} />
                      <Text style={styles.docAdded}>Added</Text>
                    </View>
                  ) : (
                    <Text style={styles.docHint}>Tap to upload</Text>
                  )}
                </View>
                {doc && (
                  <TouchableOpacity onPress={() => setDocs(prev => prev.filter(d => d.label !== label))}>
                    <Text style={styles.docRemove}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.darkGreen} />
              : <Text style={styles.submitText}>Add Truck</Text>
            }
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
  docSectionLabel:{ fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 20, marginBottom: 10 },
  docRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  docLabel:       { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 4 },
  docHint:        { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  docPreview:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docThumb:       { width: 32, height: 32, borderRadius: 6 },
  docAdded:       { fontSize: 13, color: theme.accent, fontWeight: '500' },
  docRemove:      { fontSize: 16, color: theme.danger, padding: 4 },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
