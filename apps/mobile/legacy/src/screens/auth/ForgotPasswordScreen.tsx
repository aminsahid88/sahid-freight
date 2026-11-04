import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailRef = useRef<TextInput>(null);

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/request-otp", { identifier: trimmed, purpose: "RESET_PASSWORD" });
      navigation.navigate("OTP", { flow: "reset", email: trimmed });
    } catch (err: any) {
      setError(formatApiError(err, "Couldn't send the code, please try again."));
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
            <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send a 6-digit code to verify your account.</Text>
          </View>

          <View style={styles.card}>
            {!!error && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              ref={emailRef}
              style={[styles.input, error ? styles.inputError : undefined]}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => { setEmail(t); if (error) setError(""); }}
              returnKeyType="done"
              onSubmitEditing={handleSendCode}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={theme.darkGreen} />
                : <Text style={styles.btnText}>Send Code</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.backRow}>
            <Text style={styles.link}>{"←"} Back to sign in</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoImage:     { width: 70, height: 70, borderRadius: 18, marginBottom: 16 },
  header:        { alignItems: "center", marginBottom: 36 },
  title:         { fontSize: 22, fontWeight: "500", color: theme.text },
  subtitle:      { fontSize: 14, color: theme.textMuted, marginTop: 6, textAlign: "center", lineHeight: 20 },
  card:          { backgroundColor: theme.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 0.5, borderColor: theme.border },
  formError:     { backgroundColor: "#fff5f5", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  formErrorText: { color: theme.danger, fontSize: 13 },
  label:         { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:         { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.bg, fontWeight: "400", height: 52 },
  inputError:    { borderColor: theme.danger, borderWidth: 1 },
  btn:           { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: theme.darkGreen, fontSize: 15, fontWeight: "600" },
  backRow:       { alignItems: "center" },
  link:          { fontSize: 13, color: theme.accent, fontWeight: "500" },
});
