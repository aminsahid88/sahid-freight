import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { formatApiError } from '../../lib/errors';
import { useAuthStore } from '../../store/auth';

const DOCS = [
  { key: 'id_front', label: 'National ID or passport', required: true },
  { key: 'selfie', label: 'Selfie holding your ID', required: true },
];

export default function VerificationScreen({ navigation }: any) {
  const { setAuth } = useAuthStore();
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pickPhoto = async (key: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => ({ ...prev, [key]: result.assets[0].uri }));
    }
  };

  const handleSubmit = async () => {
    const missing = DOCS.filter(d => d.required && !photos[d.key]);
    if (missing.length > 0) {
      Alert.alert('Missing documents', `Please upload: ${missing.map(d => d.label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      // TODO: POST /users/me/verification multipart
      const formData = new FormData();
      Object.entries(photos).forEach(([key, uri]) => {
        const filename = uri.split('/').pop() || `${key}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append(key, { uri, name: filename, type } as any);
      });

      await api.post('/users/me/verification', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmitted(true);

      // Update local user state
      try {
        const res = await api.get('/users/me');
        const u = res.data?.user || res.data;
        await setAuth(u, null);
      } catch {}
    } catch (e: any) {
      Alert.alert('Upload failed', formatApiError(e, 'Could not submit verification. The server may not support this yet.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <ScreenWrapper>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <View style={styles.successWrap}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
          <Text style={styles.successTitle}>Verification submitted</Text>
          <Text style={styles.successSub}>Your documents are under review. This usually takes 1-2 business days.</Text>
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.successBtnText}>Back to settings</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify your account</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Upload the required documents to verify your identity. This helps build trust on the platform.
        </Text>

        {DOCS.map(doc => {
          const uri = photos[doc.key];
          return (
            <TouchableOpacity key={doc.key} style={styles.docRow} onPress={() => pickPhoto(doc.key)}>
              {uri ? (
                <Image source={{ uri }} style={styles.docThumb} />
              ) : (
                <View style={styles.docPlaceholder}>
                  <Text style={{ fontSize: 24 }}>📄</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{doc.label}{doc.required ? ' *' : ''}</Text>
                <Text style={styles.docHint}>{uri ? 'Tap to change' : 'Tap to upload'}</Text>
              </View>
              {uri && (
                <TouchableOpacity onPress={() => setPhotos(prev => { const n = { ...prev }; delete n[doc.key]; return n; })}>
                  <Text style={styles.docRemove}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || Object.keys(photos).length < DOCS.filter(d => d.required).length) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting || Object.keys(photos).length < DOCS.filter(d => d.required).length}
        >
          {submitting
            ? <ActivityIndicator color={theme.darkGreen} />
            : <Text style={styles.submitText}>Submit for review</Text>
          }
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText:       { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
  content:        { padding: 16 },
  subtitle:       { fontSize: 13, color: theme.textMuted, lineHeight: 20, marginBottom: 20, fontWeight: '400' },
  docRow:         { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, padding: 14, marginBottom: 10, gap: 14 },
  docThumb:       { width: 56, height: 56, borderRadius: 10 },
  docPlaceholder: { width: 56, height: 56, borderRadius: 10, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
  docLabel:       { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 2 },
  docHint:        { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  docRemove:      { fontSize: 16, color: theme.danger, padding: 4 },
  bottomBar:      { padding: 16, paddingBottom: 24, borderTopWidth: 0.5, borderTopColor: theme.border, backgroundColor: theme.bg },
  submitBtn:      { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText:     { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
  successWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle:   { fontSize: 22, fontWeight: '500', color: theme.text, marginBottom: 8 },
  successSub:     { fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  successBtn:     { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32 },
  successBtnText: { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
