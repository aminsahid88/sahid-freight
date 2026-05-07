import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  StatusBar, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { theme } from '../../theme';
import { formatApiError } from '../../lib/errors';

const MAX_PHOTOS = 4;

export default function ProofOfDeliveryScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });

    if (!result.canceled && result.assets) {
      setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      Alert.alert('Add photos', 'Please add at least one proof-of-delivery photo.');
      return;
    }

    setSubmitting(true);
    try {
      // TODO: POST /bookings/{id}/proof-of-delivery multipart
      // Expected shape: FormData with photos[] and optional notes field
      const formData = new FormData();
      photos.forEach((uri, i) => {
        const filename = uri.split('/').pop() || `pod_${i}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('photos', { uri, name: filename, type } as any);
      });
      if (notes.trim()) formData.append('notes', notes.trim());

      await api.post(`/bookings/${bookingId}/proof-of-delivery`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Submitted', 'Proof of delivery uploaded successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      // Endpoint may not exist yet — show the real error
      Alert.alert('Upload failed', formatApiError(e, 'Could not upload proof of delivery. The server may not support this yet.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Proof of delivery</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Take photos of the delivered cargo as proof. You can add up to {MAX_PHOTOS} photos.
        </Text>

        {/* Photo grid */}
        <View style={styles.grid}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <View style={styles.addPhotoWrap}>
              <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhoto} onPress={pickPhoto}>
                <Text style={styles.addPhotoIcon}>🖼</Text>
                <Text style={styles.addPhotoText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notes */}
        <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes about the delivery..."
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={500}
        />

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Submit button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || photos.length === 0) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting || photos.length === 0}
        >
          {submitting
            ? <ActivityIndicator color={theme.darkGreen} />
            : <Text style={styles.submitText}>Submit proof ({photos.length} photo{photos.length !== 1 ? 's' : ''})</Text>
          }
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText:      { fontSize: 15, color: theme.accent, fontWeight: '500' },
  headerTitle:   { fontSize: 15, fontWeight: '500', color: theme.text },
  content:       { padding: 16 },
  subtitle:      { fontSize: 13, color: theme.textMuted, lineHeight: 20, marginBottom: 20, fontWeight: '400' },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  photoWrap:     { width: '47%' as any, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photo:         { width: '100%', height: '100%' },
  removeBtn:     { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  addPhotoWrap:  { flexDirection: 'row', gap: 10 },
  addPhoto:      { flex: 1, aspectRatio: 1.2, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addPhotoIcon:  { fontSize: 28 },
  addPhotoText:  { fontSize: 13, color: theme.textMuted, fontWeight: '400' },
  fieldLabel:    { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8 },
  notesInput:    { backgroundColor: theme.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, height: 90, textAlignVertical: 'top', fontWeight: '400' },
  bottomBar:     { padding: 16, paddingBottom: 24, borderTopWidth: 0.5, borderTopColor: theme.border, backgroundColor: theme.bg },
  submitBtn:     { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText:    { color: theme.darkGreen, fontSize: 13, fontWeight: '500' },
});
