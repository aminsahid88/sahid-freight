import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { TRUCK_TYPES, COUNTRIES, CURRENCIES } from '../../lib/constants';

// Broker design language — locked light/airy palette.
const BG       = '#F8FAFC';
const NAVY     = '#0A1F44';
const BLUE     = '#3D7BFF';
const TEXT     = '#0A1F44';
const MUTED    = '#64748B';
const SUBTLE   = '#94A3B8';
const CARD     = '#FFFFFF';
const BORDER   = '#E2E8F0';
const DANGER   = '#DC2626';
const DANGER_BG = '#FEF2F2';

const PHONE_RE = /^\+?[0-9\s\-]{7,}$/;

export default function BrokerCreateLoadScreen({ navigation }: any) {
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
    currency: 'ETB',
    scheduledDate: '', // ISO date string; blank → default 7 days out at submit
    externalOwnerName: '',
    externalOwnerPhone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Cargo title is required.';
    if (!form.pickupCity.trim()) return 'Pickup city is required.';
    if (!form.deliveryCity.trim()) return 'Delivery city is required.';
    const w = parseFloat(form.weightTons);
    if (!form.weightTons.trim() || isNaN(w) || w <= 0) return 'Weight must be a positive number.';
    const p = parseFloat(form.offeredPrice);
    if (!form.offeredPrice.trim() || isNaN(p) || p <= 0) return 'Offered price must be a positive number.';
    if (!form.externalOwnerName.trim()) return 'Cargo owner name is required.';
    if (!PHONE_RE.test(form.externalOwnerPhone.trim())) return 'Enter a valid cargo owner phone.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);
    try {
      const scheduled = form.scheduledDate
        ? new Date(form.scheduledDate)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await api.post('/loads', {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        pickupCity: form.pickupCity.trim(),
        pickupCountry: form.pickupCountry,
        deliveryCity: form.deliveryCity.trim(),
        deliveryCountry: form.deliveryCountry,
        weightTons: parseFloat(form.weightTons),
        truckTypeNeeded: form.truckTypeNeeded,
        offeredPrice: parseFloat(form.offeredPrice),
        currency: form.currency,
        scheduledDate: scheduled.toISOString(),
        externalOwnerName: form.externalOwnerName.trim(),
        externalOwnerPhone: form.externalOwnerPhone.trim(),
      });
      Alert.alert(
        'Load posted',
        'Your load is now on the board. You can dispatch a truck for it from the dashboard.',
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      setError(formatApiError(e, 'Could not post load. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>New load</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* SECTION 1 — Cargo */}
          <SectionHeader title="Cargo" />
          <Card>
            <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="e.g. Cement bags – Addis to Djibouti" />
            <Field label="Description / notes" value={form.description} onChangeText={set('description')} placeholder="Optional details about the cargo…" multiline />
            <Field label="Weight (tons)" value={form.weightTons} onChangeText={set('weightTons')} placeholder="e.g. 20" keyboardType="decimal-pad" />
            <Picker label="Truck type needed" value={form.truckTypeNeeded} options={TRUCK_TYPES} onChange={set('truckTypeNeeded')} />
          </Card>

          {/* SECTION 2 — Route */}
          <SectionHeader title="Route" />
          <Card>
            <Field label="Pickup city" value={form.pickupCity} onChangeText={set('pickupCity')} placeholder="e.g. Addis Ababa" />
            <Picker label="Pickup country" value={form.pickupCountry} options={COUNTRIES} onChange={set('pickupCountry')} />
            <Field label="Delivery city" value={form.deliveryCity} onChangeText={set('deliveryCity')} placeholder="e.g. Djibouti City" />
            <Picker label="Delivery country" value={form.deliveryCountry} options={COUNTRIES} onChange={set('deliveryCountry')} />
          </Card>

          {/* SECTION 3 — Schedule & price */}
          <SectionHeader title="Schedule & price" />
          <Card>
            <Field
              label="Scheduled date (YYYY-MM-DD)"
              value={form.scheduledDate}
              onChangeText={set('scheduledDate')}
              placeholder="Leave blank for 1 week out"
            />
            <Field label="Offered price" value={form.offeredPrice} onChangeText={set('offeredPrice')} placeholder="e.g. 45000" keyboardType="decimal-pad" />
            <Picker label="Currency" value={form.currency} options={CURRENCIES} onChange={set('currency')} />
          </Card>

          {/* SECTION 4 — Cargo owner (broker-specific) */}
          <SectionHeader title="Who is this cargo for?" />
          <Text style={styles.sectionCaption}>The real cargo owner — usually someone who doesn't have a Sahid Freight account.</Text>
          <Card>
            <Field
              label="Cargo owner name"
              value={form.externalOwnerName}
              onChangeText={set('externalOwnerName')}
              placeholder="e.g. Ahmed Hassan"
            />
            <Field
              label="Cargo owner phone"
              value={form.externalOwnerPhone}
              onChangeText={set('externalOwnerPhone')}
              placeholder="+251 911 000 000"
              keyboardType="phone-pad"
            />
          </Card>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Footer submit */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitText}>Post load</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

/* ── sub-components ───────────────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 88, textAlignVertical: 'top', paddingTop: 12 }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SUBTLE}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function Picker({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, value === opt && styles.chipActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
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

/* ── styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  /* top bar */
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  cancel:        { fontSize: 15, color: BLUE, fontWeight: '600', minWidth: 56 },
  topBarTitle:   { fontSize: 16, fontWeight: '600', color: TEXT },

  content:       { padding: 20, paddingBottom: 32 },

  /* error banner */
  errorBanner:   { backgroundColor: DANGER_BG, borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBannerText: { color: DANGER, fontSize: 13, lineHeight: 18 },

  /* sections */
  sectionHeader: { fontSize: 11, fontWeight: '700', color: SUBTLE, letterSpacing: 1.2, marginTop: 4, marginBottom: 10, textTransform: 'uppercase' },
  sectionCaption:{ fontSize: 12, color: MUTED, marginTop: -4, marginBottom: 10, maxWidth: 320 },

  /* card */
  card:          { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },

  /* field */
  fieldWrap:     { marginBottom: 14 },
  fieldLabel:    { fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldInput:    { backgroundColor: BG, borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: TEXT },

  /* chip / picker */
  chip:          { height: 36, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: BG, borderWidth: 1, borderColor: BORDER },
  chipActive:    { backgroundColor: NAVY, borderColor: NAVY },
  chipText:      { fontSize: 12, color: MUTED, fontWeight: '500' },
  chipTextActive:{ color: '#FFFFFF', fontWeight: '600' },

  /* footer */
  footer:        { padding: 16, paddingBottom: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: BORDER },
  submitBtn:     { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText:    { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
