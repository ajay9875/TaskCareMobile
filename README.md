# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

# 1. Command to install fresh app and run locally(Android studio): Use after uninstalling app from Android Studio Emulator
npx expo start --go
npx expo prebuild --clean
npx expo prebuild --platform android
npx expo start --android | npx expo start --clear | npx expo start --go | npx expo start --go --clear
# Press s to switch for Expo GO from Development and Press Enter after that press a to open app in the Android studio
# To reinstall fresh expo go at android Studio
npx expo start --android --go

# 2. To create a new apk file at expo run below command
npx expo prebuild --clean
npx expo prebuild --platform android
eas build --platform android --profile preview

# 3. To push only new changes to the EAS which will be affecting in the user app by updating manually from downloaded app before
# Please note that version of downloaded and updated app version must be same 
eas update:configure
npx expo prebuild --platform android
eas update --branch preview --message "Updated claories calculating multiplier from 0.05 to 0.0575"
# after runing above command please select environment according to deployed your code before()

# 4. To stop and start server use this command if android device is not running and show the already runing
adb start-server
adb kill-server