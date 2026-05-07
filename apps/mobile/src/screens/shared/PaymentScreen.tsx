import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Linking, StatusBar,
} from 'react-native';
import { theme } from '../../theme';
import { formatPrice } from '../../lib/constants';
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
        setStatusMsg('Complete payment in browser, then tap "I\'ve completed payment" below.');
        setStatusType('info');
      } else if (provider === 'WAAFI') {
        setStatusMsg(message || 'Check your phone for EVC Plus / ZAAD prompt.');
        setStatusType('info');
        startPolling();
      } else if (provider === 'CASH') {
        setStatusMsg(message || 'Cash payment recorded successfully.');
        setStatusType('success');
        setPayment({ ...pmt, status: 'COMPLETED' });
      }
    } catch (err: any) {
      setStatusMsg(err?.response?.data?.message || 'Payment failed. Please try again.');
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
        setStatusMsg('Payment confirmed!');
        setStatusType('success');
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setStatusMsg('Not confirmed yet. Please wait and try again.');
        setStatusType('info');
      }
    } catch (err: any) {
      setStatusMsg(err?.response?.data?.message || 'Verification failed');
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
          setStatusMsg('Payment confirmed!');
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
      'Cash on Delivery',
      'Confirm cash payment arrangement with the driver?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => initiatePayment('CASH') },
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make Payment</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>DELIVERY</Text>
          <Text style={styles.summaryTitle} numberOfLines={2}>{booking?.load?.title || 'Freight Delivery'}</Text>
          <Text style={styles.summaryRoute}>
            {booking?.load?.pickupCity} → {booking?.load?.deliveryCity}
          </Text>
          <View style={styles.summaryPriceRow}>
            <Text style={styles.summaryPriceLabel}>Amount Due</Text>
            <Text style={styles.summaryPrice}>
              {formatPrice(booking?.agreedPrice, booking?.currency)}
            </Text>
          </View>
        </View>

        {/* Payment status */}
        {payment && (
          <View style={[styles.statusBanner, isCompleted ? styles.statusSuccess : payment.status === 'FAILED' ? styles.statusError : styles.statusInfo]}>
            <Text style={styles.statusBannerText}>
              {isCompleted ? '✓ Payment Completed' : payment.status === 'FAILED' ? '✗ Payment Failed' : '⏳ Payment Processing'}
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
                <Text style={styles.methodEmoji}>🏦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Pay with Chapa</Text>
                  <Text style={styles.methodSub}>Ethiopian Birr · TeleBirr, CBE, Awash Bank</Text>
                </View>
                <Text style={[styles.methodAmount, { color: theme.accent }]}>ETB</Text>
              </View>
              <TouchableOpacity
                style={[styles.methodBtn, { borderColor: 'rgba(151,196,89,0.4)', backgroundColor: theme.accentDim }]}
                onPress={() => initiatePayment('CHAPA')}
                disabled={actionLoading}
              >
                {actionLoading && payment?.provider === 'CHAPA' ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Text style={[styles.methodBtnText, { color: theme.accent }]}>Pay with Chapa →</Text>
                )}
              </TouchableOpacity>
              {payment?.provider === 'CHAPA' && payment?.status === 'PROCESSING' && (
                <TouchableOpacity style={styles.verifyBtn} onPress={verifyPayment} disabled={actionLoading}>
                  <Text style={styles.verifyBtnText}>
                    {actionLoading ? 'Verifying...' : "I've completed payment — Verify"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Waafi card */}
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <Text style={styles.methodEmoji}>📱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Pay with Waafi</Text>
                  <Text style={styles.methodSub}>EVC Plus / Telesom ZAAD · USD</Text>
                </View>
                <Text style={[styles.methodAmount, { color: theme.blue }]}>USD</Text>
              </View>
              {!showWaafiInput ? (
                <TouchableOpacity
                  style={[styles.methodBtn, { borderColor: 'rgba(55,138,221,0.4)', backgroundColor: 'rgba(55,138,221,0.1)' }]}
                  onPress={() => setShowWaafiInput(true)}
                  disabled={actionLoading}
                >
                  <Text style={[styles.methodBtnText, { color: theme.blue }]}>Enter EVC Plus / ZAAD Number</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="e.g. 0611234567"
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
                      <Text style={[styles.methodBtnText, { color: '#fff' }]}>Send Payment Request</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Cash card */}
            <View style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <Text style={styles.methodEmoji}>💵</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodTitle}>Cash on Delivery</Text>
                  <Text style={styles.methodSub}>Pay driver directly upon delivery</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.methodBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={handleCash}
                disabled={actionLoading}
              >
                <Text style={[styles.methodBtnText, { color: theme.textMuted }]}>Confirm Cash Arrangement</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isCompleted && (
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Payment Complete</Text>
            <Text style={styles.successSub}>
              Paid via {payment.provider} on {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A'}
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Done</Text>
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
  backBtn:          { padding: 4 },
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
  statusBanner:     { borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center' },
  statusSuccess:    { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: 'rgba(151,196,89,0.35)' },
  statusError:      { backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 0.5, borderColor: 'rgba(226,75,74,0.35)' },
  statusInfo:       { backgroundColor: 'rgba(239,159,39,0.1)', borderWidth: 0.5, borderColor: 'rgba(239,159,39,0.35)' },
  statusBannerText: { fontSize: 13, fontWeight: '500', color: theme.text },
  msgBanner:        { borderRadius: 10, padding: 12, marginBottom: 12 },
  msgSuccess:       { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: 'rgba(151,196,89,0.35)' },
  msgError:         { backgroundColor: 'rgba(226,75,74,0.1)', borderWidth: 0.5, borderColor: 'rgba(226,75,74,0.35)' },
  msgInfo:          { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: theme.border },
  msgText:          { fontSize: 13, color: theme.text, lineHeight: 18 },
  methodCard:       { backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  methodHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  methodEmoji:      { fontSize: 28 },
  methodTitle:      { fontSize: 15, fontWeight: '500', color: theme.text, marginBottom: 2 },
  methodSub:        { fontSize: 11, color: theme.textMuted },
  methodAmount:     { fontSize: 11, fontWeight: '500' },
  methodBtn:        { borderRadius: 10, borderWidth: 0.5, paddingVertical: 13, alignItems: 'center' },
  methodBtnText:    { fontSize: 13, fontWeight: '500' },
  verifyBtn:        { marginTop: 10, borderRadius: 10, borderWidth: 0.5, borderColor: theme.border, paddingVertical: 11, alignItems: 'center', backgroundColor: theme.surface },
  verifyBtnText:    { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  phoneInput:       { backgroundColor: theme.inputBg, borderRadius: 12, borderWidth: 0.5, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, fontWeight: '400' },
  successCard:      { alignItems: 'center', padding: 32 },
  successEmoji:     { fontSize: 56, marginBottom: 16 },
  successTitle:     { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 8 },
  successSub:       { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginBottom: 28 },
  doneBtn:          { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 48 },
  doneBtnText:      { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
