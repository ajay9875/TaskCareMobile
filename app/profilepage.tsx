import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openSupportEmail } from '@/utils/support';
import { stopStepTracker } from '../utils/stepTracker';


const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [updating, setUpdating] = useState(false);

  // Redirect helper with query parameter
  const redirectToLogin = (reason = 'Session Expired. Please login again') => {
    router.replace({
      pathname: '/login',
      params: { message: reason },
    });
  };

  // Fetch session profile data on screen load
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/profile`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
        });

        if (response.status === 401) {
          return redirectToLogin();
        }

        const data = await response.json();
        if (data.status === 'success' && data.user) {
          setUser({ name: data.user.name, email: data.user.email });
        } else {
          redirectToLogin();
        }
      } catch (error) {
        Alert.alert('Connection Error', 'Unable to fetch profile details.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleOpenEditModal = () => {
    if (!user) return;
    setEditName(user.name);
    setEditEmail(user.email);
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      Alert.alert('Validation Error', 'Name and Email cannot be empty.');
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch(`${API_BASE}/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: editName.trim(), email: editEmail.trim() }),
      });

      if (response.status === 401) {
        setEditModalVisible(false);
        return redirectToLogin();
      }

      const data = await response.json();
      if (data.status === 'success') {
        setUser({ name: editName.trim(), email: editEmail.trim() });
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully.');
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to reach the server.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await stopStepTracker();
            await fetch(`${API_BASE}/logout`, { credentials: 'include' });
          } catch (e) {
            // Proceed with client logout
          } finally {
            router.dismissAll();
            router.replace('/login');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!user) return null;

  const avatarLetter = user.name.trim().charAt(0).toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={handleOpenEditModal} activeOpacity={0.7}>
            <View style={[styles.iconWrapper, { backgroundColor: '#EEF2FF' }]}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/forgot-password')} activeOpacity={0.7}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="lock-reset" size={22} color="#D97706" />
            </View>
            <Text style={styles.menuText}>Reset Password</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={openSupportEmail} activeOpacity={0.7}>
            <View style={[styles.iconWrapper, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="headset" size={22} color="#0284C7" />
            </View>
            <Text style={styles.menuText}>Contact Us / Support</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItemLogout} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.iconWrapper, { backgroundColor: '#FEF2F2' }]}>
              <MaterialCommunityIcons name="logout" size={22} color="#DC2626" />
            </View>
            <Text style={styles.menuTextLogout}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Enter your email"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={updating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={updating}>
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FE' },
  safeArea: { flex: 1, backgroundColor: '#F4F7FE' },
  container: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  profileCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24, elevation: 3 },
  avatarContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '700' },
  userName: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  userEmail: { fontSize: 14, color: '#64748B', marginTop: 4 },
  menuContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuItemLogout: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  iconWrapper: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  menuTextLogout: { flex: 1, fontSize: 15, fontWeight: '600', color: '#DC2626' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16, textAlign: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#0F172A' },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#6200EE' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600' },
});