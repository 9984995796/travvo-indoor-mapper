
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

// Enhanced trilateration algorithm with detailed logging
export const calculatePosition = (beacons: Beacon[], beaconDistances: { [key: number]: number }, currentPosition: Position): Position => {
  console.log('🎯 ===========================================');
  console.log('🎯 TRILATERATION CALCULATION START');
  console.log('🎯 ===========================================');
  
  // Use first three beacons for trilateration (POI-1, POI-2, POI-3)
  const b1 = beacons.find(b => b.id === 1001); // POI-1 at (0,0)
  const b2 = beacons.find(b => b.id === 1002); // POI-2 at (5,0)
  const b3 = beacons.find(b => b.id === 1003); // POI-3 at (0,5)
  
  const r1 = beaconDistances[1001];
  const r2 = beaconDistances[1002];
  const r3 = beaconDistances[1003];

  console.log('📊 Beacon positions and distances:');
  console.log(`   POI-1 (1001): Position=(${b1?.x}, ${b1?.y}), Distance=${r1?.toFixed(2)}m`);
  console.log(`   POI-2 (1002): Position=(${b2?.x}, ${b2?.y}), Distance=${r2?.toFixed(2)}m`);
  console.log(`   POI-3 (1003): Position=(${b3?.x}, ${b3?.y}), Distance=${r3?.toFixed(2)}m`);

  if (!r1 || !r2 || !r3 || !b1 || !b2 || !b3) {
    console.log('❌ Insufficient beacon data for trilateration');
    console.log('   Missing beacons or distances - using current position');
    return currentPosition;
  }

  console.log('🧮 Starting trilateration math...');
  
  // Trilateration equations:
  // (x - x1)² + (y - y1)² = r1²
  // (x - x2)² + (y - y2)² = r2²
  // (x - x3)² + (y - y3)² = r3²
  
  // Linearizing the equations:
  const A = 2 * (b2.x - b1.x);
  const B = 2 * (b2.y - b1.y);
  const C = Math.pow(r1, 2) - Math.pow(r2, 2) - Math.pow(b1.x, 2) + Math.pow(b2.x, 2) - Math.pow(b1.y, 2) + Math.pow(b2.y, 2);
  const D = 2 * (b3.x - b2.x);
  const E = 2 * (b3.y - b2.y);
  const F = Math.pow(r2, 2) - Math.pow(r3, 2) - Math.pow(b2.x, 2) + Math.pow(b3.x, 2) - Math.pow(b2.y, 2) + Math.pow(b3.y, 2);

  console.log('🧮 Trilateration coefficients:');
  console.log(`   A = 2 * (${b2.x} - ${b1.x}) = ${A}`);
  console.log(`   B = 2 * (${b2.y} - ${b1.y}) = ${B}`);
  console.log(`   C = ${C.toFixed(2)}`);
  console.log(`   D = 2 * (${b3.x} - ${b2.x}) = ${D}`);
  console.log(`   E = 2 * (${b3.y} - ${b2.y}) = ${E}`);
  console.log(`   F = ${F.toFixed(2)}`);

  const denominator = A * E - B * D;
  console.log(`🧮 Denominator: A*E - B*D = ${A}*${E} - ${B}*${D} = ${denominator}`);
  
  if (Math.abs(denominator) < 0.001) {
    console.log('❌ Trilateration calculation failed - denominator too small');
    console.log('   Beacons might be collinear - using current position');
    return currentPosition;
  }

  const x = (C * E - F * B) / denominator;
  const y = (A * F - D * C) / denominator;

  console.log('🧮 Raw trilateration result:');
  console.log(`   x = (${C.toFixed(2)} * ${E} - ${F.toFixed(2)} * ${B}) / ${denominator} = ${x.toFixed(3)}`);
  console.log(`   y = (${A} * ${F.toFixed(2)} - ${D} * ${C.toFixed(2)}) / ${denominator} = ${y.toFixed(3)}`);

  // Clamp to room boundaries (0-5 meters) with bounds checking
  const clampedX = Math.max(0, Math.min(5, x));
  const clampedY = Math.max(0, Math.min(5, y));
  
  const newPosition = {
    x: clampedX,
    y: clampedY
  };

  console.log('📍 Final position result:');
  console.log(`   Raw position: (${x.toFixed(3)}, ${y.toFixed(3)})`);
  console.log(`   Clamped position: (${clampedX.toFixed(3)}, ${clampedY.toFixed(3)})`);
  console.log(`   Room bounds: (0,0) to (5,5)`);
  
  // Validation check: verify distances make sense
  const dist1_calc = Math.sqrt(Math.pow(newPosition.x - b1.x, 2) + Math.pow(newPosition.y - b1.y, 2));
  const dist2_calc = Math.sqrt(Math.pow(newPosition.x - b2.x, 2) + Math.pow(newPosition.y - b2.y, 2));
  const dist3_calc = Math.sqrt(Math.pow(newPosition.x - b3.x, 2) + Math.pow(newPosition.y - b3.y, 2));
  
  console.log('✅ Distance validation:');
  console.log(`   POI-1: Expected=${r1.toFixed(2)}m, Calculated=${dist1_calc.toFixed(2)}m, Error=${Math.abs(r1 - dist1_calc).toFixed(2)}m`);
  console.log(`   POI-2: Expected=${r2.toFixed(2)}m, Calculated=${dist2_calc.toFixed(2)}m, Error=${Math.abs(r2 - dist2_calc).toFixed(2)}m`);
  console.log(`   POI-3: Expected=${r3.toFixed(2)}m, Calculated=${dist3_calc.toFixed(2)}m, Error=${Math.abs(r3 - dist3_calc).toFixed(2)}m`);
  
  console.log('🎯 TRILATERATION CALCULATION COMPLETE');
  return newPosition;
};
