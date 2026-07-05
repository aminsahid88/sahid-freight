import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  StatusBar, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { formatApiError } from '../../lib/errors';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/auth';

// Per-role required document types
const ROLE_DOCS: Record<string, { type: string; label: string; required: boolean }[]> = {
  CARGO_SENDER: [
    { type: 'NATIONAL_ID', label: 'National ID or Passport', required: true },
    { type: 'TRADE_LICENSE', label: 'Business / Trade License', required: false },
  ],
  TRUCK_OWNER: [
    { type: 'NATIONAL_ID', label: 'National ID or Passport', required: true },
    { type: 'TRADE_LICENSE', label: 'Business / Trade License', required: false },
  ],
  DRIVER: [
    { type: 'NATIONAL_ID', label: 'National ID or Passport', required: true },
    { type: 'DRIVERS_LICENSE', label: "Driver's License", required: true },
    { type: 'PROFILE_PHOTO', label: 'Selfie / Profile Photo', required: true },
  ],
};

const PROFILE_TYPE_MAP: Record<string, string> = {
  CARGO_SENDER: 'SENDER',
  TRUCK_OWNER: 'TRUCK_OWNER',
  DRIVER: 'TRUCK_OWNER', // drivers are linked through truck owner flow
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: 'Under review', color: theme.warning,  bg: theme.warningDim },
  APPROVED: { label: 'Approved',     color: theme.accent,   bg: theme.accentDim },
  REJECTED: { label: 'Rejected',     color: theme.danger,   bg: theme.dangerDim },
};

export default function VerificationScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const role = user?.role || 'CARGO_SENDER';
  const requiredDocs = ROLE_DOCS[role] || ROLE_DOCS.CARGO_SENDER;
  const profileType = PROFILE_TYPE_MAP[role] || 'SENDER';

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.get('/uploads', { params: { profileType } });
      setDocs(res.data?.documents || []);
    } catch (e) {
      console.warn('Failed to fetch documents', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileType]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const onRefresh = () => { setRefreshing(true); fetchDocs(); };

  const getDocStatus = (docType: string) => {
    const found = docs.find((d: any) => d.documentType === docType);
    if (!found) return null;
    return found;
  };

  const pickAndUpload = async (docType: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to upload documents.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const filename = asset.uri.split('/').pop() || `${docType}.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = match ? `image/${match[1]}` : 'image/jpeg';

    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: filename, type: mimeType } as any);
      formData.append('documentType', docType);
      formData.append('profileType', profileType);

      await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchDocs();
      Alert.alert('Document uploaded', "We'll review it and let you know once your account is verified.");
    } catch (e) {
      Alert.alert('Upload failed', formatApiError(e, "We couldn't upload that document. Please try again.", 'profile'));
    } finally {
      setUploading(null);
    }
  };

  const allRequiredUploaded = requiredDocs
    .filter(d => d.required)
    .every(d => {
      const existing = getDocStatus(d.type);
      return existing && existing.status !== 'REJECTED';
    });

  const allApproved = requiredDocs
    .filter(d => d.required)
    .every(d => {
      const existing = getDocStatus(d.type);
      return existing?.status === 'APPROVED';
    });

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
      >
        {/* Status banner */}
        {allApproved ? (
          <View style={[styles.banner, { backgroundColor: theme.accentDim, borderColor: theme.accentBorder }]}>
            <Text style={[styles.bannerText, { color: theme.accent }]}>
              All documents approved. Your account is fully verified.
            </Text>
          </View>
        ) : allRequiredUploaded ? (
          <View style={[styles.banner, { backgroundColor: theme.blueDim, borderColor: theme.blue }]}>
            <Text style={[styles.bannerText, { color: theme.blue }]}>
              Documents submitted and under review. This usually takes 1-2 business days.
            </Text>
          </View>
        ) : (
          <View style={[styles.banner, { backgroundColor: theme.warningDim, borderColor: theme.warning }]}>
            <Text style={[styles.bannerText, { color: theme.warning }]}>
              Upload the required documents to verify your identity and start using all features.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>REQUIRED DOCUMENTS</Text>

        {loading ? (
          <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
        ) : (
          requiredDocs.map(doc => {
            const existing = getDocStatus(doc.type);
            const statusInfo = existing ? STATUS_CONFIG[existing.status] || STATUS_CONFIG.PENDING : null;
            const canUpload = !existing || existing.status === 'REJECTED';
            const isUploading = uploading === doc.type;

            return (
              <View key={doc.type} style={styles.docCard}>
                <View style={styles.docCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>
                      {doc.label}{doc.required ? ' *' : ''}
                    </Text>
                    {statusInfo ? (
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                      </View>
                    ) : (
                      <Text style={styles.docHint}>Not uploaded</Text>
                    )}
                    {existing?.status === 'REJECTED' && existing?.rejectionReason && (
                      <Text style={styles.rejectReason}>Reason: {existing.rejectionReason}</Text>
                    )}
                  </View>

                  {canUpload && (
                    <TouchableOpacity
                      style={[styles.uploadBtn, isUploading && { opacity: 0.5 }]}
                      onPress={() => pickAndUpload(doc.type)}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <ActivityIndicator color={theme.darkGreen} size="small" />
                      ) : (
                        <Text style={styles.uploadBtnText}>
                          {existing?.status === 'REJECTED' ? 'Re-upload' : 'Upload'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {existing?.status === 'APPROVED' && (
                    <View style={styles.approvedBadge}>
                      <Text style={{ color: theme.accent, fontSize: 16 }}>{'\u2713'}</Text>
                    </View>
                  )}

                  {existing?.status === 'PENDING' && (
                    <View style={styles.pendingIcon}>
                      <Text style={{ color: theme.warning, fontSize: 14 }}>{'\u23F3'}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText:       { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
  content:        { padding: 16 },
  banner:         { borderRadius: 12, padding: 14, borderWidth: 0.5, marginBottom: 20 },
  bannerText:     { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  sectionLabel:   { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 12 },
  docCard:        { backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 10 },
  docCardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  docLabel:       { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 4 },
  docHint:        { fontSize: 12, color: theme.textMuted, fontWeight: '400' },
  statusBadge:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  statusText:     { fontSize: 11, fontWeight: '600' },
  rejectReason:   { fontSize: 11, color: theme.danger, marginTop: 4, fontWeight: '400', lineHeight: 16 },
  uploadBtn:      { backgroundColor: theme.accent, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, minWidth: 80, alignItems: 'center' },
  uploadBtnText:  { color: theme.darkGreen, fontSize: 13, fontWeight: '600' },
  approvedBadge:  { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accentDim, alignItems: 'center', justifyContent: 'center' },
  pendingIcon:    { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.warningDim, alignItems: 'center', justifyContent: 'center' },
});
