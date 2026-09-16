import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native'; 

export default function ModalScreen() {
  const router = useRouter();

  // Helper to handle dismissing the modal safely
  const handleDismiss = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TaskCare360 Info</Text>
      
      <View style={styles.separator} />

      <Text style={styles.description}>
        This modal can be used for quick settings or task details.
      </Text>

      {/* Replaced <Link dismissTo> with TouchableOpacity for SDK 49 compatibility */}
      <TouchableOpacity onPress={handleDismiss} style={styles.link}>
        <Text style={styles.linkText}>Dismiss and Go Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: '#eee',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  link: {
    padding: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
});