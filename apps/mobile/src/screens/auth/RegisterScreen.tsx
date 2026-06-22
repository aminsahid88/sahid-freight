import React, { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";

const COUNTRIES = [
  { code: "+251", country: "Ethiopia", enumName: "ETHIOPIA", flag: "\u{1F1EA}\u{1F1F9}" },
  { code: "+252", country: "Somalia",  enumName: "SOMALIA",  flag: "\u{1F1F8}\u{1F1F4}" },
  { code: "+253", country: "Djibouti", enumName: "DJIBOUTI", flag: "\u{1F1E9}\u{1F1EF}" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: any) {
  const [countryIdx, setCountryIdx] = useState(0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const clearError = (field: string) => {
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (!EMAIL_RE.test(email.trim())) newErrors.email = "Enter a valid email";
    if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (password !== confirmPw) newErrors.confirmPw = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      await api.post("/auth/request-otp", { identifier: trimmedEmail, purpose: "REGISTER" });
      const fullPhone = `${COUNTRIES[countryIdx].code}${phone.replace(/^0+/, "")}`;
      navigation.navigate("OTP", {
        flow: "signup",
        email: trimmedEmail,
        phone: fullPhone,
        fullName: fullName.trim(),
        password,
        country: COUNTRIES[countryIdx].enumName,
      });
    } catch (err: any) {
      setErrors({ form: formatApiError(err, "Couldn't send the code, please try again.") });
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
            <Text style={styles.title}>Welcome to Sahid Freight</Text>
            <Text style={styles.subtitle}>Create an account to start moving cargo across the Horn of Africa</Text>
          </View>

          <View style={styles.card}>
            {!!errors.form && (
              <View style={styles.formError}>
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </View>
            )}

            {/* Full name */}
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={[styles.input, errors.fullName ? styles.inputError : undefined]}
              placeholder="e.g. Ahmed Hassan"
              placeholderTextColor={theme.textMuted}
              value={fullName}
              onChangeText={(t) => { setFullName(t); clearError("fullName"); }}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

            {/* Phone */}
            <Text style={[styles.label, { marginTop: 18 }]}>PHONE NUMBER</Text>
            <View style={[styles.phoneRow, errors.phone ? styles.inputError : undefined]}>
              <TouchableOpacity style={styles.dialBtn} onPress={() => setShowPicker(!showPicker)}>
                <Text style={styles.dialText}>{COUNTRIES[countryIdx].flag} {COUNTRIES[countryIdx].code}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>{"▼"}</Text>
              </TouchableOpacity>
              <TextInput
                ref={phoneRef}
                style={styles.phoneInput}
                placeholder="912345678"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => { setPhone(t); clearError("phone"); }}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            {showPicker && (
              <View style={styles.dropdown}>
                {COUNTRIES.map((c, i) => (
                  <TouchableOpacity key={c.code} style={styles.dropdownOption} onPress={() => { setCountryIdx(i); setShowPicker(false); }}>
                    <Text style={styles.dropdownText}>{c.flag} {c.country} ({c.code})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Email */}
            <Text style={[styles.label, { marginTop: 18 }]}>EMAIL</Text>
            <TextInput
              ref={emailRef}
              style={[styles.input, errors.email ? styles.inputError : undefined]}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => { setEmail(t); clearError("email"); }}
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
            />
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            {/* Password */}
            <Text style={[styles.label, { marginTop: 18 }]}>PASSWORD</Text>
            <TextInput
              ref={pwRef}
              style={[styles.input, errors.password ? styles.inputError : undefined]}
              placeholder="At least 8 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={(t) => { setPassword(t); clearError("password"); }}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* Confirm */}
            <Text style={[styles.label, { marginTop: 18 }]}>CONFIRM PASSWORD</Text>
            <TextInput
              ref={confirmRef}
              style={[styles.input, errors.confirmPw ? styles.inputError : undefined]}
              placeholder="Re-enter your password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={confirmPw}
              onChangeText={(t) => { setConfirmPw(t); clearError("confirmPw"); }}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            {errors.confirmPw && <Text style={styles.errorText}>{errors.confirmPw}</Text>}

            <Text style={styles.helpText}>We'll email you a 6-digit code to verify your account.</Text>

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleContinue} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.darkGreen} /> : <Text style={styles.btnText}>Continue</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.link}>Sign in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  scroll:        { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoImage:     { width: 90, height: 90, borderRadius: 22, marginBottom: 16 },
  header:        { alignItems: "center", marginBottom: 36 },
  title:         { fontSize: 22, fontWeight: "500", color: theme.text, textAlign: "center" },
  subtitle:      { fontSize: 14, color: theme.textMuted, marginTop: 6, textAlign: "center", lineHeight: 20 },
  card:          { backgroundColor: theme.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 0.5, borderColor: theme.border },
  formError:     { backgroundColor: "#fff5f5", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  formErrorText: { color: theme.danger, fontSize: 13 },
  label:         { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  input:         { borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: theme.text, backgroundColor: theme.bg, fontWeight: "400", height: 52 },
  phoneRow:      { flexDirection: "row", borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: theme.bg, height: 52 },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRightWidth: 0.5, borderRightColor: theme.border },
  dialText:      { fontSize: 14, color: theme.text, fontWeight: "400" },
  phoneInput:    { flex: 1, fontSize: 15, color: theme.text, paddingHorizontal: 14, fontWeight: "400" },
  dropdown:      { backgroundColor: theme.surface, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, marginTop: 4, overflow: "hidden" },
  dropdownOption:{ paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  dropdownText:  { fontSize: 14, color: theme.text },
  inputError:    { borderColor: theme.danger, borderWidth: 1 },
  errorText:     { fontSize: 12, color: theme.danger, marginTop: 4, fontWeight: "400" },
  helpText:      { fontSize: 12, color: theme.textMuted, marginTop: 14, fontWeight: "400", textAlign: "center" },
  btn:           { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: theme.darkGreen, fontSize: 15, fontWeight: "600" },
  footer:        { flexDirection: "row", justifyContent: "center" },
  footerText:    { fontSize: 13, color: theme.textMuted },
  link:          { fontSize: 13, color: theme.accent, fontWeight: "500" },
});
