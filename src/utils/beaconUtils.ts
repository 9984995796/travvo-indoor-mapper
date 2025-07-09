
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

// Enhanced iBeacon parser with comprehensive logging
export const parseIBeaconData = (manufacturerDataBuffer: ArrayBuffer, rssi: number): BeaconInfo | null => {
  try {
    console.log('🔍 ===========================================');
    console.log('🔍 PARSING IBEACON DATA');
    console.log('🔍 ===========================================');
    console.log('📊 Buffer length:', manufacturerDataBuffer.byteLength, 'bytes');
    console.log('📊 RSSI:', rssi, 'dBm');
    
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
    
    // Try multiple iBeacon format variations
    const formats = [
      { 
        name: "Standard Apple iBeacon",
        companyIdOffset: 0, 
        companyId: 0x004C, 
        typeOffset: 2, 
        type: 0x02, 
        lengthOffset: 3, 
        length: 0x15, 
        uuidOffset: 4 
      },
      { 
        name: "Big Endian Company ID",
        companyIdOffset: 0, 
        companyId: 0x4C00, 
        typeOffset: 2, 
        type: 0x02, 
        lengthOffset: 3, 
        length: 0x15, 
        uuidOffset: 4 
      },
      { 
        name: "With 2-byte prefix",
        companyIdOffset: 2, 
        companyId: 0x004C, 
        typeOffset: 4, 
        type: 0x02, 
        lengthOffset: 5, 
        length: 0x15, 
        uuidOffset: 6 
      },
    ];
    
    for (const format of formats) {
      try {
        console.log(`🔍 Trying format: ${format.name}`);
        
        if (manufacturerDataBuffer.byteLength < format.uuidOffset + 21) {
          console.log(`❌ Buffer too short for ${format.name}: need ${format.uuidOffset + 21}, have ${manufacturerDataBuffer.byteLength}`);
          continue;
        }
        
        // Check company ID (try both endianness)
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
    
    // If standard iBeacon parsing fails, try custom beacon detection
    console.log('🔄 Standard formats failed, trying custom beacon detection...');
    
    // Some ESP32 beacons might use different manufacturer data formats
    if (manufacturerDataBuffer.byteLength >= 21) {
      for (let offset = 0; offset <= manufacturerDataBuffer.byteLength - 21; offset++) {
        try {
          console.log(`🔍 Trying custom format at offset ${offset}...`);
          
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
          
          console.log(`   Extracted UUID: ${uuid}`);
          
          // Check if this looks like a valid UUID (has expected patterns)
          if (uuid.toLowerCase().includes('ab907856') || 
              uuid.toLowerCase().includes('3412')) {
            
            const major = dataView.getUint16(offset + 16, false);
            const minor = dataView.getUint16(offset + 18, false);
            const txPowerByte = dataView.getInt8(offset + 20);
            
            console.log(`✅ Custom format match at offset ${offset}:`);
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
            
            console.log('🎉 CUSTOM BEACON PARSING SUCCESS!');
            return beaconInfo;
          }
        } catch (customError) {
          console.log(`❌ Custom format at offset ${offset} failed:`, customError);
          continue;
        }
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

// RSSI to distance conversion using path-loss model
export const rssiToDistance = (rssi: number, txPower = -59) => {
  if (rssi === 0) return -1.0;
  
  const ratio = (txPower - rssi) / 20.0;
  const distance = Math.pow(10, ratio);
  
  // Apply some bounds (0.1m to 50m)
  const boundedDistance = Math.max(0.1, Math.min(50, distance));
  
  console.log(`📏 Distance calculation: RSSI=${rssi}, TxPower=${txPower}, Distance=${boundedDistance.toFixed(2)}m`);
  
  return boundedDistance;
};
