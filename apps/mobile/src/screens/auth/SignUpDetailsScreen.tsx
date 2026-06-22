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

const ROLES = [
  { value: "CARGO_SENDER", label: "Cargo Sender", icon: "\u{1F4E6}", desc: "I need to ship goods" },
  { value: "TRUCK_OWNER", label: "Truck Owner", icon: "\u{1F69A}", desc: "I own trucks and transport cargo" },
  { value: "DRIVER", label: "Driver", icon: "\u{1F3CE}", desc: "I drive trucks for owners" },
];

export default function SignUpDetailsScreen({ route }: any) {
  const params = route?.params || {};
  const { verificationToken, phone, fullName, password, country, email } = params;
  const { setAuth } = useAuthStore();

  const [role, setRole] = useState("CARGO_SENDER");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!verificationToken) {
      setError("Verification missing. Please go back and verify your email again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        verificationToken,
        phone,
        fullName,
        password,
        role,
        country,
        city: city.trim() || undefined,
      });
      // setAuth populates the auth store; AppNavigator reactively swaps to the role's stack.
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    } catch (err: any) {
      const msg = formatApiError(err, "Could not create account.");
      setError(msg);
      Alert.alert("Registration failed", msg);
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
            <Text style={styles.title}>Complete your profile</Text>
            <Text style={styles.subtitle}>Verified email{email ? `: ${email}` : ""}</Text>
          </View>

          <View style={styles.card}>
            {!!error && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>I AM A... *</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>{r.label}</Text>
                    <Text style={[styles.roleDesc, role === r.value && { color: theme.accent }]}>{r.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>CITY</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Addis Ababa"
              placeholderTextColor={theme.textMuted}
              value={city}
              onChangeText={setCity}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color={theme.darkGreen} /> : <Text style={styles.btnText}>Create Account</Text>}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { flexGrow: 1, justifyContent: "center", padding: 24 },
  header:          { alignItems: "center", marginBottom: 28 },
  title:           { fontSize: 22, fontWeight: "500", color: theme.text },
  subtitle:        { fontSize: 14, color: theme.accent, marginTop: 4, fontWeight: "500" },
  card:            { backgroundColor: theme.surface, borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: theme.border },
  formError:       { backgroundColor: "#fff5f5", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  formErrorText:   { color: theme.danger, fontSize: 13 },
  label:           { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:           { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.bg, fontWeight: "400", height: 52 },
  roleRow:         { gap: 10 },
  roleCard:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: theme.bg },
  roleCardActive:  { backgroundColor: theme.accentDim, borderWidth: 0.5, borderColor: theme.accentBorder },
  roleIcon:        { fontSize: 24 },
  roleLabel:       { fontSize: 13, fontWeight: "500", color: theme.textMuted, marginBottom: 2 },
  roleLabelActive: { color: theme.accent },
  roleDesc:        { fontSize: 11, color: theme.textMuted },
  btn:             { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 28 },
  btnDisabled:     { opacity: 0.7 },
  btnText:         { color: theme.darkGreen, fontSize: 15, fontWeight: "600" },
});
