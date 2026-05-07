import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  StatusBar, KeyboardAvoidingView, Platform, Linking, ActivityIndicator,
} from 'react-native';
import ScreenWrapper from '../../components/ScreenWrapper';
import api from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import { theme } from '../../theme';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route, navigation }: any) {
  const { userId: otherUserId, userName, bookingId, phone } = route.params || {};
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/messages/${otherUserId}`);
      setMessages(res.data?.messages || []);
      // Mark as read
      await api.patch(`/messages/read/${otherUserId}`);
    } catch (e) {
      console.warn('Fetch messages error', e);
    } finally {
      setLoading(false);
    }
  }, [otherUserId]);

  useEffect(() => {
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText('');
    try {
      await api.post('/messages', { receiverId: otherUserId, content, bookingId });
      await fetchMessages();
    } catch (e) {
      console.warn('Send error', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>{(userName || 'U')[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.headerName} numberOfLines={1}>{userName || 'Chat'}</Text>
          </View>
          {phone ? (
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
              <Text style={styles.callText}>📞</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Messages */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isMine = item.senderId === user?.id;
              return (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg },
  back:              { width: 44, alignItems: 'center' },
  backText:          { fontSize: 28, color: theme.accent, fontWeight: '400' },
  headerCenter:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar:      { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.darkGreen, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText:  { fontSize: 14, fontWeight: '500', color: theme.lightGreen },
  headerName:        { fontSize: 15, fontWeight: '500', color: theme.text, flex: 1 },
  callBtn:           { width: 44, alignItems: 'center', justifyContent: 'center' },
  callText:          { fontSize: 20 },
  list:              { padding: 12, paddingBottom: 8 },
  bubble:            { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 6 },
  bubbleMine:        { backgroundColor: theme.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleTheirs:      { backgroundColor: theme.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText:        { fontSize: 15, fontWeight: '400' },
  bubbleTextMine:    { color: theme.darkGreen },
  bubbleTextTheirs:  { color: theme.text },
  bubbleTime:        { fontSize: 11, marginTop: 3, alignSelf: 'flex-end' },
  bubbleTimeMine:    { color: 'rgba(23,52,4,0.5)' },
  bubbleTimeTheirs:  { color: theme.textMuted },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg, gap: 8 },
  input:             { flex: 1, backgroundColor: theme.surface, borderWidth: 0.5, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: theme.text, maxHeight: 100, fontWeight: '400' },
  sendBtn:           { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  sendText:          { color: theme.darkGreen, fontSize: 16 },
});
