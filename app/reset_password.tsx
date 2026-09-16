import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from "@expo/vector-icons"; // Add this import for eye icon

export default function ResetPassword() {

  const [password, setPassword] = useState('');
  const [cpassword, setCpassword] = useState('');
  const [loading, setLoading] = useState(false);
  // FIXED: Both states must be defined
  const [isPVisible, setIsPVisible] = useState(false); 
  const [isCPVisible, setIsCPVisible] = useState(false);

  const router = useRouter();
  const { email } = useLocalSearchParams();

  const API_BASE = process.env.EXPO_PUBLIC_BASE_API; // Fallback to localhost for development

  const handleReset = async () => {

    if (!password || !cpassword) {
      return Alert.alert("Error", "Password fields cannot be empty.");
    }

    if (password !== cpassword) {
      return Alert.alert("Error", "Passwords do not match.");
    }

    setLoading(true);

    try {

      const response = await fetch(`${API_BASE}/reset_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      const result = await response.json();

      if (result.status === "success") {

        Alert.alert("Success", "Password reset successful.");
        router.replace("/login");

      } else {
        Alert.alert("Error", result.message);
      }

    } catch (error) {
      Alert.alert("Error", "Connection failed.");
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Password</Text>

      {/* FIXED: Changed style from .input to .passwordContainer */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="New Password"
          placeholderTextColor="#666"
          secureTextEntry={!isPVisible}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsPVisible(!isPVisible)}>
          <MaterialCommunityIcons name={isPVisible ? "eye-off" : "eye"} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Confirm Password Field (Corrected style usage) */}
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Confirm Password"
          placeholderTextColor="#666"
          secureTextEntry={!isCPVisible}
          value={cpassword}
          onChangeText={setCpassword}
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setIsCPVisible(!isCPVisible)}>
          <MaterialCommunityIcons name={isCPVisible ? "eye-off" : "eye"} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleReset}>
        {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Update Password</Text>}
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:25,justifyContent:'center',backgroundColor:'#fff'},
  title:{fontSize:24,fontWeight:'bold',marginBottom:20,textAlign:'center'},
  input:{borderWidth:1,borderColor:'#ddd',padding:15,borderRadius:10,marginBottom:15},
  button:{backgroundColor:'#E74C3C',padding:16,borderRadius:10,alignItems:'center'},
  btnText:{color:'#fff',fontWeight:'bold',fontSize:16},
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#FFFFFF",
  },
  passwordInput: {
    flex: 1, // Takes up all space except for the icon
    padding: 12,
    color: "#000000",
  },
  eyeIcon: {
    padding: 10,
  },
});