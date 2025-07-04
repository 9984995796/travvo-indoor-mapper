
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wifi, MapPin, Activity } from 'lucide-react';

interface BeaconData {
  id: number;
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  filteredRSSI: number;
  distance: number;
  actualDistance: number;
  x: number;
  y: number;
  name: string;
}

interface BeaconSimulatorProps {
  beacons: BeaconData[];
  isScanning: boolean;
}

const BeaconSimulator: React.FC<BeaconSimulatorProps> = ({ beacons, isScanning }) => {
  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return { level: 'Excellent', color: 'bg-green-500', bars: 4 };
    if (rssi > -60) return { level: 'Good', color: 'bg-blue-500', bars: 3 };
    if (rssi > -70) return { level: 'Fair', color: 'bg-yellow-500', bars: 2 };
    return { level: 'Poor', color: 'bg-red-500', bars: 1 };
  };

  const getAccuracyColor = (calculated: number, actual: number) => {
    const error = Math.abs(calculated - actual);
    if (error < 0.5) return 'text-green-400';
    if (error < 1.0) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isScanning) {
    return (
      <div className="text-center py-8">
        <Wifi className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-400">Click "Start Scanning" to begin beacon detection</p>
        <p className="text-sm text-gray-500 mt-2">
          Simulating ESP32-WROOM-32E beacons with AltBeacon protocol
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {beacons.length === 0 ? (
        <div className="text-center py-4">
          <Activity className="mx-auto h-8 w-8 text-blue-400 animate-pulse mb-2" />
          <p className="text-blue-200">Scanning for beacons...</p>
        </div>
      ) : (
        beacons.map(beacon => {
          const signal = getSignalStrength(beacon.rssi);
          return (
            <Card key={beacon.id} className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <span className="font-semibold text-white">{beacon.name}</span>
                  <Badge variant="outline" className="text-xs">
                    ID: {beacon.id}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${signal.color} text-white`}>
                    {signal.level}
                  </div>
                  {/* Signal strength bars */}
                  <div className="flex gap-0.5">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-3 rounded-sm ${
                          i < signal.bars ? signal.color : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Position</p>
                  <p className="text-white font-mono">({beacon.x}, {beacon.y})m</p>
                </div>
                <div>
                  <p className="text-gray-400">Major/Minor</p>
                  <p className="text-white font-mono">{beacon.major}/{beacon.minor}</p>
                </div>
                <div>
                  <p className="text-gray-400">RSSI (Raw/Filtered)</p>
                  <p className="text-white font-mono">
                    {beacon.rssi} / {beacon.filteredRSSI} dBm
                  </p>
                </div>
                <div>
                  <p className="text-gray-400">Distance</p>
                  <p className={`font-mono ${getAccuracyColor(beacon.distance, beacon.actualDistance)}`}>
                    {beacon.distance}m (±{Math.abs(beacon.distance - beacon.actualDistance).toFixed(2)}m)
                  </p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-600">
                <p className="text-xs text-gray-400 font-mono">
                  UUID: {beacon.uuid.slice(0, 8)}...{beacon.uuid.slice(-4)}
                </p>
              </div>
            </Card>
          );
        })
      )}
      
      {beacons.length > 0 && (
        <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
          <p className="text-xs text-gray-400 mb-2">Trilateration Status:</p>
          <div className="flex gap-2 flex-wrap">
            {beacons.slice(0, 3).map(beacon => (
              <Badge key={beacon.id} variant="outline" className="text-xs">
                {beacon.id}: {beacon.distance.toFixed(1)}m
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BeaconSimulator;
