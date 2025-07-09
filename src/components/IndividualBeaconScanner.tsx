
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Activity, Wifi, Signal } from 'lucide-react';
import { BleClient, ScanResult, ScanMode } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { parseIBeaconData, rssiToDistance } from '@/utils/beaconUtils';

interface Beacon {
  id: number;
  x: number;
  y: number;
  name: string;
}

interface IndividualBeaconScannerProps {
  beacon: Beacon;
  uuid: string;
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
      
      console.log(`🎯 Starting individual scan for POI ${beacon.id} (${beacon.name})`);
      
      await BleClient.requestLEScan({
        services: [],
        allowDuplicates: true,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      }, (result: ScanResult) => {
        console.log(`📡 POI ${beacon.id} - Device found:`, result.device?.name || 'Unknown');
        
        if (result.manufacturerData) {
          Object.entries(result.manufacturerData).forEach(([key, data]) => {
            console.log(`🔍 POI ${beacon.id} - Checking manufacturer ${key}:`, data);
            
            try {
              // Convert data to ArrayBuffer
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
              
              if (arrayBuffer && arrayBuffer.byteLength >= 25) {
                const beaconInfo = parseIBeaconData(arrayBuffer, result.rssi || -100);
                
                if (beaconInfo) {
                  console.log(`📍 POI ${beacon.id} - Parsed beacon:`, beaconInfo);
                  
                  // Check if this is our target beacon
                  if (beaconInfo.major === beacon.id) {
                    console.log(`🎯 FOUND POI ${beacon.id}!`);
                    setBeaconFound(true);
                    setRssi(beaconInfo.rssi);
                    setDistance(rssiToDistance(beaconInfo.rssi, txPower));
                    setLastSeen(new Date().toLocaleTimeString());
                    setRawData({
                      uuid: beaconInfo.uuid,
                      major: beaconInfo.major,
                      minor: beaconInfo.minor,
                      txPower: beaconInfo.txPower,
                      manufacturerKey: key,
                      rawBytes: Array.from(new Uint8Array(arrayBuffer)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
                    });
                  }
                }
              }
            } catch (error) {
              console.log(`❌ POI ${beacon.id} - Parse error:`, error);
            }
          });
        }
      });
      
    } catch (error) {
      console.error(`❌ POI ${beacon.id} scan error:`, error);
      setScanError(`Scan failed: ${error}`);
      setIsScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      await BleClient.stopLEScan();
      setIsScanning(false);
      console.log(`🛑 POI ${beacon.id} scan stopped`);
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
            Major: {beacon.id}
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
              Scan POI {beacon.id}
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
          <p className="text-gray-400 text-xs mb-2">Beacon Details:</p>
          <div className="space-y-1 text-xs">
            <div><span className="text-gray-400">UUID:</span> <span className="text-white font-mono">{rawData.uuid}</span></div>
            <div><span className="text-gray-400">Major:</span> <span className="text-white font-mono">{rawData.major}</span></div>
            <div><span className="text-gray-400">Minor:</span> <span className="text-white font-mono">{rawData.minor}</span></div>
            <div><span className="text-gray-400">TX Power:</span> <span className="text-white font-mono">{rawData.txPower} dBm</span></div>
            <div><span className="text-gray-400">Mfg Key:</span> <span className="text-white font-mono">{rawData.manufacturerKey}</span></div>
            <div><span className="text-gray-400">Raw:</span> <span className="text-white font-mono text-xs break-all">{rawData.rawBytes}</span></div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default IndividualBeaconScanner;
