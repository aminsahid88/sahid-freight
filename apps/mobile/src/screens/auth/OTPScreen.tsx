import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, StatusBar,
} from "react-native";
import ScreenWrapper from "../../components/ScreenWrapper";
import { OtpInput } from "../../components/OtpInput";
import { theme } from "../../theme";
import api from "../../lib/api";
import { formatApiError } from "../../lib/errors";
import auth from "@react-native-firebase/auth";

export default function OTPScreen({ route, navigation }: any) {
  const params = route?.params || {};
  const {
    confirmation: initialConfirmation,
    flow,
    phone,
    email,
    fullName,
    password,
    country,
  } = params;

  const confirmationRef = useRef(initialConfirmation);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = async (code: string) => {
    if (code.length < 6) {
      Alert.alert("Error", "Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      if (flow === "signup") {
        const res = await api.post("/auth/verify-otp", {
          identifier: email,
          code,
          purpose: "REGISTER",
        });
        navigation.navigate("SignUpDetails", {
          verificationToken: res.data.verificationToken,
          phone, fullName, password, country, email,
        });
      } else if (flow === "reset") {
        await confirmationRef.current.confirm(code);
        const idToken = await auth().currentUser?.getIdToken();
        navigation.navigate("NewPassword", { firebaseIdToken: idToken, phone });
      }
    } catch (err: any) {
      if (flow === "signup") {
        Alert.alert("Verification failed", formatApiError(err, "Incorrect code. Please try again."));
      } else if (err.code === "auth/invalid-verification-code") {
        Alert.alert("Invalid code", "The code you entered is incorrect. Please try again.");
      } else if (err.code === "auth/session-expired") {
        Alert.alert("Code expired", "The verification code has expired. Please request a new one.");
      } else {
        Alert.alert("Verification failed", err.message || "Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    try {
      if (flow === "signup") {
        await api.post("/auth/request-otp", { identifier: email, purpose: "REGISTER" });
        setResendTimer(60);
        Alert.alert("Code sent", "A new code has been sent to your email.");
      } else if (flow === "reset") {
        const newConfirmation = await auth().signInWithPhoneNumber(phone);
        confirmationRef.current = newConfirmation;
        setResendTimer(60);
        Alert.alert("Code sent", "A new verification code has been sent.");
      }
    } catch (err: any) {
      Alert.alert("Error", formatApiError(err, "Could not resend code."));
    } finally {
      setResending(false);
    }
  };

  const sentToLabel = flow === "signup" ? (email || "your email") : (phone || "your phone");
  const screenTitle = flow === "signup" ? "Verify your email" : "Verify your number";

  return (
    <ScreenWrapper backgroundColor={theme.bg}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <View style={styles.root}>

        <Image source={require('../../../assets/logo.png')} style={styles.logoImage} />

        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{"\n"}
          <Text style={styles.phoneHighlight}>{sentToLabel}</Text>
        </Text>

        <View style={styles.card}>
          <OtpInput length={6} onComplete={handleVerify} />

          {loading && (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 24 }} />
          )}
        </View>

        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={styles.resendMuted}>Resend code in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>{resending ? "Sending..." : "Resend code"}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.back}>{"←"} Back</Text>
        </TouchableOpacity>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  logoImage:      { width: 70, height: 70, borderRadius: 18, marginBottom: 28 },
  title:          { fontSize: 22, fontWeight: "500", color: theme.text, marginBottom: 8 },
  subtitle:       { fontSize: 14, color: theme.textMuted, textAlign: "center", marginBottom: 36, lineHeight: 22 },
  phoneHighlight: { color: theme.text, fontWeight: "500" },
  card:           { backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: "100%", borderWidth: 0.5, borderColor: theme.border, alignItems: "center" },
  resendRow:      { marginTop: 28, alignItems: "center" },
  resendMuted:    { fontSize: 13, color: theme.textMuted, fontWeight: "400" },
  resendLink:     { fontSize: 13, color: theme.accent, fontWeight: "500" },
  backBtn:        { marginTop: 20 },
  back:           { color: theme.textMuted, fontSize: 14 },
});
