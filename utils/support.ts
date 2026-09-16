import { Alert, Linking } from "react-native";
import * as Clipboard from 'expo-clipboard';

export const openSupportEmail = async () => {
  const email = "taskcare360@gmail.com";
  const subject = "Support Request - TaskCare360";
  const body = "Hello Support Team,";
  const mailUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  try {
    await Linking.openURL(mailUrl);
  } catch (error) {
    Alert.alert(
      "Support Unavailable",
      "No email client found. Copy our support email?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Copy Email", 
          onPress: async () => {
            await Clipboard.setStringAsync(email);
            Alert.alert("Success", "Email address copied to clipboard!");
          } 
        }
      ]
    );
  }
};