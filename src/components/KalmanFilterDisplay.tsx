
import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BeaconData {
  id: number;
  rssi: number;
  filteredRSSI: number;
  distance: number;
  actualDistance: number;
  name: string;
}

interface KalmanFilterDisplayProps {
  beaconData: BeaconData[];
  isScanning: boolean;
}

const KalmanFilterDisplay: React.FC<KalmanFilterDisplayProps> = ({ beaconData, isScanning }) => {
  if (!isScanning || beaconData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-gray-400">Kalman filter analysis will appear here during scanning</p>
        <p className="text-sm text-gray-500 mt-2">
          Process Noise (Q): 0.0001 | Measurement Noise (R): 0.01
        </p>
      </div>
    );
  }

  const getTrendIcon = (raw: number, filtered: number) => {
    const diff = filtered - raw;
    if (Math.abs(diff) < 0.5) return <Minus className="h-4 w-4 text-gray-400" />;
    if (diff > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  };

  const getFilterEffectiveness = (raw: number, filtered: number) => {
    const smoothing = Math.abs(raw - filtered);
    if (smoothing < 1) return { level: 'Low', color: 'text-blue-400' };
    if (smoothing < 3) return { level: 'Medium', color: 'text-yellow-400' };
    return { level: 'High', color: 'text-green-400' };
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {beaconData.map(beacon => {
          const effectiveness = getFilterEffectiveness(beacon.rssi, beacon.filteredRSSI);
          const improvement = Math.abs(beacon.distance - beacon.actualDistance) - 
                            Math.abs(beacon.filteredRSSI - beacon.rssi) * 0.1;
          
          return (
            <Card key={beacon.id} className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-sm">{beacon.name}</span>
                  <span className="text-xs text-gray-400">({beacon.id})</span>
                </div>
                {getTrendIcon(beacon.rssi, beacon.filteredRSSI)}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Raw RSSI:</span>
                  <span className="text-red-300 font-mono">{beacon.rssi} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Filtered RSSI:</span>
                  <span className="text-green-300 font-mono">{beacon.filteredRSSI} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Smoothing:</span>
                  <span className={`font-mono ${effectiveness.color}`}>
                    {Math.abs(beacon.rssi - beacon.filteredRSSI).toFixed(1)} dBm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Effect Level:</span>
                  <span className={`text-xs ${effectiveness.color}`}>
                    {effectiveness.level}
                  </span>
                </div>
              </div>
              
              {/* Visual indicator */}
              <div className="mt-3 pt-2 border-t border-slate-600">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Noise Reduction</span>
                  <span>{Math.abs(beacon.rssi - beacon.filteredRSSI).toFixed(1)} dBm</span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-1.5">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, Math.abs(beacon.rssi - beacon.filteredRSSI) * 10)}%` 
                    }}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Summary */}
      <Card className="bg-slate-700/30 border-slate-600 p-4">
        <h3 className="text-white font-semibold mb-3">Kalman Filter Configuration</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Process Noise (Q)</p>
            <p className="text-white font-mono">0.0001</p>
          </div>
          <div>
            <p className="text-gray-400">Measurement Noise (R)</p>
            <p className="text-white font-mono">0.01</p>
          </div>
          <div>
            <p className="text-gray-400">Update Rate</p>
            <p className="text-white font-mono">1 Hz</p>
          </div>
          <div>
            <p className="text-gray-400">Active Beacons</p>
            <p className="text-white font-mono">{beaconData.length}/5</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-600">
          <p className="text-xs text-gray-400">
            The Kalman filter smooths RSSI fluctuations to improve distance accuracy. 
            Adjust Q (process noise) and R (measurement noise) parameters for optimal performance in your environment.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default KalmanFilterDisplay;
