// app.config.js
export default {
  expo: {
    name: "gei-gestao-estoque",
    slug: "gei-gestao-estoque",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.seuempresa.geigestaoestoque",
      infoPlist: {
        NSCameraUsageDescription: "Este aplicativo usa a câmera para escanear QR codes e gerenciar estoque"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#ffffff"
      },
      package: "com.seuempresa.geigestaoestoque",
      permissions: ["android.permission.CAMERA", "android.permission.USE_BIOMETRIC"]
    },
    web: {
      favicon: "./assets/logo.png"
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera to scan QR codes and manage inventory.",
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      "expo-local-authentication",
      "expo-secure-store"
    ]
  }
};
