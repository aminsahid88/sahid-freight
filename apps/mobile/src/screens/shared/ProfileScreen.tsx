import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, Switch, Modal, Linking,
  RefreshControl,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import { useAuthStore } from '../../store/auth';
import { useThemeStore } from '../../store/themeStore';
import api from '../../lib/api';
import { theme } from '../../theme';
import { NotificationBell } from '../../components/NotificationBell';

// ── Row components ─────────────────────────────

function SettingRow({ label, value, onPress, rightEl, danger = false, last = false, disabled = false, comingSoon = false, external = false }: any) {
  return (
    <TouchableOpacity
      style={[sRow.row, last && { borderBottomWidth: 0 }, disabled && { opacity: 0.45 }]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={onPress && !disabled ? 0.65 : 1}
      disabled={!onPress || disabled}
    >
      <Text style={[sRow.label, danger && { color: theme.danger }]}>{label}</Text>
      {comingSoon ? (
        <View style={sRow.comingSoon}><Text style={sRow.comingSoonText}>Coming soon</Text></View>
      ) : rightEl ?? (
        external ? <Text style={sRow.chevron}>↗</Text> :
        value ? <Text style={sRow.value}>{value}</Text> : <Text style={sRow.chevron}>›</Text>
      )}
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }: any) {
  return (
    <View style={sec.wrap}>
      {title ? <Text style={sec.title}>{title.toUpperCase()}</Text> : null}
      <View style={sec.card}>{children}</View>
    </View>
  );
}

// ── Main component ─────────────────────────────

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, setAuth } = useAuthStore();
  const { isDark, setMode } = useThemeStore();
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    city: user?.city || '',
  });
  const [changePwModal, setChangePwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [lang, setLang] = useState<'EN' | 'AM' | 'SO'>(user?.preferredLanguage || 'EN');

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/users/me');
      const u = res.data?.user || res.data;
      setForm({ fullName: u.fullName || '', email: u.email || '', city: u.city || '' });
      await setAuth(u, null);
    } catch (e) {
      console.warn('Profile fetch failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [setAuth]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onRefresh = () => { setRefreshing(true); fetchProfile(); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/users/me', form);
      const u = res.data?.user || res.data;
      await setAuth(u, null);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePw = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      Alert.alert('Missing Fields', 'Please fill in all password fields.'); return;
    }
    if (pwForm.next !== pwForm.confirm) {
      Alert.alert('Mismatch', 'New passwords do not match.'); return;
    }
    setSavingPw(true);
    try {
      await api.patch('/users/me/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      setChangePwModal(false);
      setPwForm({ current: '', next: '', confirm: '' });
      Alert.alert('Done', 'Password changed successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/users/me');
              logout();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message || 'Could not delete account.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabelMap: Record<string, string> = {
    CARGO_SENDER: 'Cargo Sender',
    TRUCK_OWNER: 'Truck Owner',
    DRIVER: 'Driver',
    ADMIN: 'Admin',
  };
  const displayName = user?.fullName || 'User';
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Settings</Text>
        <NotificationBell navigation={navigation} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.avatarName}>{displayName}</Text>
          <Text style={styles.avatarPhone}>{user?.phone}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{roleLabelMap[user?.role || ''] || user?.role}</Text>
          </View>
          {user?.averageRating ? (
            <Text style={styles.rating}>⭐ {user.averageRating.toFixed(1)} ({user.totalRatings} reviews)</Text>
          ) : null}
        </View>

        {/* Personal Info */}
        <SectionCard title="Personal Info">
          <View style={sRow.inputWrap}>
            <Text style={sRow.inputLabel}>Full Name</Text>
            <TextInput
              style={sRow.input}
              value={form.fullName}
              onChangeText={v => setForm(f => ({ ...f, fullName: v }))}
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <View style={sRow.inputWrap}>
            <Text style={sRow.inputLabel}>Email</Text>
            <TextInput
              style={sRow.input}
              value={form.email}
              onChangeText={v => setForm(f => ({ ...f, email: v }))}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <View style={sRow.inputWrap}>
            <Text style={sRow.inputLabel}>Phone</Text>
            <Text style={sRow.readOnly}>{user?.phone}</Text>
          </View>
          <View style={[sRow.inputWrap, { borderBottomWidth: 0 }]}>
            <Text style={sRow.inputLabel}>City</Text>
            <TextInput
              style={sRow.input}
              value={form.city}
              onChangeText={v => setForm(f => ({ ...f, city: v }))}
              placeholderTextColor={theme.textMuted}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={theme.darkGreen} size="small" />
              : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account">
          <SettingRow
            label="Verification status"
            onPress={user?.isVerified ? undefined : () => navigation.navigate('Verification')}
            rightEl={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={[
                  styles.verBadge,
                  { backgroundColor: user?.isVerified ? theme.accentDim : 'rgba(239,159,39,0.1)' },
                ]}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: user?.isVerified ? theme.accent : theme.warning }}>
                    {user?.isVerified ? '✓ Verified' : '⏳ Verify now'}
                  </Text>
                </View>
              </View>
            }
          />
          <SettingRow label="Change Password" onPress={() => setChangePwModal(true)} />
          <SettingRow
            label="Language"
            last
            rightEl={
              <View style={styles.langRow}>
                {(['EN', 'AM', 'SO'] as const).map(l => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.langBtn, lang === l && styles.langBtnActive]}
                    onPress={() => setLang(l)}
                  >
                    <Text style={[styles.langText, lang === l && styles.langTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            }
          />
        </SectionCard>

        {/* Notifications */}
        <SectionCard title="Notifications">
          <SettingRow
            label="Push Notifications"
            rightEl={
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.bg}
              />
            }
          />
          <SettingRow
            label="SMS Notifications"
            last
            rightEl={
              <Switch
                value={smsEnabled}
                onValueChange={setSmsEnabled}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.bg}
              />
            }
          />
        </SectionCard>

        {/* Appearance */}
        <SectionCard title="Appearance">
          <SettingRow
            label="Dark Mode"
            last
            rightEl={
              <Switch
                value={isDark}
                onValueChange={(v) => setMode(v ? 'dark' : 'light')}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor={theme.bg}
              />
            }
          />
        </SectionCard>

        {/* Support */}
        <SectionCard title="Support">
          <SettingRow label="Help Center" disabled comingSoon />
          <SettingRow label="Report a Problem" external onPress={() => Linking.openURL('mailto:support@sahidfreight.com')} />
          <SettingRow label="Rate the App" disabled comingSoon />
          <SettingRow label="Privacy Policy" disabled comingSoon />
          <SettingRow label="Terms of Service" last disabled comingSoon />
        </SectionCard>

        {/* Account Actions */}
        <SectionCard title="Account Actions">
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
            <Text style={styles.deleteText}>Delete Account</Text>
          </TouchableOpacity>
        </SectionCard>

        <Text style={styles.version}>Sahid Freight v1.0.0</Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal visible={changePwModal} transparent animationType="slide">
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <Text style={modal.title}>Change Password</Text>
            <TextInput
              style={modal.input}
              placeholder="Current password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={pwForm.current}
              onChangeText={v => setPwForm(f => ({ ...f, current: v }))}
            />
            <TextInput
              style={modal.input}
              placeholder="New password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={pwForm.next}
              onChangeText={v => setPwForm(f => ({ ...f, next: v }))}
            />
            <TextInput
              style={modal.input}
              placeholder="Confirm new password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={pwForm.confirm}
              onChangeText={v => setPwForm(f => ({ ...f, confirm: v }))}
            />
            <TouchableOpacity
              style={[modal.btn, savingPw && { opacity: 0.6 }]}
              onPress={handleChangePw}
              disabled={savingPw}
            >
              {savingPw
                ? <ActivityIndicator color={theme.darkGreen} />
                : <Text style={modal.btnText}>Update Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={modal.cancel}
              onPress={() => { setChangePwModal(false); setPwForm({ current: '', next: '', confirm: '' }); }}
            >
              <Text style={modal.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

// ── Styles ─────────────────────────────────────

const styles = StyleSheet.create({
  headerBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle:   { fontSize: 22, fontWeight: '500', color: theme.text },
  avatarSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatarCircle:  { width: 90, height: 90, borderRadius: 45, backgroundColor: theme.darkGreen, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:    { fontSize: 36, fontWeight: '500', color: theme.lightGreen },
  avatarName:    { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 4 },
  avatarPhone:   { fontSize: 14, color: theme.textMuted, marginBottom: 10 },
  rolePill:      { backgroundColor: theme.accentDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  roleText:      { fontSize: 13, fontWeight: '500', color: theme.accent },
  rating:        { fontSize: 13, color: theme.textMuted, marginTop: 8 },
  saveBtn:       { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', margin: 12 },
  saveBtnText:   { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  verBadge:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  langRow:       { flexDirection: 'row', gap: 6 },
  langBtn:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.06)' },
  langBtnActive: { backgroundColor: theme.accent },
  langText:      { fontSize: 11, fontWeight: '500', color: theme.textMuted },
  langTextActive: { color: theme.darkGreen },
  logoutBtn:     { backgroundColor: 'rgba(226,75,74,0.08)', borderRadius: 10, padding: 14, alignItems: 'center', margin: 12, marginBottom: 6, borderWidth: 0.5, borderColor: 'rgba(226,75,74,0.35)' },
  logoutText:    { color: theme.danger, fontSize: 15, fontWeight: '500' },
  deleteBtn:     { padding: 14, alignItems: 'center', marginHorizontal: 12 },
  deleteText:    { color: theme.danger, fontSize: 14, fontWeight: '500' },
  version:       { textAlign: 'center', fontSize: 11, color: theme.textMuted, paddingVertical: 16 },
});

const sRow = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  label:      { fontSize: 15, color: theme.text, fontWeight: '400' },
  value:      { fontSize: 14, color: theme.textMuted },
  chevron:    { fontSize: 18, color: theme.textMuted },
  comingSoon: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  comingSoonText: { fontSize: 11, color: theme.textMuted, fontWeight: '400' },
  inputWrap:  { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  inputLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 4 },
  input:      { fontSize: 15, color: theme.text, paddingVertical: 2, backgroundColor: theme.inputBg, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, marginTop: 4, fontWeight: '400' },
  readOnly:   { fontSize: 15, color: theme.textMuted },
});

const sec = StyleSheet.create({
  wrap:  { paddingHorizontal: 16, marginBottom: 16 },
  title: { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8, marginLeft: 4 },
  card:  { backgroundColor: theme.surface, borderRadius: 14, overflow: 'hidden', padding: 0 },
});

const modal = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: 0.5, borderColor: theme.border },
  title:      { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 20, textAlign: 'center' },
  input:      { backgroundColor: theme.inputBg, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.text, marginBottom: 12, fontWeight: '400' },
  btn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  btnText:    { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  cancel:     { padding: 14, alignItems: 'center' },
  cancelText: { color: theme.textMuted, fontSize: 15 },
});
