
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Activity, Wifi, Signal } from 'lucide-react';
import { BleClient, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { rssiToDistance } from '@/utils/beaconUtils';

interface Beacon {
  id: number;
  x: number;
  y: number;
  name: string;
  deviceName: string; // Add device name for matching
}

interface IndividualBeaconScannerProps {
  beacon: Beacon;
  uuid: string; // Keep for backward compatibility
  txPower: number;
  isNativePlatform: boolean;
}

const IndividualBeaconScanner: React.FC<IndividualBeaconScannerProps> = ({
  beacon,
  uuid,
  txPower,
  isNativePlatform
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [beaconFound, setBeaconFound] = useState(false);
  const [rssi, setRssi] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<string>('Never');
  const [scanError, setScanError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any>(null);

  const startIndividualScan = async () => {
    if (!isNativePlatform) {
      setScanError('Requires native platform');
      return;
    }

    try {
      setIsScanning(true);
      setScanError(null);
      setBeaconFound(false);
      
      console.log(`🎯 Starting individual name-based scan for ${beacon.deviceName} (${beacon.name})`);
      
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        const deviceName = result.device?.name || result.localName || 'Unknown';
        console.log(`📡 ${beacon.deviceName} - Device found:`, deviceName);
        
        // Check if this device name matches our target beacon name
        if (deviceName === beacon.deviceName || result.localName === beacon.deviceName) {
          console.log(`🎯 FOUND ${beacon.deviceName}!`);
          setBeaconFound(true);
          setRssi(result.rssi || -100);
          setDistance(rssiToDistance(result.rssi || -100, txPower));
          setLastSeen(new Date().toLocaleTimeString());
          setRawData({
            deviceName: deviceName,
            localName: result.localName,
            deviceId: result.device?.deviceId,
            rssi: result.rssi,
            txPower: result.txPower,
            manufacturerData: result.manufacturerData ? Object.keys(result.manufacturerData) : [],
            serviceUuids: result.uuids || []
          });
        }
      });
      
    } catch (error) {
      console.error(`❌ ${beacon.deviceName} scan error:`, error);
      setScanError(`Scan failed: ${error}`);
      setIsScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      await BleClient.stopLEScan();
      setIsScanning(false);
      console.log(`🛑 ${beacon.deviceName} scan stopped`);
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return { level: 'Excellent', color: 'bg-green-500' };
    if (rssi > -60) return { level: 'Good', color: 'bg-blue-500' };
    if (rssi > -70) return { level: 'Fair', color: 'bg-yellow-500' };
    return { level: 'Poor', color: 'bg-red-500' };
  };

  return (
    <Card className="bg-slate-700/50 border-slate-600 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-white">{beacon.name}</span>
          <Badge variant="outline" className="text-xs">
            Device: {beacon.deviceName}
          </Badge>
        </div>
        {beaconFound && (
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4 text-green-400" />
            <span className="text-green-400 text-sm">Connected</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-400">Position</p>
          <p className="text-white font-mono">({beacon.x}, {beacon.y})m</p>
        </div>
        <div>
          <p className="text-gray-400">Status</p>
          <p className={`font-mono ${beaconFound ? 'text-green-400' : 'text-gray-400'}`}>
            {beaconFound ? 'Found' : 'Searching...'}
          </p>
        </div>
        {rssi && (
          <>
            <div>
              <p className="text-gray-400">RSSI</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-mono">{rssi} dBm</p>
                {rssi && (
                  <div className={`px-2 py-1 rounded text-xs ${getSignalStrength(rssi).color} text-white`}>
                    {getSignalStrength(rssi).level}
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-gray-400">Distance</p>
              <p className="text-white font-mono">{distance?.toFixed(2)}m</p>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button 
          onClick={isScanning ? stopScan : startIndividualScan}
          variant={isScanning ? "destructive" : "default"}
          size="sm"
          className="flex-1"
          disabled={!isNativePlatform}
        >
          {isScanning ? (
            <>
              <Activity className="w-4 h-4 mr-2 animate-pulse" />
              Stop Scan
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 mr-2" />
              Scan {beacon.deviceName}
            </>
          )}
        </Button>
      </div>

      {scanError && (
        <div className="p-2 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-xs mb-2">
          {scanError}
        </div>
      )}

      <div className="text-xs text-gray-400">
        <p>Last seen: {lastSeen}</p>
      </div>

      {rawData && (
        <div className="mt-3 pt-3 border-t border-slate-600">
          <p className="text-gray-400 text-xs mb-2">Device Details:</p>
          <div className="space-y-1 text-xs">
            <div><span className="text-gray-400">Device Name:</span> <span className="text-white font-mono">{rawData.deviceName}</span></div>
            <div><span className="text-gray-400">Local Name:</span> <span className="text-white font-mono">{rawData.localName || 'N/A'}</span></div>
            <div><span className="text-gray-400">Device ID:</span> <span className="text-white font-mono">{rawData.deviceId?.slice(0, 12)}...</span></div>
            <div><span className="text-gray-400">RSSI:</span> <span className="text-white font-mono">{rawData.rssi} dBm</span></div>
            <div><span className="text-gray-400">TX Power:</span> <span className="text-white font-mono">{rawData.txPower || 'N/A'} dBm</span></div>
            <div><span className="text-gray-400">Mfg Data:</span> <span className="text-white font-mono">{rawData.manufacturerData.length > 0 ? 'Yes' : 'No'}</span></div>
            <div><span className="text-gray-400">Services:</span> <span className="text-white font-mono">{rawData.serviceUuids.length || 0}</span></div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default IndividualBeaconScanner;
