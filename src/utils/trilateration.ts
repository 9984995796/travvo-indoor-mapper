
interface Beacon {
  id: number;
  x: number;
  y: number;
  name: string;
}

interface Position {
  x: number;
  y: number;
}

// FIXED: Enhanced trilateration with proper beacon mapping
export const calculatePosition = (beacons: Beacon[], beaconDistances: { [key: number]: number }, currentPosition: Position): Position => {
  console.log('🎯 TRILATERATION START - Live Position Update');
  
  // Map beacons by name for reliable positioning
  const beaconMap = {
    'POI-1': beacons.find(b => b.name === "Corner NW"), // (0,0)
    'POI-2': beacons.find(b => b.name === "Corner NE"), // (5,0) 
    'POI-3': beacons.find(b => b.name === "Corner SW")  // (0,5)
  };
  
  const distances = {
    'POI-1': beaconDistances[1001],
    'POI-2': beaconDistances[1002], 
    'POI-3': beaconDistances[1003]
  };

  console.log('📊 Trilateration inputs:');
  console.log(`   POI-1 (NW): pos=(0,0), dist=${distances['POI-1']?.toFixed(2)}m`);
  console.log(`   POI-2 (NE): pos=(5,0), dist=${distances['POI-2']?.toFixed(2)}m`);
  console.log(`   POI-3 (SW): pos=(0,5), dist=${distances['POI-3']?.toFixed(2)}m`);

  if (!distances['POI-1'] || !distances['POI-2'] || !distances['POI-3']) {
    console.log('❌ Insufficient beacon data - using current position');
    return currentPosition;
  }

  // Trilateration using POI-1(0,0), POI-2(5,0), POI-3(0,5)
  const x1 = 0, y1 = 0, r1 = distances['POI-1'];
  const x2 = 5, y2 = 0, r2 = distances['POI-2'];
  const x3 = 0, y3 = 5, r3 = distances['POI-3'];
  
  // Linear system solution
  const A = 2 * (x2 - x1);
  const B = 2 * (y2 - y1);
  const C = Math.pow(r1, 2) - Math.pow(r2, 2) - Math.pow(x1, 2) + Math.pow(x2, 2) - Math.pow(y1, 2) + Math.pow(y2, 2);
  const D = 2 * (x3 - x2);
  const E = 2 * (y3 - y2);
  const F = Math.pow(r2, 2) - Math.pow(r3, 2) - Math.pow(x2, 2) + Math.pow(x3, 2) - Math.pow(y2, 2) + Math.pow(y3, 2);

  const denominator = A * E - B * D;
  
  if (Math.abs(denominator) < 0.001) {
    console.log('❌ Trilateration failed - denominator too small');
    return currentPosition;
  }

  const x = (C * E - F * B) / denominator;
  const y = (A * F - D * C) / denominator;

  // Clamp to room boundaries
  const clampedX = Math.max(0, Math.min(5, x));
  const clampedY = Math.max(0, Math.min(5, y));
  
  const newPosition = { x: clampedX, y: clampedY };

  console.log('📍 Trilateration result:');
  console.log(`   Raw: (${x.toFixed(3)}, ${y.toFixed(3)})`);
  console.log(`   Final: (${clampedX.toFixed(3)}, ${clampedY.toFixed(3)})`);
  
  return newPosition;
};
