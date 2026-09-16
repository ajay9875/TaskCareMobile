import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function VerifyOTP() {

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { email } = useLocalSearchParams();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API; // Fallback to localhost for development

  const handleVerify = async () => {

    if (otp.length !== 6) {
      return Alert.alert("Invalid OTP", "Enter the 6 digit OTP.");
    }

    setLoading(true);

    try {

      const response = await fetch(`${API_BASE}/verify_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          otp: otp.trim()
        }),
      });

      const result = await response.json();

      if (result.status === "success") {

        router.push({
          pathname: "/reset_password",
          params: { email: email }
        });

      } else {
        Alert.alert("Verification Failed", result.message);
      }

    } catch (error) {
      Alert.alert("Error", "Network error");
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>

      <Text style={styles.desc}>
        Enter the 6-digit code sent to {email}
      </Text>

      <TextInput
        style={styles.otpInput}
        placeholder="000000"
        placeholderTextColor="#666"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleVerify}
        disabled={loading}
      >

        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Verify Code</Text>
        )}

      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:25,justifyContent:'center',backgroundColor:'#fff'},
  title:{fontSize:24,fontWeight:'bold',marginBottom:10,textAlign:'center'},
  desc:{textAlign:'center',marginBottom:25,color:'#666'},
  otpInput:{borderWidth:1,borderColor:'#ddd',padding:15,borderRadius:10,fontSize:28,letterSpacing:10,textAlign:'center',marginBottom:25},
  button:{backgroundColor:'#2ECC71',padding:16,borderRadius:10,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'bold',fontSize:16}
});