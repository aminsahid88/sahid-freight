import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity,
  RefreshControl, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import ScreenWrapper from '../../components/ScreenWrapper';
import { NotificationBell } from '../../components/NotificationBell';
import api from '../../lib/api';
import { formatPrice } from '../../lib/constants';
import { formatApiError } from '../../lib/errors';

// Light/airy locked palette — same as the broker dashboard.
const BG       = '#F8FAFC';
const NAVY     = '#0A1F44';
const BLUE     = '#3D7BFF';
const TEXT     = '#0A1F44';
const MUTED    = '#64748B';
const SUBTLE   = '#94A3B8';
const CARD     = '#FFFFFF';
const BORDER   = '#E2E8F0';
const TEAL_BG  = '#ECFDF5';
const TEAL_FG  = '#047857';
const TEAL_BD  = '#A7F3D0';
const AMBER_BG = '#FFF7ED';
const AMBER_FG = '#C2791A';
const AMBER_BD = '#FED7AA';
const DANGER   = '#DC2626';
const DANGER_BG = '#FEF2F2';

type ModalState =
  | { type: 'collect'; booking: any }
  | { type: 'payout';  booking: any }
  | null;

type Settlement = 'NEEDS_COLLECTION' | 'NEEDS_PAYOUT' | 'SETTLED' | 'IN_PROGRESS';

export default function BrokerEarningsScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/bookings/broker/my');
      setBookings(res.data?.bookings || []);
    } catch (err) {
      console.warn(formatApiError(err, 'Could not load your earnings.', 'payment'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(); }, [fetchAll]);

  // ── derived ─────────────────────────────────────────────────────────
  const enriched = useMemo(() => {
    return bookings
      .filter((b: any) => ['ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'DELIVERED'].includes(b.status))
      .map((b: any) => {
        const collected = !!b.brokerCollectedAt;
        const paid = !!b.ownerPaidOutAt;
        const done = b.status === 'COMPLETED' || b.status === 'DELIVERED';
        const settlement: Settlement =
          collected && paid ? 'SETTLED'
          : collected && !paid ? 'NEEDS_PAYOUT'
          : !collected && done ? 'NEEDS_COLLECTION'
          : 'IN_PROGRESS';
        // Sort priority — needs-action floats to top
        const priority =
          settlement === 'NEEDS_COLLECTION' ? 0
          : settlement === 'NEEDS_PAYOUT' ? 1
          : settlement === 'IN_PROGRESS' ? 2
          : 3;
        return { ...b, _settlement: settlement, _priority: priority };
      })
      .sort((a, b) => a._priority - b._priority);
  }, [bookings]);

  const stats = useMemo(() => {
    const earned = bookings
      .filter((b: any) => b.brokerCollectedAt && b.brokerCutAmount != null)
      .reduce((sum: number, b: any) => sum + Number(b.brokerCutAmount), 0);
    const owedCount = bookings
      .filter((b: any) => (b.status === 'COMPLETED' || b.status === 'DELIVERED') && !b.brokerCollectedAt)
      .length;
    const toPayOut = bookings
      .filter((b: any) => b.brokerCollectedAt && !b.ownerPaidOutAt && b.ownerPayoutAmount != null)
      .reduce((sum: number, b: any) => sum + Number(b.ownerPayoutAmount), 0);
    return { earned, owedCount, toPayOut };
  }, [bookings]);

  // ── actions ─────────────────────────────────────────────────────────
  const updateLocal = (id: string, patch: any) => {
    setBookings((prev: any[]) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <ScreenWrapper backgroundColor={BG}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NAVY} />}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topBarTitle}>Earnings</Text>
            <Text style={styles.topBarSub}>Track what you've collected and what you owe on every load.</Text>
          </View>
          <NotificationBell navigation={navigation} />
        </View>

        {/* Stat band */}
        <View style={styles.statBand}>
          <Stat
            label="EARNED"
            value={formatPrice(stats.earned, 'ETB')}
            tone="teal"
          />
          <View style={styles.statDivider} />
          <Stat
            label="OWED TO YOU"
            value={stats.owedCount === 0 ? '—' : `${stats.owedCount} job${stats.owedCount === 1 ? '' : 's'}`}
            tone={stats.owedCount > 0 ? 'amber' : 'subtle'}
          />
          <View style={styles.statDivider} />
          <Stat
            label="TO PAY OUT"
            value={stats.toPayOut > 0 ? formatPrice(stats.toPayOut, 'ETB') : '—'}
            tone={stats.toPayOut > 0 ? 'amber' : 'subtle'}
          />
        </View>

        {/* List */}
        {loading ? (
          <CardSkeleton />
        ) : enriched.length === 0 ? (
          <EmptyCard
            iconName="briefcase"
            title="No earnings yet"
            body="Once you dispatch loads, they'll show up here for you to settle."
          />
        ) : (
          enriched.map((b: any) => (
            <BookingRow
              key={b.id}
              booking={b}
              onCollect={() => setModal({ type: 'collect', booking: b })}
              onPayout={() => setModal({ type: 'payout', booking: b })}
            />
          ))
        )}
      </ScrollView>

      {/* Record-collection modal */}
      {modal?.type === 'collect' && (
        <CollectModal
          booking={modal.booking}
          onClose={() => setModal(null)}
          onSaved={(updated) => { updateLocal(updated.id, updated); setModal(null); }}
        />
      )}
      {/* Record-payout modal */}
      {modal?.type === 'payout' && (
        <PayoutModal
          booking={modal.booking}
          onClose={() => setModal(null)}
          onSaved={(updated) => { updateLocal(updated.id, updated); setModal(null); }}
        />
      )}
    </ScreenWrapper>
  );
}

