import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useAuthStore } from "../../store/auth";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";
import * as SecureStore from "expo-secure-store";

const COUNTRIES = [
  { code: "+251", country: "Ethiopia", flag: "\u{1F1EA}\u{1F1F9}" },
  { code: "+252", country: "Somalia", flag: "\u{1F1F8}\u{1F1F4}" },
  { code: "+253", country: "Djibouti", flag: "\u{1F1E9}\u{1F1EF}" },
];

export default function LoginScreen({ navigation }: any) {
  const { setAuth } = useAuthStore();
  const [countryIdx, setCountryIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${COUNTRIES[countryIdx].code}${phone.replace(/^0+/, "")}`;
      const res = await api.post("/auth/login", { phone: fullPhone, password });
      await setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
    } catch (err: any) {
      Alert.alert("Login failed", formatApiError(err, "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper backgroundColor={theme.bg}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoSection}>
            <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
            <Text style={styles.brandName}>SAHID FREIGHT</Text>
            <Text style={styles.brandTagline}>MOVE CARGO ACROSS THE HORN</Text>
          </View>

          {/* Phone input */}
          <Text style={styles.label}>PHONE NUMBER</Text>
          <View style={styles.phoneRow}>
            <TouchableOpacity style={styles.dialBtn} onPress={() => setShowPicker(!showPicker)}>
              <Text style={styles.dialText}>{COUNTRIES[countryIdx].flag} {COUNTRIES[countryIdx].code}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{"\u25BC"}</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.phoneInput}
              placeholder="912345678"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {showPicker && (
            <View style={styles.dropdown}>
              {COUNTRIES.map((c, i) => (
                <TouchableOpacity
                  key={c.code}
                  style={styles.dropdownOption}
                  onPress={() => { setCountryIdx(i); setShowPicker(false); }}
                >
                  <Text style={styles.dropdownText}>{c.flag} {c.country} ({c.code})</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Password */}
          <Text style={[styles.label, { marginTop: 20 }]}>PASSWORD</Text>
          <View style={styles.pwRow}>
            <TextInput
              style={styles.pwInput}
              placeholder="Enter your password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
              <Text style={{ fontSize: 16 }}>{showPw ? "\u{1F648}" : "\u{1F441}"}</Text>
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.darkGreen} />
              : <Text style={styles.btnText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text style={styles.link}>Create one</Text>
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
  logoSection:   { alignItems: "center", marginBottom: 48 },
  logoImage:     { width: 80, height: 80, borderRadius: 20, marginBottom: 16 },
  brandName:     { fontSize: 22, fontWeight: "500", color: theme.text, letterSpacing: -0.5, marginBottom: 6 },
  brandTagline:  { fontSize: 11, color: theme.textMuted, letterSpacing: 0.9, fontWeight: "500", textTransform: "uppercase" },
  label:         { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  phoneRow:      { flexDirection: "row", borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: theme.surface, height: 52 },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRightWidth: 0.5, borderRightColor: theme.border },
  dialText:      { fontSize: 14, color: theme.text, fontWeight: "400" },
  phoneInput:    { flex: 1, fontSize: 15, color: theme.text, paddingHorizontal: 14, fontWeight: "400" },
  dropdown:      { backgroundColor: theme.surface, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, marginTop: 4, overflow: "hidden" },
  dropdownOption:{ paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  dropdownText:  { fontSize: 14, color: theme.text },
  pwRow:         { flexDirection: "row", borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: "hidden", alignItems: "center", backgroundColor: theme.surface, height: 52 },
  pwInput:       { flex: 1, fontSize: 15, color: theme.text, paddingHorizontal: 14, fontWeight: "400" },
  eyeBtn:        { paddingHorizontal: 14 },
  forgotRow:     { alignSelf: "flex-end", marginTop: 12 },
  forgotText:    { fontSize: 13, color: theme.accent, fontWeight: "400" },
  btn:           { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 28 },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: theme.darkGreen, fontSize: 13, fontWeight: "500" },
  divider:       { height: 1, backgroundColor: theme.border, marginVertical: 24 },
  footer:        { flexDirection: "row", justifyContent: "center" },
  footerText:    { fontSize: 13, color: theme.textMuted },
  link:          { fontSize: 13, color: theme.accent, fontWeight: "500" },
});
