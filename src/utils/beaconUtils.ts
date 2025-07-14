export interface BeaconInfo {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  txPower: number;
}

export interface BeaconData {
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

// CORRECTED: Indoor RSSI to distance conversion with proper path-loss model
export const rssiToDistance = (rssi: number, txPower = -59) => {
  console.log(`🔧 DISTANCE CALC: RSSI=${rssi}dBm, TxPower=${txPower}dBm`);
  
  if (rssi === 0 || rssi > 0) {
    console.log('❌ Invalid RSSI (0 or positive)');
    return -1.0;
  }
  
  // FIXED: Proper indoor path loss model
  // Formula: distance = 10^((TxPower - RSSI) / (10 * n))
  // For indoor environment: n = 2.0 for realistic indoor propagation
  const n = 2.0; 
  const exponent = (txPower - rssi) / (10 * n);
  const rawDistance = Math.pow(10, exponent);
  
  console.log(`🔧 CALC STEPS: exponent=${exponent.toFixed(3)}, raw=${rawDistance.toFixed(3)}m`);
  
  // Realistic indoor bounds: 0.3m to 15m 
  const boundedDistance = Math.max(0.3, Math.min(15, rawDistance));
  
  console.log(`✅ FINAL DISTANCE: ${boundedDistance.toFixed(2)}m`);
  return boundedDistance;
};

// Enhanced iBeacon parser with comprehensive logging and CORRECTED UUID handling
export const parseIBeaconData = (manufacturerDataBuffer: ArrayBuffer, rssi: number): BeaconInfo | null => {
  try {
    console.log('🔍 ===========================================');
    console.log('🔍 PARSING IBEACON DATA (CORRECTED VERSION)');
    console.log('🔍 ===========================================');
    console.log('📊 Buffer length:', manufacturerDataBuffer.byteLength, 'bytes');
    console.log('📊 RSSI:', rssi, 'dBm');
    console.log('🎯 Expected UUID pattern: AB90 7856-3412-3412-3412-3412-7856-3412');
    
    if (manufacturerDataBuffer.byteLength < 25) {
      console.log('❌ Buffer too short for iBeacon:', manufacturerDataBuffer.byteLength, 'bytes (need 25+)');
      return null;
    }

    const dataView = new DataView(manufacturerDataBuffer);
    
    // Log ALL bytes for complete transparency
    const allBytes = [];
    for (let i = 0; i < manufacturerDataBuffer.byteLength; i++) {
      allBytes.push('0x' + dataView.getUint8(i).toString(16).padStart(2, '0'));
    }
    console.log('📊 ALL BYTES:', allBytes.join(' '));
    
    // Show first 10 bytes with positions
    const firstBytes = [];
    for (let i = 0; i < Math.min(10, manufacturerDataBuffer.byteLength); i++) {
      const byte = dataView.getUint8(i);
      firstBytes.push(`[${i}]:0x${byte.toString(16).padStart(2, '0')}`);
    }
    console.log('📊 First 10 bytes with positions:', firstBytes.join(' '));
    
    // Try multiple iBeacon format variations with CORRECTED Apple Company ID
    const formats = [
      { 
        name: "Standard Apple iBeacon (Little Endian)",
        companyIdOffset: 0, 
        companyId: 0x004C, 
        typeOffset: 2, 
        type: 0x02, 
        lengthOffset: 3, 
        length: 0x15, 
        uuidOffset: 4 
      },
      { 
        name: "Standard Apple iBeacon (Big Endian)",
        companyIdOffset: 0, 
        companyId: 0x4C00, 
        typeOffset: 2, 
        type: 0x02, 
        lengthOffset: 3, 
        length: 0x15, 
        uuidOffset: 4 
      },
      { 
        name: "ESP32 Custom Format (No Company Header)",
        companyIdOffset: -1, 
        companyId: 0x0000, 
        typeOffset: 0, 
        type: 0x02, 
        lengthOffset: 1, 
        length: 0x15, 
        uuidOffset: 2 
      },
      { 
        name: "Direct UUID at start",
        companyIdOffset: -1, 
        companyId: 0x0000, 
        typeOffset: -1, 
        type: 0x00, 
        lengthOffset: -1, 
        length: 0x00, 
        uuidOffset: 0 
      },
    ];
    
    for (const format of formats) {
      try {
        console.log(`🔍 Trying format: ${format.name}`);
        
        if (manufacturerDataBuffer.byteLength < format.uuidOffset + 21) {
          console.log(`❌ Buffer too short for ${format.name}: need ${format.uuidOffset + 21}, have ${manufacturerDataBuffer.byteLength}`);
          continue;
        }
        
        // Check company ID if specified
        if (format.companyIdOffset >= 0) {
          const companyId1 = dataView.getUint16(format.companyIdOffset, true); // Little endian
          const companyId2 = dataView.getUint16(format.companyIdOffset, false); // Big endian
          
          console.log(`   Company ID check:`);
          console.log(`     Little Endian: 0x${companyId1.toString(16).padStart(4, '0')}`);
          console.log(`     Big Endian:    0x${companyId2.toString(16).padStart(4, '0')}`);
          console.log(`     Expected:      0x${format.companyId.toString(16).padStart(4, '0')}`);
          
          if (companyId1 !== format.companyId && companyId2 !== format.companyId) {
            console.log(`❌ Company ID mismatch for ${format.name}`);
            continue;
          }
        }
        
        // Check type and length if specified
        if (format.typeOffset >= 0 && format.lengthOffset >= 0) {
          const beaconType = dataView.getUint8(format.typeOffset);
          const beaconLength = dataView.getUint8(format.lengthOffset);
          
          console.log(`   Type check:`);
          console.log(`     Found:    0x${beaconType.toString(16).padStart(2, '0')}`);
          console.log(`     Expected: 0x${format.type.toString(16).padStart(2, '0')}`);
          console.log(`   Length check:`);
          console.log(`     Found:    0x${beaconLength.toString(16).padStart(2, '0')}`);
          console.log(`     Expected: 0x${format.length.toString(16).padStart(2, '0')}`);
          
          if (beaconType !== format.type || beaconLength !== format.length) {
            console.log(`❌ Type/Length mismatch for ${format.name}`);
            continue;
          }
        }
        
        // Extract UUID (16 bytes)
        const uuidBytes = [];
        for (let i = format.uuidOffset; i < format.uuidOffset + 16; i++) {
          uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
        }
        
        const uuid = [
          uuidBytes.slice(0, 4).join(''),
          uuidBytes.slice(4, 6).join(''),
          uuidBytes.slice(6, 8).join(''),
          uuidBytes.slice(8, 10).join(''),
          uuidBytes.slice(10, 16).join('')
        ].join('-');
        
        // Extract Major and Minor (big endian)
        const major = dataView.getUint16(format.uuidOffset + 16, false);
        const minor = dataView.getUint16(format.uuidOffset + 18, false);
        const txPowerByte = dataView.getInt8(format.uuidOffset + 20);
        
        console.log(`✅ Successfully parsed with ${format.name}:`);
        console.log(`   UUID:     ${uuid}`);
        console.log(`   Major:    ${major}`);
        console.log(`   Minor:    ${minor}`);
        console.log(`   TX Power: ${txPowerByte} dBm`);
        console.log(`   RSSI:     ${rssi} dBm`);
        
        // Check if this matches our expected UUID pattern (AB90 7856...)
        const cleanUuid = uuid.toLowerCase().replace(/-/g, '');
        console.log(`🎯 UUID Pattern Check:`);
        console.log(`   Found:    ${cleanUuid}`);
        console.log(`   Expected: ab90785634123412341234127856341*`);
        
        if (cleanUuid.startsWith('ab907856')) {
          console.log(`🎯 UUID PATTERN MATCH! This looks like our beacon!`);
        }
        
        const beaconInfo = {
          uuid: uuid,
          major: major,
          minor: minor,
          rssi: rssi,
          txPower: txPowerByte
        };
        
        console.log('🎉 BEACON PARSING SUCCESS!');
        return beaconInfo;
      } catch (formatError) {
        console.log(`❌ ${format.name} parsing failed:`, formatError);
        continue;
      }
    }
    
    // If standard iBeacon parsing fails, try direct UUID search for AB90 pattern
    console.log('🔄 Standard formats failed, trying direct AB90 pattern search...');
    
    for (let offset = 0; offset <= manufacturerDataBuffer.byteLength - 16; offset++) {
      try {
        const firstBytes = [
          dataView.getUint8(offset),
          dataView.getUint8(offset + 1)
        ];
        
        // Look for AB90 pattern (0xAB 0x90)
        if (firstBytes[0] === 0xAB && firstBytes[1] === 0x90) {
          console.log(`🎯 Found AB90 pattern at offset ${offset}!`);
          
          if (manufacturerDataBuffer.byteLength >= offset + 21) {
            const uuidBytes = [];
            for (let i = offset; i < offset + 16; i++) {
              uuidBytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
            }
            
            const uuid = [
              uuidBytes.slice(0, 4).join(''),
              uuidBytes.slice(4, 6).join(''),
              uuidBytes.slice(6, 8).join(''),
              uuidBytes.slice(8, 10).join(''),
              uuidBytes.slice(10, 16).join('')
            ].join('-');
            
            const major = dataView.getUint16(offset + 16, false);
            const minor = dataView.getUint16(offset + 18, false);
            const txPowerByte = dataView.getInt8(offset + 20);
            
            console.log(`✅ AB90 Pattern match at offset ${offset}:`);
            console.log(`   UUID:     ${uuid}`);
            console.log(`   Major:    ${major}`);
            console.log(`   Minor:    ${minor}`);
            console.log(`   TX Power: ${txPowerByte} dBm`);
            
            const beaconInfo = {
              uuid: uuid,
              major: major,
              minor: minor,
              rssi: rssi,
              txPower: txPowerByte
            };
            
            console.log('🎉 AB90 PATTERN BEACON PARSING SUCCESS!');
            return beaconInfo;
          }
        }
      } catch (customError) {
        console.log(`❌ AB90 pattern search at offset ${offset} failed:`, customError);
        continue;
      }
    }
    
    console.log('❌ Could not parse as any known beacon format');
    console.log('💡 This might not be an iBeacon, or it might use a different format');
    return null;
    
  } catch (error) {
    console.error('❌ Error parsing beacon data:', error);
    return null;
  }
};
