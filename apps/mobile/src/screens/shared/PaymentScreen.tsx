import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Linking, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
import { formatApiError } from '../../lib/errors';
import api from '../../lib/api';

export default function PaymentScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [waafiPhone, setWaafiPhone] = useState('');
  const [showWaafiInput, setShowWaafiInput] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const loadData = async () => {
    try {
      const [bRes, pRes] = await Promise.allSettled([
        api.get(`/bookings/${bookingId}`),
        api.get(`/payments/${bookingId}`),
      ]);
      if (bRes.status === 'fulfilled') setBooking(bRes.value.data.booking);
      if (pRes.status === 'fulfilled') setPayment(pRes.value.data.payment);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const initiatePayment = async (provider: string, phone?: string) => {
    setActionLoading(true);
    setStatusMsg('');
    try {
      const res = await api.post('/payments/initiate', { bookingId, provider, phone });
      const { payment: pmt, checkoutUrl, message } = res.data;
      setPayment(pmt);

      if (provider === 'CHAPA' && checkoutUrl) {
        await Linking.openURL(checkoutUrl);
        setStatusMsg("Finish paying in your browser, then tap \"I've paid — verify now\" below.");
        setStatusType('info');
      } else if (provider === 'WAAFI') {
        setStatusMsg(message || 'Check your phone for the EVC Plus / ZAAD prompt.');
        setStatusType('info');
        startPolling();
      } else if (provider === 'CASH') {
        setStatusMsg(message || 'Cash payment recorded.');
        setStatusType('success');
        setPayment({ ...pmt, status: 'COMPLETED' });
      }
    } catch (err) {
      setStatusMsg(formatApiError(err, "We couldn't start the payment. Please try again.", 'payment'));
      setStatusType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const verifyPayment = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/payments/verify', { bookingId });
      const pmt = res.data.payment;
      setPayment(pmt);
      if (pmt?.status === 'COMPLETED') {
        setStatusMsg('Payment confirmed.');
        setStatusType('success');
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setStatusMsg("We couldn't confirm your payment yet. Wait a moment and try again.");
        setStatusType('info');
      }
    } catch (err) {
      setStatusMsg(formatApiError(err, "We couldn't verify your payment. Please try again.", 'payment'));
      setStatusType('error');
    } finally {
      setActionLoading(false);
    }
  };

  const startPolling = () => {
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.post('/payments/verify', { bookingId });
        if (res.data.payment?.status === 'COMPLETED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setPayment(res.data.payment);
          setStatusMsg('Payment confirmed.');
          setStatusType('success');
        }
      } catch {}
      if (attempts >= 12) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 5000);
  };

  const handleCash = () => {
    Alert.alert(
      'Pay in cash?',
      "You'll settle with the driver directly on delivery. We'll mark this booking as paid in cash.",
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Confirm cash', onPress: () => initiatePayment('CASH') },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const isCompleted = payment?.status === 'COMPLETED';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Back">
          <Feather name="chevron-left" size={20} color={theme.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>LOAD</Text>
          <Text style={styles.summaryTitle} numberOfLines={2}>{booking?.load?.title || 'Load'}</Text>
          <Text style={styles.summaryRoute}>
            {booking?.load?.pickupCity} → {booking?.load?.deliveryCity}
          </Text>
          <View style={styles.summaryPriceRow}>
            <Text style={styles.summaryPriceLabel}>Amount due</Text>
            <Text style={styles.summaryPrice}>
              {formatPrice(booking?.agreedPrice, booking?.currency)}
            </Text>
          </View>
        </View>

        {/* Payment status */}
        {payment && (
          <View style={[styles.statusBanner, isCompleted ? styles.statusSuccess : payment.status === 'FAILED' ? styles.statusError : styles.statusInfo]}>
            <Feather
              name={isCompleted ? 'check-circle' : payment.status === 'FAILED' ? 'x-circle' : 'clock'}
              size={14}
              color={isCompleted ? theme.accent : payment.status === 'FAILED' ? theme.danger : theme.warning}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.statusBannerText}>
              {isCompleted ? 'Payment complete' : payment.status === 'FAILED' ? "Payment didn't go through" : 'Payment processing…'}
            </Text>
          </View>
        )}

        {/* Status message */}
        {statusMsg !== '' && (
          <View style={[styles.msgBanner, statusType === 'success' ? styles.msgSuccess : statusType === 'error' ? styles.msgError : styles.msgInfo]}>
            <Text style={styles.msgText}>{statusMsg}</Text>
          </View>
        )}

        {!isCompleted && (
          <>
            {/* Chapa card */}
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <View style={styles.methodIcon}>
                  <Feather name="credit-card" size={22} color={theme.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Pay with Chapa</Text>
                  <Text style={styles.methodSub}>Ethiopian Birr · TeleBirr, CBE, Awash Bank</Text>
                </View>
                <Text style={[styles.methodAmount, { color: theme.accent }]}>ETB</Text>
              </View>
              <TouchableOpacity
                style={[styles.methodBtn, { borderColor: theme.accentBorder, backgroundColor: theme.accentDim }]}
                onPress={() => initiatePayment('CHAPA')}
                disabled={actionLoading}
              >
                {actionLoading && payment?.provider === 'CHAPA' ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={[styles.methodBtnText, { color: theme.accent }]}>Pay with Chapa</Text>
                )}
              </TouchableOpacity>
              {payment?.provider === 'CHAPA' && payment?.status === 'PROCESSING' && (
                <TouchableOpacity style={styles.verifyBtn} onPress={verifyPayment} disabled={actionLoading}>
                  <Text style={styles.verifyBtnText}>
                    {actionLoading ? 'Checking your payment…' : "I've paid — verify now"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Waafi card */}
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <View style={styles.methodIcon}>
                  <Feather name="smartphone" size={22} color={theme.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Pay with Waafi</Text>
                  <Text style={styles.methodSub}>EVC Plus / Telesom ZAAD · USD</Text>
                </View>
                <Text style={[styles.methodAmount, { color: theme.blue }]}>USD</Text>
              </View>
              {!showWaafiInput ? (
                <TouchableOpacity
                  style={[styles.methodBtn, { borderColor: theme.blue, backgroundColor: theme.blueDim }]}
                  onPress={() => setShowWaafiInput(true)}
                  disabled={actionLoading}
                >
                  <Text style={[styles.methodBtnText, { color: theme.blue }]}>Enter your EVC Plus / ZAAD number</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="611 234 567"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                    value={waafiPhone}
                    onChangeText={setWaafiPhone}
                  />
                  <TouchableOpacity
                    style={[styles.methodBtn, { borderColor: theme.blue, backgroundColor: theme.blue, marginTop: 8 }]}
                    onPress={() => initiatePayment('WAAFI', waafiPhone)}
                    disabled={actionLoading || !waafiPhone.trim()}
                  >
                    {actionLoading && payment?.provider === 'WAAFI' ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.methodBtnText, { color: '#fff' }]}>Send payment prompt</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Cash card */}
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <View style={styles.methodIcon}>
                  <Feather name="dollar-sign" size={22} color={theme.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Pay in cash</Text>
                  <Text style={styles.methodSub}>Settle with the driver on delivery.</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.methodBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={handleCash}
                disabled={actionLoading}
              >
                <Text style={[styles.methodBtnText, { color: theme.textMuted }]}>Confirm cash arrangement</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isCompleted && (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={48} color={theme.accent} />
            </View>
            <Text style={styles.successTitle}>Payment received</Text>
            <Text style={styles.successSub}>
              Paid via {payment.provider} on {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}.
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Back to booking</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: theme.bg },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  backBtn:          { padding: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText:         { color: theme.accent, fontSize: 14, fontWeight: '500' },
  headerTitle:      { fontSize: 15, fontWeight: '500', color: theme.text },
  scroll:           { padding: 16, paddingBottom: 40 },
  summaryCard:      { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  summaryLabel:     { fontSize: 11, color: theme.textMuted, fontWeight: '500', letterSpacing: 0.9, marginBottom: 8, textTransform: 'uppercase' },
  summaryTitle:     { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 4 },
  summaryRoute:     { fontSize: 13, color: theme.textMuted, marginBottom: 16 },
  summaryPriceRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryPriceLabel:{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: '500' },
  summaryPrice:     { fontSize: 22, fontWeight: '500', color: theme.text },
  summaryCurrency:  { fontSize: 14, fontWeight: '400', color: theme.textMuted },
  statusBanner:     { borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusSuccess:    { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: theme.accentBorder },
  statusError:      { backgroundColor: theme.dangerDim, borderWidth: 0.5, borderColor: theme.danger },
  statusInfo:       { backgroundColor: theme.warningDim, borderWidth: 0.5, borderColor: theme.warning },
  statusBannerText: { fontSize: 13, fontWeight: '500', color: theme.text },
  msgBanner:        { borderRadius: 10, padding: 12, marginBottom: 12 },
  msgSuccess:       { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: theme.accentBorder },
  msgError:         { backgroundColor: theme.dangerDim, borderWidth: 0.5, borderColor: theme.danger },
  msgInfo:          { backgroundColor: theme.surface2, borderWidth: 0.5, borderColor: theme.border },
  msgText:          { fontSize: 13, color: theme.text, lineHeight: 18 },
  methodCard:       { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  methodHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  methodIcon:       { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface2 },
  methodTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 2 },
  methodSub:        { fontSize: 11, color: theme.textMuted },
  methodAmount:     { fontSize: 11, fontWeight: '500' },
  methodBtn:        { borderRadius: 10, borderWidth: 0.5, paddingVertical: 13, alignItems: 'center' },
  methodBtnText:    { fontSize: 13, fontWeight: '500' },
  verifyBtn:        { marginTop: 10, borderRadius: 10, borderWidth: 0.5, borderColor: theme.border, paddingVertical: 11, alignItems: 'center', backgroundColor: theme.surface },
  verifyBtnText:    { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  phoneInput:       { backgroundColor: theme.inputBg, borderRadius: 12, borderWidth: 0.5, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, fontWeight: '400' },
  successCard:      { alignItems: 'center', padding: 32 },
  successIcon:      { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentDim, marginBottom: 16 },
  successTitle:     { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 8 },
  successSub:       { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 28 },
  doneBtn:          { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 48 },
  doneBtnText:      { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
