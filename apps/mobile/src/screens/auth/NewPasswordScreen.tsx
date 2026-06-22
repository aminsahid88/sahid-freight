import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";

export default function NewPasswordScreen({ route, navigation }: any) {
  const { verificationToken, email } = route?.params || {};

  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const confirmPwRef = useRef<TextInput>(null);

  const clearError = (field: string) => {
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleReset = async () => {
    const newErrors: Record<string, string> = {};
    if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (password !== confirmPw) newErrors.confirmPw = "Passwords do not match";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    if (!verificationToken) {
      Alert.alert("Verification missing", "Please go back and verify your email again.");
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        verificationToken,
        newPassword: password,
      });
      Alert.alert(
        "Password reset",
        "Your password has been updated. Please sign in with your new password.",
        [{ text: "OK", onPress: () => navigation.navigate("Login") }],
      );
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = formatApiError(err, "Could not reset password.");
      if (status === 401) {
        Alert.alert(
          "Verification expired",
          msg,
          [{ text: "Start over", onPress: () => navigation.navigate("ForgotPassword") }],
        );
      } else {
        Alert.alert("Reset failed", msg);
      }
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
            <Text style={styles.title}>Create new password</Text>
            <Text style={styles.subtitle}>Reset password for{email ? ` ${email}` : " your account"}</Text>
          </View>

          <View style={styles.card}>
            {/* New password */}
            <Text style={styles.label}>NEW PASSWORD *</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : undefined]}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={t => { setPassword(t); clearError("password"); }}
              returnKeyType="next"
              onSubmitEditing={() => confirmPwRef.current?.focus()}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* Confirm password */}
            <Text style={[styles.label, { marginTop: 20 }]}>CONFIRM PASSWORD *</Text>
            <TextInput
              ref={confirmPwRef}
              style={[styles.input, errors.confirmPw ? styles.inputError : undefined]}
              placeholder="Re-enter your password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={confirmPw}
              onChangeText={t => { setConfirmPw(t); clearError("confirmPw"); }}
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
            {errors.confirmPw && <Text style={styles.errorText}>{errors.confirmPw}</Text>}

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
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:     { alignItems: "center", marginBottom: 28 },
  title:      { fontSize: 22, fontWeight: "500", color: theme.text },
  subtitle:   { fontSize: 14, color: theme.textMuted, marginTop: 4, textAlign: "center" },
  card:       { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: theme.border },
  label:      { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:      { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.bg, fontWeight: "400", height: 52 },
  inputError: { borderColor: theme.danger, borderWidth: 1 },
  errorText:  { fontSize: 12, color: theme.danger, marginTop: 4, fontWeight: "400" },
  btn:        { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 28 },
  btnDisabled:{ opacity: 0.7 },
  btnText:    { color: theme.darkGreen, fontSize: 15, fontWeight: "600" },
});
