
import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Bluetooth, Activity } from 'lucide-react';
import { BleClient, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

interface ScannedDevice {
  deviceId: string;
  name: string;
  rssi: number;
  txPower?: number;
  manufacturerData?: { [key: string]: any };
  serviceUuids?: string[];
  timestamp: number;
}

const BLEDeviceScanner: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [totalDevicesFound, setTotalDevicesFound] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsNativePlatform(Capacitor.isNativePlatform());
  }, []);

  const startGeneralScan = async () => {
    if (!isNativePlatform) {
      setScanError('BLE scanning requires native platform');
      return;
    }

    try {
      console.log('=== Starting General BLE Device Scan ===');
      
      // Initialize BLE
      await BleClient.initialize();
      
      // Check if Bluetooth is enabled
      const isEnabled = await BleClient.isEnabled();
      if (!isEnabled) {
        setScanError('Bluetooth is disabled. Please enable Bluetooth.');
        return;
      }

      // Clear previous results
      setDevices([]);
      setTotalDevicesFound(0);
      setScanError(null);
      setIsScanning(true);

      // Start scanning for ALL devices
      await BleClient.requestLEScan({
        services: [], // Empty array means scan for all services
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setTotalDevicesFound(prev => prev + 1);
        
        console.log('📱 BLE Device Found:', {
          deviceId: result.device?.deviceId,
          name: result.device?.name || 'Unknown',
          rssi: result.rssi,
          txPower: result.txPower,
          hasManufacturerData: !!result.manufacturerData,
          serviceUuids: result.uuids || []
        });

        const newDevice: ScannedDevice = {
          deviceId: result.device?.deviceId || 'unknown',
          name: result.device?.name || 'Unknown Device',
          rssi: result.rssi || -100,
          txPower: result.txPower,
          manufacturerData: result.manufacturerData,
          serviceUuids: result.uuids,
          timestamp: Date.now()
        };

        setDevices(prev => {
          // Remove old entry for same device and add new one
          const filtered = prev.filter(d => d.deviceId !== newDevice.deviceId);
          return [...filtered, newDevice].sort((a, b) => b.rssi - a.rssi);
        });
      });

      console.log('✅ General BLE scan started successfully');
      
    } catch (error) {
      console.error('❌ General BLE scanning error:', error);
      setScanError(`Scan failed: ${error}`);
      setIsScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      if (isNativePlatform) {
        await BleClient.stopLEScan();
      }
      setIsScanning(false);
      console.log('🛑 BLE scan stopped');
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  const toggleScan = () => {
    if (isScanning) {
      stopScan();
    } else {
      startGeneralScan();
    }
  };

  const clearResults = () => {
    setDevices([]);
    setTotalDevicesFound(0);
    setScanError(null);
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return { level: 'Excellent', color: 'bg-green-500' };
    if (rssi > -60) return { level: 'Good', color: 'bg-blue-500' };
    if (rssi > -70) return { level: 'Fair', color: 'bg-yellow-500' };
    return { level: 'Poor', color: 'bg-red-500' };
  };

  const hasManufacturerData = (device: ScannedDevice) => {
    return device.manufacturerData && Object.keys(device.manufacturerData).length > 0;
  };

  if (!isNativePlatform) {
    return (
      <div className="text-center py-8">
        <WifiOff className="mx-auto h-12 w-12 text-red-400 mb-4" />
        <p className="text-red-400">BLE scanning requires native platform (Android/iOS)</p>
        <p className="text-sm text-gray-500 mt-2">
          Build natively with: npm run build && npx cap sync && npx cap run android
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="flex justify-center gap-4">
        <Button 
          onClick={toggleScan}
          variant={isScanning ? "destructive" : "default"}
          className="min-w-32"
        >
          {isScanning ? (
            <>
              <Activity className="w-4 h-4 mr-2 animate-pulse" />
              Stop Scan
            </>
          ) : (
            <>
              <Bluetooth className="w-4 h-4 mr-2" />
              Start Scan
            </>
          )}
        </Button>
        <Button onClick={clearResults} variant="outline">
          Clear Results
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <p className="text-gray-400 text-sm">Total Scanned</p>
          <p className="text-white text-2xl font-bold">{totalDevicesFound}</p>
        </div>
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <p className="text-gray-400 text-sm">Unique Devices</p>
          <p className="text-white text-2xl font-bold">{devices.length}</p>
        </div>
      </div>

      {/* Error Display */}
      {scanError && (
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-red-200 font-semibold">⚠️ Scan Error</p>
          <p className="text-red-300 text-sm mt-2">{scanError}</p>
        </div>
      )}

      {/* Scanning Status */}
      {isScanning && (
        <div className="text-center p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <Activity className="mx-auto h-6 w-6 text-blue-400 animate-pulse mb-2" />
          <p className="text-blue-200">Scanning for BLE devices...</p>
        </div>
      )}

      {/* Device List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {devices.length === 0 && !isScanning ? (
          <div className="text-center py-8">
            <Wifi className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400">No devices found</p>
            <p className="text-sm text-gray-500 mt-2">Click "Start Scan" to search for BLE devices</p>
          </div>
        ) : (
          devices.map(device => {
            const signal = getSignalStrength(device.rssi);
            return (
              <Card key={device.deviceId} className="bg-slate-700/50 border-slate-600 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bluetooth className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-white">{device.name}</span>
                    {hasManufacturerData(device) && (
                      <Badge variant="outline" className="text-xs text-green-200 border-green-300">
                        MFG Data
                      </Badge>
                    )}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${signal.color} text-white`}>
                    {signal.level}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Device ID</p>
                    <p className="text-white font-mono text-xs break-all">{device.deviceId}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">RSSI</p>
                    <p className="text-white font-mono">{device.rssi} dBm</p>
                  </div>
                  {device.txPower && (
                    <div>
                      <p className="text-gray-400">TX Power</p>
                      <p className="text-white font-mono">{device.txPower} dBm</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-400">Age</p>
                    <p className="text-white font-mono">
                      {Math.round((Date.now() - device.timestamp) / 1000)}s
                    </p>
                  </div>
                </div>

                {/* Service UUIDs */}
                {device.serviceUuids && device.serviceUuids.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-xs mb-2">Service UUIDs:</p>
                    <div className="flex flex-wrap gap-1">
                      {device.serviceUuids.map((uuid, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {uuid.slice(0, 8)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manufacturer Data */}
                {hasManufacturerData(device) && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-xs mb-2">Manufacturer Data:</p>
                    <div className="space-y-1">
                      {Object.entries(device.manufacturerData!).map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-gray-400">0x{key}:</span>
                          <span className="text-white font-mono ml-2">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BLEDeviceScanner;
