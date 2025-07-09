import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Bluetooth, Activity, Info } from 'lucide-react';
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
  lastUpdate: number;
  // New fields for detailed device information
  deviceDetails?: {
    connectable?: boolean;
    localName?: string;
    serviceData?: { [key: string]: any };
  };
}

const BLEDeviceScanner: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Map<string, ScannedDevice>>(new Map());
  const [scanError, setScanError] = useState<string | null>(null);
  const [isNativePlatform, setIsNativePlatform] = useState(false);
  const [totalScans, setTotalScans] = useState(0);
  const [scanStartTime, setScanStartTime] = useState<number>(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsNativePlatform(Capacitor.isNativePlatform());
  }, []);

  // Auto-update timestamps every second
  useEffect(() => {
    if (isScanning) {
      updateIntervalRef.current = setInterval(() => {
        setDevices(prev => new Map(prev));
      }, 1000);
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isScanning]);

  const startGeneralScan = async () => {
    if (!isNativePlatform) {
      setScanError('BLE scanning requires native platform');
      return;
    }

    try {
      console.log('🚀 ===========================================');
      console.log('🚀 STARTING ENHANCED BLE DEVICE SCAN');
      console.log('🚀 ===========================================');
      
      // Initialize BLE
      await BleClient.initialize();
      
      // Check if Bluetooth is enabled
      const isEnabled = await BleClient.isEnabled();
      if (!isEnabled) {
        setScanError('Bluetooth is disabled. Please enable Bluetooth.');
        return;
      }

      // Clear previous results
      setDevices(new Map());
      setTotalScans(0);
      setScanError(null);
      setIsScanning(true);
      setScanStartTime(Date.now());

      // Start scanning for ALL devices
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        setTotalScans(prev => prev + 1);
        
        const deviceId = result.device?.deviceId || 'unknown';
        const deviceName = result.device?.name || result.localName || 'Unknown Device';
        
        console.log('📱 BLE Device Update (Enhanced):', {
          deviceId,
          name: deviceName,
          rssi: result.rssi,
          txPower: result.txPower,
          hasManufacturerData: !!result.manufacturerData,
          serviceUuids: result.uuids || [],
          connectable: result.device?.connectable
        });

        // Enhanced device object with more details
        const newDevice: ScannedDevice = {
          deviceId,
          name: deviceName,
          rssi: result.rssi || -100,
          txPower: result.txPower,
          manufacturerData: result.manufacturerData,
          serviceUuids: result.uuids,
          timestamp: Date.now(),
          lastUpdate: Date.now(),
          deviceDetails: {
            connectable: result.device?.connectable,
            localName: result.localName,
            serviceData: result.serviceData
          }
        };

        // Process manufacturer data to extract potential UUIDs and beacon info
        if (result.manufacturerData) {
          console.log('🔍 Processing manufacturer data for device:', deviceName);
          Object.entries(result.manufacturerData).forEach(([key, data]) => {
            console.log(`   Manufacturer ${key}:`, data);
            
            // Try to extract UUID if this looks like beacon data
            try {
              let arrayBuffer: ArrayBuffer | null = null;
              
              if (data instanceof ArrayBuffer) {
                arrayBuffer = data;
              } else if (Array.isArray(data)) {
                arrayBuffer = new Uint8Array(data).buffer;
              } else if (data && typeof data === 'object') {
                const keys = Object.keys(data).filter(k => !isNaN(Number(k))).sort((a, b) => Number(a) - Number(b));
                if (keys.length > 0) {
                  const bytes = keys.map(k => (data as any)[k]);
                  arrayBuffer = new Uint8Array(bytes).buffer;
                }
              }
              
              if (arrayBuffer && arrayBuffer.byteLength >= 16) {
                const dataView = new DataView(arrayBuffer);
                
                // Try to extract UUID from various positions
                for (let offset = 0; offset <= arrayBuffer.byteLength - 16; offset++) {
                  const uuidBytes = [];
                  for (let i = offset; i < offset + 16; i++) {
                    uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
                  }
                  
                  const extractedUuid = [
                    uuidBytes.slice(0, 4).join(''),
                    uuidBytes.slice(4, 6).join(''),
                    uuidBytes.slice(6, 8).join(''),
                    uuidBytes.slice(8, 10).join(''),
                    uuidBytes.slice(10, 16).join('')
                  ].join('-');
                  
                  // Check if this looks like a valid UUID (not all zeros/FFs)
                  const cleanUuid = extractedUuid.replace(/-/g, '');
                  if (cleanUuid !== '00000000000000000000000000000000' && 
                      cleanUuid !== 'ffffffffffffffffffffffffffffffff' &&
                      cleanUuid.length === 32) {
                    
                    console.log(`   🎯 Potential UUID at offset ${offset}:`, extractedUuid);
                    
                    // Add UUID to device details
                    if (!newDevice.deviceDetails) newDevice.deviceDetails = {};
                    if (!newDevice.deviceDetails.serviceData) newDevice.deviceDetails.serviceData = {};
                    newDevice.deviceDetails.serviceData[`extracted_uuid_${offset}`] = extractedUuid;
                    
                    // Check for AB90 pattern (our target beacons)
                    if (cleanUuid.toLowerCase().startsWith('ab907856')) {
                      console.log(`   🎯 FOUND TARGET BEACON UUID PATTERN!`);
                      newDevice.deviceDetails.serviceData['beacon_type'] = 'TARGET_BEACON';
                    }
                    
                    break; // Found a valid UUID, stop searching
                  }
                }
              }
            } catch (error) {
              console.log(`   ❌ Error processing manufacturer data:`, error);
            }
          });
        }

        setDevices(prev => {
          const updated = new Map(prev);
          updated.set(deviceId, newDevice);
          return updated;
        });
      });

      console.log('✅ Enhanced BLE device scan started successfully');
      
    } catch (error) {
      console.error('❌ Enhanced BLE scanning error:', error);
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
    setDevices(new Map());
    setTotalScans(0);
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

  const getDeviceAge = (timestamp: number) => {
    return Math.round((Date.now() - timestamp) / 1000);
  };

  const devicesArray = Array.from(devices.values()).sort((a, b) => b.lastUpdate - a.lastUpdate);

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
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <p className="text-gray-400 text-sm">Total Scans</p>
          <p className="text-white text-2xl font-bold">{totalScans}</p>
        </div>
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <p className="text-gray-400 text-sm">Unique Devices</p>
          <p className="text-white text-2xl font-bold">{devices.size}</p>
        </div>
        <div className="text-center p-3 bg-slate-700/30 rounded-lg">
          <p className="text-gray-400 text-sm">Scan Time</p>
          <p className="text-white text-2xl font-bold">
            {isScanning ? Math.round((Date.now() - scanStartTime) / 1000) : 0}s
          </p>
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
          <p className="text-blue-200">Live scanning for BLE devices...</p>
        </div>
      )}

      {/* Enhanced Device List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {devicesArray.length === 0 && !isScanning ? (
          <div className="text-center py-8">
            <Wifi className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-400">No devices found</p>
            <p className="text-sm text-gray-500 mt-2">Click "Start Scan" to search for BLE devices</p>
          </div>
        ) : (
          devicesArray.map(device => {
            const signal = getSignalStrength(device.rssi);
            const age = getDeviceAge(device.lastUpdate);
            const hasExtractedUuid = device.deviceDetails?.serviceData && 
              Object.keys(device.deviceDetails.serviceData).some(key => key.startsWith('extracted_uuid_'));
            const isTargetBeacon = device.deviceDetails?.serviceData?.beacon_type === 'TARGET_BEACON';
            
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
                    {hasExtractedUuid && (
                      <Badge variant="outline" className="text-xs text-purple-200 border-purple-300">
                        UUID
                      </Badge>
                    )}
                    {isTargetBeacon && (
                      <Badge variant="outline" className="text-xs text-red-200 border-red-300">
                        TARGET BEACON!
                      </Badge>
                    )}
                    {age <= 3 && (
                      <Badge variant="outline" className="text-xs text-blue-200 border-blue-300">
                        LIVE
                      </Badge>
                    )}
                    {device.deviceDetails?.connectable && (
                      <Badge variant="outline" className="text-xs text-yellow-200 border-yellow-300">
                        Connectable
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
                    <p className="text-gray-400">Last Update</p>
                    <p className="text-white font-mono">{age}s ago</p>
                  </div>
                </div>

                {/* Enhanced Device Details */}
                {device.deviceDetails?.localName && device.deviceDetails.localName !== device.name && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-xs mb-1">Local Name:</p>
                    <p className="text-white text-sm">{device.deviceDetails.localName}</p>
                  </div>
                )}

                {/* Extracted UUIDs */}
                {hasExtractedUuid && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-xs mb-2">Extracted UUIDs:</p>
                    <div className="space-y-1">
                      {Object.entries(device.deviceDetails?.serviceData || {})
                        .filter(([key]) => key.startsWith('extracted_uuid_'))
                        .map(([key, uuid]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-400">{key.replace('extracted_uuid_', 'Offset ')}:</span>
                            <span className="text-white font-mono ml-2 break-all">{uuid as string}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Service UUIDs */}
                {device.serviceUuids && device.serviceUuids.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <p className="text-gray-400 text-xs mb-2">Service UUIDs:</p>
                    <div className="flex flex-wrap gap-1">
                      {device.serviceUuids.map((uuid, index) => (
                        <Badge key={index} variant="outline" className="text-xs font-mono">
                          {uuid.length > 8 ? `${uuid.slice(0, 8)}...` : uuid}
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
                          <span className="text-gray-400">Company 0x{key}:</span>
                          <span className="text-white font-mono ml-2 break-all">
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