/* ── components ────────────────────────────────────────────────────── */

function Stat({ label, value, tone }: { label: string; value: string; tone: 'teal' | 'amber' | 'subtle' }) {
  const color = tone === 'teal' ? TEAL_FG : tone === 'amber' ? AMBER_FG : SUBTLE;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.statLabel, { color: SUBTLE }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function BookingRow({
  booking, onCollect, onPayout,
}: { booking: any; onCollect: () => void; onPayout: () => void }) {
  const s: Settlement = booking._settlement;
  const cargoOwner = booking.load?.externalOwnerName || booking.load?.sender?.fullName || 'Cargo owner';
  const route = `${booking.load?.pickupCity || '—'} to ${booking.load?.deliveryCity || '—'}`;
  const rate = formatPrice(booking.agreedPrice, booking.currency || 'ETB');

  return (
    <View style={styles.row}>
      {/* Top — cargo + state pill */}
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{booking.load?.title || 'Load'}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>{route}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>For: {cargoOwner}</Text>
        </View>
        <StatePill settlement={s} />
      </View>

      {/* Money facts */}
      <View style={styles.moneyRow}>
        <MoneyLine label="Rate" value={rate} />
        {booking.brokerCutAmount != null && (
          <MoneyLine label="Your cut" value={formatPrice(booking.brokerCutAmount, booking.currency || 'ETB')} highlight />
        )}
        {booking.ownerPayoutAmount != null && (
          <MoneyLine label="Owner payout" value={formatPrice(booking.ownerPayoutAmount, booking.currency || 'ETB')} />
        )}
      </View>

      {/* Action */}
      <View style={{ marginTop: 14 }}>
        {s === 'NEEDS_COLLECTION' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={onCollect} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Record payment received</Text>
          </TouchableOpacity>
        )}
        {s === 'NEEDS_PAYOUT' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={onPayout} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Mark owner paid</Text>
          </TouchableOpacity>
        )}
        {s === 'SETTLED' && (
          <View style={styles.settledRow}>
            <Feather name="check-circle" size={14} color={TEAL_FG} style={{ marginRight: 6 }} />
            <Text style={styles.settledText}>Settled</Text>
          </View>
        )}
        {s === 'IN_PROGRESS' && (
          <View style={styles.inProgressRow}>
            <Text style={styles.inProgressText}>In progress — settle once delivered</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function StatePill({ settlement }: { settlement: Settlement }) {
  const map: Record<Settlement, { bg: string; fg: string; bd: string; label: string }> = {
    NEEDS_COLLECTION: { bg: AMBER_BG, fg: AMBER_FG, bd: AMBER_BD, label: 'COLLECT' },
    NEEDS_PAYOUT:     { bg: AMBER_BG, fg: AMBER_FG, bd: AMBER_BD, label: 'PAY OUT' },
    SETTLED:          { bg: TEAL_BG,  fg: TEAL_FG,  bd: TEAL_BD,  label: 'SETTLED' },
    IN_PROGRESS:      { bg: BG,       fg: MUTED,    bd: BORDER,   label: 'ACTIVE' },
  };
  const s = map[settlement];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.bd }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function MoneyLine({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.moneyLine}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, highlight && styles.moneyValueHighlight]}>{value}</Text>
    </View>
  );
}

