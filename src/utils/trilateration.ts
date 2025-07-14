
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

// FIXED: Enhanced trilateration with live distance integration
export const calculatePosition = (beacons: Beacon[], beaconDistances: { [key: number]: number }, currentPosition: Position): Position => {
  console.log('🎯 TRILATERATION START - Live Position Update');
  console.log('📊 Raw beacon distances received:', beaconDistances);
  
  // Map beacons by ID for reliable positioning
  const beacon1 = beacons.find(b => b.id === 1001); // Corner NW (0,0)
  const beacon2 = beacons.find(b => b.id === 1002); // Corner NE (5,0) 
  const beacon3 = beacons.find(b => b.id === 1003); // Corner SW (0,5)
  
  const distance1 = beaconDistances[1001];
  const distance2 = beaconDistances[1002]; 
  const distance3 = beaconDistances[1003];

  console.log('📊 Trilateration inputs:');
  console.log(`   Beacon 1001 (NW): pos=(0,0), dist=${distance1?.toFixed(3)}m`);
  console.log(`   Beacon 1002 (NE): pos=(5,0), dist=${distance2?.toFixed(3)}m`);
  console.log(`   Beacon 1003 (SW): pos=(0,5), dist=${distance3?.toFixed(3)}m`);

  // Require at least 3 beacons with valid distances
  if (!distance1 || !distance2 || !distance3 || 
      distance1 <= 0 || distance2 <= 0 || distance3 <= 0) {
    console.log('❌ Insufficient beacon data - using current position');
    console.log(`   Missing distances: 1001=${distance1}, 1002=${distance2}, 1003=${distance3}`);
    return currentPosition;
  }

  // Trilateration using live distances: NW(0,0), NE(5,0), SW(0,5)
  const x1 = 0, y1 = 0, r1 = distance1;
  const x2 = 5, y2 = 0, r2 = distance2;
  const x3 = 0, y3 = 5, r3 = distance3;
  
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
