import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { TRUCK_TYPES, COUNTRIES, CURRENCIES } from '../../lib/constants';
import { formatApiError } from '../../lib/errors';

// Fallback formula constants for when no historical data exists
const PRICE_CONFIG = {
  basePrice: 200,        // USD base
  perKmRate: 0.45,       // USD per km
  weightFactor: 8,       // USD per ton
  // Approximate distances (km) between major corridors
  corridorDistances: {
    'ETHIOPIA-ETHIOPIA': 400,
    'ETHIOPIA-DJIBOUTI': 900,
    'ETHIOPIA-SOMALIA': 750,
    'DJIBOUTI-ETHIOPIA': 900,
    'DJIBOUTI-DJIBOUTI': 150,
    'DJIBOUTI-SOMALIA': 600,
    'SOMALIA-ETHIOPIA': 750,
    'SOMALIA-DJIBOUTI': 600,
    'SOMALIA-SOMALIA': 500,
  } as Record<string, number>,
  spreadPercent: 0.12,   // +/- 12% for range
};

function calculateFallbackPrice(pickupCountry: string, deliveryCountry: string, weightTons: number) {
  const key = `${pickupCountry}-${deliveryCountry}`;
  const distance = PRICE_CONFIG.corridorDistances[key] || 500;
  const base = PRICE_CONFIG.basePrice + (distance * PRICE_CONFIG.perKmRate) + (weightTons * PRICE_CONFIG.weightFactor);
  const spread = base * PRICE_CONFIG.spreadPercent;
  return { min: Math.round(base - spread), max: Math.round(base + spread), avg: Math.round(base) };
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false, returnKeyType, onSubmitEditing, inputRef }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.fieldInput, multiline && { height: 90, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
    </View>
  );
}

function PickerRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map(opt => (
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

export default function PostLoadScreen({ navigation, route }: any) {
  const prefill = route?.params?.prefill;
  const isDuplicate = !!prefill;
  const [form, setForm] = useState({
    title: prefill?.title || '',
    description: prefill?.description || '',
    pickupCity: prefill?.pickupCity || '',
    pickupCountry: prefill?.pickupCountry || 'ETHIOPIA',
    deliveryCity: prefill?.deliveryCity || '',
    deliveryCountry: prefill?.deliveryCountry || 'ETHIOPIA',
    weightTons: prefill?.weightTons ? String(prefill.weightTons) : '',
    truckTypeNeeded: prefill?.truckTypeNeeded || 'FLATBED',
    offeredPrice: prefill?.offeredPrice ? String(prefill.offeredPrice) : '',
    currency: prefill?.currency || 'USD',
  });
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ min: number; max: number; avg: number; source: 'api' | 'formula' } | null>(null);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  // Fetch price suggestion when relevant fields change
  const fetchSuggestion = useCallback(async () => {
    const weight = parseFloat(form.weightTons);
    if (!form.pickupCountry || !form.deliveryCountry) {
      setSuggestion(null);
      return;
    }

    try {
      const res = await api.get('/loads/price-suggestion', {
        params: {
          truckType: form.truckTypeNeeded,
          pickupCountry: form.pickupCountry,
          deliveryCountry: form.deliveryCountry,
        },
      });
      if (res.data?.count > 0) {
        setSuggestion({ min: res.data.min, max: res.data.max, avg: res.data.avg, source: 'api' });
        return;
      }
    } catch (e) {
      // Fall through to formula
    }

    // Fallback formula
    const w = isNaN(weight) || weight <= 0 ? 10 : weight;
    const calc = calculateFallbackPrice(form.pickupCountry, form.deliveryCountry, w);
    setSuggestion({ ...calc, source: 'formula' });
  }, [form.pickupCountry, form.deliveryCountry, form.truckTypeNeeded, form.weightTons]);

  useEffect(() => {
    const timer = setTimeout(fetchSuggestion, 400);
    return () => clearTimeout(timer);
  }, [fetchSuggestion]);

  const validate = () => {
    if (!form.title.trim()) return 'Add a short title for this load.';
    if (!form.pickupCity.trim()) return 'Enter the pickup city.';
    if (!form.deliveryCity.trim()) return 'Enter the delivery city.';
    if (!form.weightTons || isNaN(parseFloat(form.weightTons))) return 'Enter the cargo weight in tons.';
    if (!form.offeredPrice || isNaN(parseFloat(form.offeredPrice))) return 'Enter your offered price.';
    return null;
  };

  const resetForm = () => setForm({
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

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Missing details', err); return; }
    setLoading(true);
    try {
      await api.post('/loads', {
        ...form,
        weightTons: parseFloat(form.weightTons),
        offeredPrice: parseFloat(form.offeredPrice),
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      resetForm();
      Alert.alert('Load posted', 'A broker will dispatch a verified truck shortly. We\'ll notify you when it happens.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Load not posted', formatApiError(e, "We couldn't post your load. Please try again.", 'load'));
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      set('offeredPrice')(String(suggestion.avg));
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
          <Text style={styles.headerTitle}>{isDuplicate ? 'Duplicate load' : 'Post a new load'}</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Scrollable form */}
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.introTitle}>{isDuplicate ? 'Review and post' : 'Tell us about your load'}</Text>
          <Text style={styles.introSubtitle}>
            {isDuplicate
              ? `Prefilled from your ${prefill?.pickupCity || 'previous'} load. Adjust anything that changed.`
              : 'Fill in the details — a broker will dispatch a verified truck.'}
          </Text>

          <Field label="Load title" value={form.title} onChangeText={set('title')} placeholder="e.g. Cement bags — Addis to Djibouti" />
          <Field label="Description or notes" value={form.description} onChangeText={set('description')} placeholder="Optional details about the cargo" multiline />

          <Field label="Pickup city" value={form.pickupCity} onChangeText={set('pickupCity')} placeholder="e.g. Addis Ababa" />
          <PickerRow label="Pickup country" value={form.pickupCountry} options={COUNTRIES} onChange={set('pickupCountry')} />

          <Field label="Delivery city" value={form.deliveryCity} onChangeText={set('deliveryCity')} placeholder="e.g. Djibouti City" />
          <PickerRow label="Delivery country" value={form.deliveryCountry} options={COUNTRIES} onChange={set('deliveryCountry')} />

          <PickerRow label="Truck type needed" value={form.truckTypeNeeded} options={TRUCK_TYPES} onChange={set('truckTypeNeeded')} />

          <Field label="Weight (tons)" value={form.weightTons} onChangeText={set('weightTons')} placeholder="e.g. 20" keyboardType="decimal-pad" />

          {/* Suggested price indicator */}
          {suggestion && (
            <View style={styles.suggestionCard}>
              <View style={styles.suggestionHeader}>
                <Text style={styles.suggestionTitle}>Suggested price</Text>
                <TouchableOpacity onPress={applySuggestion} style={styles.useBtn}>
                  <Text style={styles.useBtnText}>Use suggestion</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.suggestionRange}>
                ${suggestion.min.toLocaleString()} – ${suggestion.max.toLocaleString()} USD
              </Text>
              <Text style={styles.suggestionHint}>
                {suggestion.source === 'api'
                  ? 'Based on recent loads on similar routes.'
                  : 'Estimated from route distance and cargo weight.'}
              </Text>
            </View>
          )}

          <Field label="Offered price" value={form.offeredPrice} onChangeText={set('offeredPrice')} placeholder="e.g. 4500" keyboardType="decimal-pad" />
          <PickerRow label="Currency" value={form.currency} options={CURRENCIES} onChange={set('currency')} />

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Fixed submit button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <Text style={styles.submitText}>Posting your load…</Text>
              : <Text style={styles.submitText}>Post load</Text>
            }
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
  introTitle:     { fontSize: 20, fontWeight: '600', color: theme.text, marginBottom: 4 },
  introSubtitle:  { fontSize: 13, color: theme.textMuted, lineHeight: 20, marginBottom: 20 },
  fieldWrap:      { marginBottom: 16 },
  fieldLabel:     { fontSize: 11, fontWeight: '500', color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.9 },
  fieldInput:     { backgroundColor: theme.inputBg, borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '400', color: theme.inputText },
  chip:           { height: 36, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface2 },
  chipActive:     { backgroundColor: theme.accent },
  chipText:       { fontSize: 13, fontWeight: '500', color: theme.textMuted },
  chipTextActive: { color: theme.darkGreen },
  suggestionCard:   { backgroundColor: theme.accentDim, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: theme.accentBorder },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  suggestionTitle:  { fontSize: 13, fontWeight: '500', color: theme.accent },
  useBtn:           { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: theme.accent, borderRadius: 8 },
  useBtnText:       { fontSize: 11, fontWeight: '600', color: theme.darkGreen },
  suggestionRange:  { fontSize: 18, fontWeight: '500', color: theme.text, marginBottom: 4 },
  suggestionHint:   { fontSize: 11, color: theme.textMuted, fontWeight: '400' },
  footer:         { padding: 16, paddingBottom: 8, backgroundColor: theme.bg, borderTopWidth: 0.5, borderTopColor: theme.border },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
