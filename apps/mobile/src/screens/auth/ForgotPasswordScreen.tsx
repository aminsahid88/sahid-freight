import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { theme } from "../../theme";
import auth from "@react-native-firebase/auth";

const COUNTRIES = [
  { code: "+251", country: "Ethiopia", flag: "\u{1F1EA}\u{1F1F9}" },
  { code: "+252", country: "Somalia", flag: "\u{1F1F8}\u{1F1F4}" },
  { code: "+253", country: "Djibouti", flag: "\u{1F1E9}\u{1F1EF}" },
];

export default function ForgotPasswordScreen({ navigation }: any) {
  const [countryIdx, setCountryIdx] = useState(0);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const fullPhone = `${COUNTRIES[countryIdx].code}${phone.replace(/^0+/, "")}`;
      const confirmation = await auth().signInWithPhoneNumber(fullPhone);
      navigation.navigate("OTP", { confirmation, phone: fullPhone, flow: "reset" });
    } catch (err: any) {
      if (err.code === "auth/invalid-phone-number") {
        setError("Please check your phone number and try again.");
      } else if (err.code === "auth/too-many-requests") {
        Alert.alert("Too many attempts", "Please wait a few minutes before trying again.");
      } else {
        Alert.alert("Error", err.message || "Could not send verification code.");
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
            <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>Enter your phone number and we'll send you a verification code</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <View style={[styles.phoneRow, error ? styles.inputError : undefined]}>
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
                onChangeText={t => { setPhone(t); if (error) setError(""); }}
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : (
              <Text style={styles.helpText}>We'll send a 6-digit code via SMS</Text>
            )}

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

            {/* Submit */}
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
            <Text style={styles.link}>{"\u2190"} Back to sign in</Text>
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
  label:         { fontSize: 11, fontWeight: "500", color: theme.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: 10 },
  phoneRow:      { flexDirection: "row", borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: "hidden", backgroundColor: theme.bg, height: 52 },
  dialBtn:       { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRightWidth: 0.5, borderRightColor: theme.border },
  dialText:      { fontSize: 14, color: theme.text, fontWeight: "400" },
  phoneInput:    { flex: 1, fontSize: 15, color: theme.text, paddingHorizontal: 14, fontWeight: "400" },
  dropdown:      { backgroundColor: theme.surface, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, marginTop: 4, overflow: "hidden" },
  dropdownOption:{ paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  dropdownText:  { fontSize: 14, color: theme.text },
  inputError:    { borderColor: theme.danger, borderWidth: 1 },
  errorText:     { fontSize: 12, color: theme.danger, marginTop: 4, fontWeight: "400" },
  helpText:      { fontSize: 12, color: theme.textMuted, marginTop: 6, fontWeight: "400" },
  btn:           { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  btnDisabled:   { opacity: 0.7 },
  btnText:       { color: theme.darkGreen, fontSize: 15, fontWeight: "600" },
  backRow:       { alignItems: "center" },
  link:          { fontSize: 13, color: theme.accent, fontWeight: "500" },
});
