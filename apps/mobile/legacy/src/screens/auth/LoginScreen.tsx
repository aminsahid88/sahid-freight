import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useAuthStore } from "../../store/auth";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import { theme } from "../../theme";

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
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    const newErrors: typeof errors = {};
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (!password) newErrors.password = "Password is required";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
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
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoSection}>
            <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />
            <Text style={styles.brandName}>Sahid Freight</Text>
            <Text style={styles.brandTagline}>Move cargo across the Horn of Africa</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            {/* Phone input */}
            <Text style={styles.label}>Phone number</Text>
            <View style={[styles.phoneRow, errors.phone ? styles.inputError : undefined]}>
              <TouchableOpacity style={styles.countryChip} onPress={() => setShowPicker(!showPicker)}>
                <Text style={styles.chipText}>{COUNTRIES[countryIdx].flag} {COUNTRIES[countryIdx].code}</Text>
                <Text style={styles.chipArrow}>{"\u25BC"}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder="912345678"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={t => { setPhone(t); if (errors.phone) setErrors(e => ({ ...e, phone: undefined })); }}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            {showPicker && (
              <View style={styles.dropdown}>
                {COUNTRIES.map((c, i) => (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.dropdownOption,
                      i === COUNTRIES.length - 1 && { borderBottomWidth: 0 },
                    ]}
                    onPress={() => { setCountryIdx(i); setShowPicker(false); }}
                  >
                    <Text style={styles.dropdownText}>{c.flag} {c.country} ({c.code})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Password */}
            <Text style={styles.labelSpaced}>Password</Text>
            <View style={[styles.pwRow, errors.password ? styles.inputError : undefined]}>
              <TextInput
                ref={passwordRef}
                style={styles.pwInput}
                placeholder="Enter your password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPw}
                value={password}
                onChangeText={t => { setPassword(t); if (errors.password) setErrors(e => ({ ...e, password: undefined })); }}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPw ? "\u{1F648}" : "\u{1F441}"}</Text>
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            {/* Forgot password */}
            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>
          </View>

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
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  /* Logo section */
  logoSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
    marginBottom: 16,
  },
  brandName: {
    fontSize: 26,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
  },

  /* Card */
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 24,
    textAlign: "center",
  },

  /* Labels */
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
    marginBottom: 8,
  },
  labelSpaced: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.textSecondary,
    marginBottom: 8,
    marginTop: 20,
  },

  /* Phone row */
  phoneRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: theme.bg,
    height: 50,
  },
  countryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: theme.surface2,
    borderRightWidth: 1,
    borderRightColor: theme.inputBorder,
  },
  chipText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "500",
  },
  chipArrow: {
    color: theme.textMuted,
    fontSize: 10,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: theme.inputText,
    paddingHorizontal: 14,
    fontWeight: "400",
  },

  /* Dropdown */
  dropdown: {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dropdownText: {
    fontSize: 14,
    color: theme.text,
  },

  /* Password row */
  pwRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    backgroundColor: theme.bg,
    height: 50,
  },
  pwInput: {
    flex: 1,
    fontSize: 15,
    color: theme.inputText,
    paddingHorizontal: 14,
    fontWeight: "400",
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  eyeIcon: {
    fontSize: 18,
  },

  /* Errors */
  inputError: {
    borderColor: theme.danger,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 12,
    color: theme.danger,
    marginTop: 4,
    fontWeight: "400",
  },

  /* Forgot password */
  forgotRow: {
    alignSelf: "flex-end",
    marginTop: 12,
  },
  forgotText: {
    fontSize: 13,
    color: theme.accent,
    fontWeight: "500",
  },

  /* Sign In button */
  btn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: theme.textMuted,
  },
  link: {
    fontSize: 14,
    color: theme.accent,
    fontWeight: "600",
  },
});
