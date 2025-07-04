
import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.f9a19f44140b412ab9a7a8b782dd63a0',
  appName: 'travvo-indoor-mapper',
  webDir: 'dist',
  server: {
    url: 'https://f9a19f44-140b-412a-b9a7-a8b782dd63a0.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
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