function EmptyCard({ iconName, title, body }: { iconName: any; title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <Feather name={iconName} size={40} color={SUBTLE} style={{ marginBottom: 14 }} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function CardSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <View key={i} style={styles.skelCard}>
          <View style={[styles.skelLine, { width: '70%' }]} />
          <View style={{ height: 8 }} />
          <View style={[styles.skelLine, { width: '50%', height: 12 }]} />
          <View style={{ height: 16 }} />
          <View style={[styles.skelLine, { width: '100%', height: 36, borderRadius: 10 }]} />
        </View>
      ))}
    </>
  );
}

/* ── modals ────────────────────────────────────────────────────────── */

function CollectModal({ booking, onClose, onSaved }: { booking: any; onClose: () => void; onSaved: (b: any) => void }) {
  const [cut, setCut] = useState('');
  const [payout, setPayout] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const cutN = parseFloat(cut);
    if (!cut.trim() || !Number.isFinite(cutN) || cutN < 0) {
      setError('Enter your cut (a positive number).');
      return;
    }
    let payoutN: number | undefined;
    if (payout.trim()) {
      payoutN = parseFloat(payout);
      if (!Number.isFinite(payoutN) || payoutN < 0) {
        setError('Owner payout must be a positive number.');
        return;
      }
    }
    setLoading(true);
    try {
      const res = await api.patch(`/bookings/${booking.id}/record-collection`, {
        brokerCutAmount: cutN,
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
      });
      onSaved(res.data?.booking || { ...booking, brokerCutAmount: cutN, ownerPayoutAmount: payoutN ?? booking.ownerPayoutAmount, brokerCollectedAt: new Date().toISOString() });
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't record this payment.", 'payment'));
    } finally { setLoading(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record payment</Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              {booking.load?.title} · {formatPrice(booking.agreedPrice, booking.currency || 'ETB')}
            </Text>

            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>YOUR CUT (you keep)</Text>
            <TextInput
              style={styles.fieldInput}
              value={cut}
              onChangeText={setCut}
              placeholder="e.g. 5000"
              placeholderTextColor={SUBTLE}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>OWNER PAYOUT (optional)</Text>
            <TextInput
              style={styles.fieldInput}
              value={payout}
              onChangeText={setPayout}
              placeholder="What you owe the truck owner"
              placeholderTextColor={SUBTLE}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldHint}>You can leave this blank now and set it when you pay the owner.</Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Recording payment…</Text>
                  </>
                ) : (
                  <Text style={styles.confirmBtnText}>Record payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function PayoutModal({ booking, onClose, onSaved }: { booking: any; onClose: () => void; onSaved: (b: any) => void }) {
  const [payout, setPayout] = useState(booking.ownerPayoutAmount != null ? String(booking.ownerPayoutAmount) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    let payoutN: number | undefined;
    if (payout.trim()) {
      payoutN = parseFloat(payout);
      if (!Number.isFinite(payoutN) || payoutN < 0) {
        setError('Owner payout must be a positive number.');
        return;
      }
    }
    setLoading(true);
    try {
      const res = await api.patch(`/bookings/${booking.id}/record-payout`, {
        ...(payoutN !== undefined && { ownerPayoutAmount: payoutN }),
      });
      onSaved(res.data?.booking || {
        ...booking,
        ownerPayoutAmount: payoutN ?? booking.ownerPayoutAmount,
        ownerPaidOutAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(formatApiError(err, "We couldn't record this payout.", 'payment'));
    } finally { setLoading(false); }
  };

  const ownerName = booking.owner?.fullName || 'the truck owner';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Mark owner paid</Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              Paying {ownerName} for: {booking.load?.title}
            </Text>

            {!!error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>PAYOUT AMOUNT</Text>
            <TextInput
              style={styles.fieldInput}
              value={payout}
              onChangeText={setPayout}
              placeholder="e.g. 40000"
              placeholderTextColor={SUBTLE}
              keyboardType="decimal-pad"
              autoFocus={booking.ownerPayoutAmount == null}
            />
            <Text style={styles.fieldHint}>
              {booking.ownerPayoutAmount != null
                ? "Edit if needed, then tap 'Mark owner paid'."
                : "Enter what you're paying the owner."}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, loading && { opacity: 0.6 }]}
                onPress={submit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Recording payout…</Text>
                  </>
                ) : (
                  <Text style={styles.confirmBtnText}>Mark owner paid</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ── styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: BG },
  content:       { padding: 20, paddingBottom: 40 },

  topBar:        { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  topBarTitle:   { fontSize: 22, fontWeight: '700', color: TEXT, letterSpacing: -0.3 },
  topBarSub:     { fontSize: 13, color: MUTED, marginTop: 4, maxWidth: 280 },

  /* stat band */
  statBand:      { flexDirection: 'row', backgroundColor: CARD, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  statDivider:   { width: 1, backgroundColor: BORDER, alignSelf: 'stretch', marginHorizontal: 8 },
  statLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  statValue:     { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },

  /* row card */
  row:           { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: BORDER, shadowColor: NAVY, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  rowHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  rowTitle:      { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 3 },
  rowMeta:       { fontSize: 13, color: MUTED, marginBottom: 2 },
  rowSub:        { fontSize: 12, color: SUBTLE },

  pill:          { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  pillText:      { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  /* money rows */
  moneyRow:      { gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  moneyLine:     { flexDirection: 'row', justifyContent: 'space-between' },
  moneyLabel:    { fontSize: 13, color: MUTED },
  moneyValue:    { fontSize: 13, fontWeight: '500', color: TEXT },
  moneyValueHighlight: { color: TEAL_FG, fontWeight: '700' },

  /* action buttons */
  primaryBtn:    { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  settledRow:    { flexDirection: 'row', backgroundColor: TEAL_BG, borderColor: TEAL_BD, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  settledText:   { color: TEAL_FG, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  inProgressRow: { backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  inProgressText:{ color: MUTED, fontSize: 12, fontWeight: '500' },

  /* empty + skel */
  emptyCard:     { backgroundColor: CARD, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  emptyEmoji:    { fontSize: 44, marginBottom: 14 },
  emptyTitle:    { fontSize: 15, fontWeight: '600', color: TEXT, marginBottom: 6, textAlign: 'center' },
  emptyBody:     { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  skelCard:      { backgroundColor: CARD, borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  skelLine:      { height: 16, backgroundColor: '#F1F5F9', borderRadius: 6 },

  /* modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10,31,68,0.4)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 22, paddingBottom: 32 },
  modalHandle:   { width: 36, height: 4, backgroundColor: BORDER, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:    { fontSize: 17, fontWeight: '700', color: TEXT, marginBottom: 4 },
  modalSub:      { fontSize: 13, color: MUTED, marginBottom: 16 },
  errorBanner:   { backgroundColor: DANGER_BG, borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorBannerText: { color: DANGER, fontSize: 13 },
  fieldLabel:    { fontSize: 11, fontWeight: '700', color: SUBTLE, letterSpacing: 1, marginBottom: 6 },
  fieldInput:    { backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: TEXT, fontWeight: '500' },
  fieldHint:     { fontSize: 11, color: MUTED, marginTop: 6 },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:     { flex: 1, backgroundColor: BG, borderColor: BORDER, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { color: NAVY, fontSize: 14, fontWeight: '600' },
  confirmBtn:    { flex: 1.6, backgroundColor: BLUE, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  confirmBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
