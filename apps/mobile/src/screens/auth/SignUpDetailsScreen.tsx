import React, { useState, useRef } from "react";
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

export default function SignUpDetailsScreen({ route, navigation }: any) {
  const { firebaseIdToken, phone } = route?.params || {};
  const { setAuth } = useAuthStore();

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [role, setRole] = useState("CARGO_SENDER");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordRef = useRef<TextInput>(null);
  const confirmPwRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  const clearError = (field: string) => {
    if (errors[field]) setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (password !== confirmPw) newErrors.confirmPw = "Passwords do not match";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        firebaseIdToken,
        fullName: fullName.trim(),
        password,
        role,
        city: city.trim() || undefined,
      });
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    } catch (err: any) {
      Alert.alert("Registration failed", formatApiError(err, "Could not create account."));
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
            <Text style={styles.subtitle}>Verified as {phone}</Text>
          </View>

          <View style={styles.card}>
            {/* Full name */}
            <Text style={styles.label}>FULL NAME *</Text>
            <TextInput
              style={[styles.input, errors.fullName ? styles.inputError : undefined]}
              placeholder="e.g. Ahmed Hassan"
              placeholderTextColor={theme.textMuted}
              value={fullName}
              onChangeText={t => { setFullName(t); clearError("fullName"); }}
              returnKeyType="next"
              onSubmitEditing={() => cityRef.current?.focus()}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

            {/* Role picker */}
            <Text style={[styles.label, { marginTop: 20 }]}>I AM A... *</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>
                      {r.label}
                    </Text>
                    <Text style={[styles.roleDesc, role === r.value && { color: theme.accent }]}>
                      {r.desc}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* City */}
            <Text style={[styles.label, { marginTop: 20 }]}>CITY</Text>
            <TextInput
              ref={cityRef}
              style={styles.input}
              placeholder="e.g. Addis Ababa"
              placeholderTextColor={theme.textMuted}
              value={city}
              onChangeText={setCity}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            {/* Password */}
            <Text style={[styles.label, { marginTop: 20 }]}>PASSWORD *</Text>
            <TextInput
              ref={passwordRef}
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
              onSubmitEditing={handleSubmit}
            />
            {errors.confirmPw && <Text style={styles.errorText}>{errors.confirmPw}</Text>}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={theme.darkGreen} />
                : <Text style={styles.btnText}>Create Account</Text>}
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
  label:           { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:           { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.bg, fontWeight: "400", height: 52 },
  inputError:      { borderColor: theme.danger, borderWidth: 1 },
  errorText:       { fontSize: 12, color: theme.danger, marginTop: 4, fontWeight: "400" },
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
