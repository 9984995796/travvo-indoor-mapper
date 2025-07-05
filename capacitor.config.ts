
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.f9a19f44140b412ab9a7a8b782dd63a0',
  appName: 'travvo-indoor-mapper',
  webDir: 'dist',
  // Remove the server config for production builds
  // The server config should only be used during development
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for BLE beacons...",
        cancel: "Cancel",
        availableDevices: "Available devices",
        noDeviceFound: "No BLE devices found"
      }
    }
  }
};

export default config;
