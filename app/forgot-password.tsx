import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API; // Fallback to localhost for development

  const handleRequestOTP = async () => {

    if (!email) {
      return Alert.alert("Error", "Please enter your email.");
    }

    setLoading(true);

    try {

      const response = await fetch(`${API_BASE}/forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const result = await response.json();

      if (result.status === "success") {

        router.push({
          pathname: "/verify_otp",
          params: { email: email.toLowerCase() }
        });

      } else {
        Alert.alert("Error", result.message || "Failed to send OTP");
      }

    } catch (error) {
      Alert.alert("Connection Error", "Check internet connection.");
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      <TextInput
        style={styles.input}
        placeholder="Email Address"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleRequestOTP} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:25,justifyContent:'center',backgroundColor:'#f9f9f9'},
  title:{fontSize:24,fontWeight:'bold',marginBottom:20,textAlign:'center',color:'#333'},
  input:{backgroundColor:'#fff',padding:15,borderRadius:10,marginBottom:15,elevation:2,color:'#000',borderWidth:1,borderColor:'#eee'},
  button:{backgroundColor:'#e74c3c',padding:16,borderRadius:10,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'bold',fontSize:16}
});