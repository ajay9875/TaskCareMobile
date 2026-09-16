import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TextInput, 
  TouchableOpacity, Alert, ActivityIndicator, 
  Modal, SafeAreaView 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;
const TIMEOUT_MS = 10000;

// Helper: Time-zone specific greeting
const getGreeting = () => {
  const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false };
  const indiaHour = parseInt(new Intl.DateTimeFormat([], options).format(new Date()), 10);

  if (indiaHour >= 4 && indiaHour < 12) return 'Good morning';
  if (indiaHour >= 12 && indiaHour < 16) return 'Good afternoon';
  if (indiaHour >= 16 && indiaHour < 21) return 'Good evening';
  return 'Good night';
};

// Helper: Safe ISO date formatting
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
};

// Custom Fetch Wrapper with Timeout & Handling
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [username, setUsername] = useState('User');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState(null);

  // Modals
  const [isProfileModalVisible, setProfileModalVisible] = useState(false);
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState({ sno: null, title: '', desc: '' });

  const router = useRouter();

  // Fetch Tasks Function (not wrapped in useCallback to avoid dependency issues)
  const fetchTasks = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/dashboard`, { credentials: 'include' });
      
      if (response.status === 401) {
        router.replace('/login?sessionExpired=true');
        return;
      }
      if (!response.ok) throw new Error('Dashboard endpoint error');

      const data = await response.json();
      if (data.status === 'success') {
        setTasks(data.tasks || []);
        setUsername(data.username || 'User');
      }
    } catch (error) {
      Alert.alert(
        'Sync Error',
        'Failed to fetch dashboard data. Please check your connection or try again later.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []); // Empty dependency array - runs once on mount

  const handleAddTask = async () => {
    if (!title.trim()) {
      Alert.alert('Input Error', 'Please enter a title.');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE}/addTodo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), desc: desc.trim() }),
      });

      if (response.status === 401) {
        router.replace('/login?sessionExpired=true');
        return;
      }

      const data = await response.json();
      if (data.status === 'success') {
        setTitle('');
        setDesc('');
        fetchTasks();
      } else {
        Alert.alert('Error', data.message || 'Failed to add task.');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to add task. Please check your network connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSubmit = async () => {
    if (!editingTask.sno) return;

    setActionLoading(true);
    try {
      const response = await fetchWithTimeout(`${API_BASE}/update/${editingTask.sno}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: editingTask.title.trim(), desc: editingTask.desc.trim() }),
      });

      if (response.status === 401) {
        router.replace('/login?sessionExpired=true');
        return;
      }

      const result = await response.json();
      if (result.status === 'success') {
        setEditModalVisible(false);
        fetchTasks();
      } else {
        Alert.alert('Error', result.message || 'Failed to update task.');
      }
    } catch (error) {
      Alert.alert('Update Error', 'Failed to update task. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleComplete = async (sno) => {
    setToggleLoadingId(sno);
    try {
      const response = await fetchWithTimeout(`${API_BASE}/tasks/toggle/${sno}`, {
        method: 'POST', 
        credentials: 'include',
      });

      if (response.status === 401) {
        router.replace('/login?sessionExpired=true');
        return;
      }

      const data = await response.json();
      if (data.status === 'success') {
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.SNo === sno ? { ...task, is_completed: !task.is_completed } : task
          )
        );
      } else {
        Alert.alert('Update Failed', data.message || 'Could not modify task status.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Failed to modify status. Check connection and retry.');
    } finally {
      setToggleLoadingId(null);
    }
  };

  const handleDelete = (sno) => {
    Alert.alert('Delete Task', 'Are you sure you want to permanently delete this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetchWithTimeout(`${API_BASE}/delete/${sno}`, {
              method: 'DELETE',
              credentials: 'include',
            });

            if (response.status === 401) {
              router.replace('/login?sessionExpired=true');
              return;
            }

            const data = await response.json();
            if (data.status === 'success') {
              fetchTasks();
            } else {
              Alert.alert('Error', data.message || 'Could not delete item.');
            }
          } catch (e) {
            Alert.alert('Error', 'Failed to delete task.');
          }
        },
      },
    ]);
  };

  const handleLogout = () => {
    setProfileModalVisible(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/logout`, { credentials: 'include' });
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </SafeAreaView>
    );
  }

  const firstName = username.split(' ')[0] || 'User';
  const avatarLetter = firstName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()},</Text>
            <Text style={styles.welcomeName}>{firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => setProfileModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        {/* Add Task Input Card - Compact */}
        <View style={styles.inputCard}>
        <TextInput 
          style={[styles.input, { color: '#000000' }]} 
          placeholder="Task Title..." 
            placeholderTextColor="#999" 
          value={title} 
          onChangeText={setTitle} 
        />
        <TextInput 
          style={[styles.input, { height: 60, color: '#000000' }]} 
          placeholder="Description..." 
          placeholderTextColor="#999"
          multiline 
          value={desc} 
          onChangeText={setDesc} 
        />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddTask} disabled={actionLoading}>
            {actionLoading ? (
                <ActivityIndicator color="#FFF" />
            ) : (
                <Text style={styles.addBtnText}>+ Add to TaskCare</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Task List */}
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.SNo.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, item.is_completed && styles.taskCardCompleted]}>
              <View style={styles.cardHeaderArea}>
                <View style={styles.textContainer}>
                  <Text style={[styles.taskTitle, item.is_completed && styles.textLineThrough]}>
                    {item.title}
                  </Text>
                  {item.desc ? (
                    <Text style={[styles.taskDesc, item.is_completed && styles.textLineThrough]}>
                      {item.desc}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => handleToggleComplete(item.SNo)}
                  style={styles.checkboxTouchTarget}
                  disabled={toggleLoadingId === item.SNo}
                >
                  {toggleLoadingId === item.SNo ? (
                    <ActivityIndicator size="small" color="#6200EE" style={{ padding: 2 }} />
                  ) : (
                    <MaterialCommunityIcons
                      name={item.is_completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={24}
                      color={item.is_completed ? '#10B981' : '#6200EE'}
                    />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.cardBottom}>
                <View>
                  <Text style={styles.dateText}>Created: {formatDate(item.date_created)}</Text>
                  {item.date_updated && (
                    <Text style={styles.dateText}>Updated: {formatDate(item.date_updated)}</Text>
                  )}
                </View>
                <View style={styles.actionGroup}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingTask({ sno: item.SNo, title: item.title, desc: item.desc });
                      setEditModalVisible(true);
                    }}
                    disabled={item.is_completed}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={20}
                      color={item.is_completed ? '#CBD5E1' : '#007BFF'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.SNo)} style={styles.iconBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#DC3545" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />

        {/* Edit Task Modal */}
        <Modal visible={isEditModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Update Task</Text>
              <TextInput
                style={styles.modalInput}
                value={editingTask.title}
                onChangeText={(text) => setEditingTask({ ...editingTask, title: text })}
                placeholder="Title"
              />
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                value={editingTask.desc}
                onChangeText={(text) => setEditingTask({ ...editingTask, desc: text })}
                placeholder="Description"
                multiline
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateSubmit} disabled={actionLoading}>
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Profile Modal */}
        <Modal visible={isProfileModalVisible} animationType="fade" transparent>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setProfileModalVisible(false)}
          >
            <View style={styles.profileCard}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.avatarTextLarge}>{avatarLetter}</Text>
              </View>
              <Text style={styles.profileName}>{username}</Text>
              <Text style={styles.profileSubtitle}>TaskCare Member</Text>
              <View style={styles.profileDivider} />
              <TouchableOpacity style={styles.logoutModalBtn} onPress={handleLogout}>
                <MaterialCommunityIcons name="logout" size={20} color="#DC2626" style={{ marginRight: 8 }} />
                <Text style={styles.logoutModalText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F7FE' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },

  /* Header */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greetingText: { fontSize: 13, color: '#64748B', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  welcomeName: { fontSize: 22, color: '#0F172A', fontWeight: '800' },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  /* Add Task Section - Compact */
  inputCard: { 
    backgroundColor: '#FFFFFF', 
    padding: 12, 
    borderRadius: 15, 
    elevation: 3, 
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  input: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0', 
    padding: 10, 
    marginBottom: 8, 
    fontSize: 15, 
    color: '#000000', 
    backgroundColor: '#FFFFFF' 
  },
  addBtn: { 
    backgroundColor: '#6200EE', 
    padding: 10, 
    borderRadius: 10, 
    marginTop: 8,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },

  /* Task Cards */
  taskCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6200EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  taskCardCompleted: { borderLeftColor: '#10B981', backgroundColor: '#F0FDF4' },
  cardHeaderArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' },
  textContainer: { flex: 1, paddingRight: 12 },
  checkboxTouchTarget: { padding: 2, alignSelf: 'flex-start' },
  textLineThrough: { textDecorationLine: 'line-through', color: '#94A3B8' },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  taskDesc: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  dateText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  actionGroup: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 12, padding: 2 },

  /* Modals & Buttons */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16, textAlign: 'center' },
  modalInput: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0', padding: 10, marginBottom: 12, fontSize: 15, color: '#0F172A' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#F1F5F9' },
  cancelBtnText: { color: '#64748B', fontWeight: '600' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#6200EE' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600' },

  /* Profile Card */
  profileCard: { width: '80%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 10 },
  profileAvatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarTextLarge: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  profileSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  profileDivider: { width: '100%', height: 1, backgroundColor: '#F1F5F9', marginVertical: 18 },
  logoutModalBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FEF2F2' },
  logoutModalText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
});