import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useAuthStore } from "../../store/auth";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";
import * as SecureStore from "expo-secure-store";

export default function NewPasswordScreen({ route, navigation }: any) {
  const { firebaseIdToken, phone } = route?.params || {};
  const { setAuth } = useAuthStore();

  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPw) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", {
        firebaseIdToken,
        newPassword: password,
      });
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      Alert.alert("Success", "Password reset successfully");
    } catch (err: any) {
      Alert.alert("Reset failed", formatApiError(err, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper backgroundColor={theme.bg}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.header}>
            <Text style={styles.title}>New password</Text>
            <Text style={styles.subtitle}>Create a new password for {phone}</Text>
          </View>

          {/* New password */}
          <Text style={styles.label}>NEW PASSWORD *</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Confirm password */}
          <Text style={[styles.label, { marginTop: 20 }]}>CONFIRM PASSWORD *</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter your password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={confirmPw}
            onChangeText={setConfirmPw}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.darkGreen} />
              : <Text style={styles.btnText}>Reset Password</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:     { alignItems: "center", marginBottom: 36 },
  title:      { fontSize: 22, fontWeight: "500", color: theme.text },
  subtitle:   { fontSize: 14, color: theme.textMuted, marginTop: 4, textAlign: "center" },
  label:      { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:      { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.surface, fontWeight: "400", height: 52 },
  btn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 28 },
  btnDisabled:{ opacity: 0.7 },
  btnText:    { color: theme.darkGreen, fontSize: 13, fontWeight: "500" },
});
