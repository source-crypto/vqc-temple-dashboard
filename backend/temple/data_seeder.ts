import { templeDB } from "./db";
import { api } from "encore.dev/api";
import crypto from "crypto";

async function seedTempleDatabase(): Promise<void> {
  console.log('Starting Temple data seeding...');

  try {
    // Seed VQC metrics
    await seedVQCMetrics();
    
    // Seed attestation records
    await seedAttestationRecords();
    
    // Seed activation tokens
    await seedActivationTokens();
    
    // Seed ceremonial artifacts
    await seedCeremonialArtifacts();
    
    // Seed system harmonics
    await seedSystemHarmonics();
    
    console.log('Temple data seeding completed successfully');
  } catch (error) {
    console.error('Failed to seed Temple data:', error);
    throw error;
  }
}

async function seedVQCMetrics(): Promise<void> {
  const existingCount = await templeDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM vqc_metrics
  `;

  if (existingCount && existingCount.count > 0) {
    console.log('VQC metrics already exist, skipping...');
    return;
  }

  console.log('Seeding VQC metrics...');
  
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(Date.now() - (i * 60000)); // Every minute for last 50 minutes
    
    await templeDB.exec`
      INSERT INTO vqc_metrics (
        timestamp, cycle_count, entropy_level, system_health,
        quantum_coherence, temperature, power_consumption
      )
      VALUES (
        ${timestamp},
        ${Math.floor(Math.random() * 1000000) + 500000},
        ${Math.random() * 0.3 + 0.7},
        ${Math.random() * 0.2 + 0.8},
        ${Math.random() * 0.4 + 0.6},
        ${Math.random() * 10 + 20},
        ${Math.random() * 50 + 100}
      )
    `;
  }
}

async function seedAttestationRecords(): Promise<void> {
  const existingCount = await templeDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM attestation_records
  `;

  if (existingCount && existingCount.count > 0) {
    console.log('Attestation records already exist, skipping...');
    return;
  }

  console.log('Seeding attestation records...');
  
  const pcrValues = {
    pcr0: "a1b2c3d4e5f6789012345678901234567890abcd",
    pcr1: "b2c3d4e5f6789012345678901234567890abcdef1",
    pcr2: "c3d4e5f6789012345678901234567890abcdef12",
    pcr3: "d4e5f6789012345678901234567890abcdef123",
    pcr4: "e5f6789012345678901234567890abcdef1234",
    pcr5: "f6789012345678901234567890abcdef12345",
    pcr6: "789012345678901234567890abcdef123456",
    pcr7: "89012345678901234567890abcdef1234567",
  };

  for (let i = 0; i < 15; i++) {
    const timestamp = new Date(Date.now() - (i * 3600000)); // Every hour for last 15 hours
    const tpmQuote = `SEED_TPM_QUOTE_${crypto.randomBytes(16).toString('hex')}`;
    const signature = `SEED_SIGNATURE_${crypto.randomBytes(32).toString('hex')}`;
    const canonicalHash = crypto.createHash('sha256').update(JSON.stringify(pcrValues)).digest('hex');
    
    // Create a mix of verification statuses
    let verificationStatus: string;
    let blockchainTxHash: string | null = null;
    
    if (i < 5) {
      verificationStatus = 'verified';
      // Some verified attestations should be published to blockchain
      if (i < 3) {
        blockchainTxHash = "0x" + crypto.randomBytes(32).toString('hex');
      }
    } else if (i < 10) {
      verificationStatus = 'pending';
    } else {
      verificationStatus = 'failed';
    }
    
    await templeDB.exec`
      INSERT INTO attestation_records (
        timestamp, pcr_values, tmp_quote, signature, canonical_hash, verification_status, blockchain_tx_hash
      )
      VALUES (
        ${timestamp},
        ${JSON.stringify(pcrValues)},
        ${tpmQuote},
        ${signature},
        ${canonicalHash},
        ${verificationStatus},
        ${blockchainTxHash}
      )
    `;
  }
}

async function seedActivationTokens(): Promise<void> {
  const existingCount = await templeDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM activation_tokens
  `;

  if (existingCount && existingCount.count > 0) {
    console.log('Activation tokens already exist, skipping...');
    return;
  }

  console.log('Seeding activation tokens...');
  
  for (let i = 0; i < 12; i++) {
    const tokenId = crypto.randomUUID();
    const yubikeySerial = `SEED${String(i + 1).padStart(6, '0')}`;
    const createdAt = new Date(Date.now() - (i * 86400000)); // Every day for last 12 days
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
    
    // Create a mix of active/inactive tokens
    let isActive: boolean;
    if (i < 8) {
      isActive = true; // First 8 are active
    } else {
      isActive = false; // Last 4 are inactive
    }
    
    // Create different patterns for Shamir shares
    let shamirShares: string[] | null = null;
    let threshold: number | null = null;
    
    if (i % 3 === 0) {
      // Every third token has Shamir shares
      const shareCount = Math.floor(Math.random() * 20) + 8; // 8-28 shares
      shamirShares = [];
      for (let j = 0; j < shareCount; j++) {
        shamirShares.push(`share_${i}_${j}_${crypto.randomBytes(8).toString('hex')}`);
      }
      threshold = Math.floor(shareCount * 0.6) + 1; // 60% threshold + 1
    }
    
    await templeDB.exec`
      INSERT INTO activation_tokens (
        token_id, yubikey_serial, shamir_shares, threshold, created_at, expires_at, is_active
      )
      VALUES (
        ${tokenId}, ${yubikeySerial}, ${shamirShares ? JSON.stringify(shamirShares) : null},
        ${threshold}, ${createdAt}, ${expiresAt}, ${isActive}
      )
    `;
  }
}

async function seedCeremonialArtifacts(): Promise<void> {
  const existingCount = await templeDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM ceremonial_artifacts
  `;

  if (existingCount && existingCount.count > 0) {
    console.log('Ceremonial artifacts already exist, skipping...');
    return;
  }

  console.log('Seeding ceremonial artifacts...');
  
  const artifactTypes = ['poem', 'geometry', 'ritual'];
  
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(Date.now() - (i * 1800000)); // Every 30 minutes
    const artifactType = artifactTypes[i % artifactTypes.length];
    const entropySeed = crypto.randomBytes(32).toString('hex');
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    let content: string;
    switch (artifactType) {
      case 'poem':
        content = `In quantum realms where photons dance,\nEntropy weaves its sacred trance.\nSeed ${i + 1} of cosmic light,\nGuiding us through endless night.\n\nThrough circuits blessed with silicon dreams,\nThe VQC flows in endless streams.\nIn superposition's mystic state,\nThe universe contemplates its fate.`;
        break;
      case 'geometry':
        content = JSON.stringify({
          type: "sacred_polygon",
          radius: 50 + (i * 5),
          sides: 3 + (i % 8),
          rotation: i * 15,
          goldenRatio: 1.618033988749,
          centerX: 256,
          centerY: 256,
          strokeWidth: 2,
          color: `hsl(${i * 24}, 70%, 50%)`,
          entropyHash: entropySeed.substring(0, 16)
        });
        break;
      case 'ritual':
        content = JSON.stringify({
          ritual: `Quantum Invocation ${i + 1}`,
          direction: ['North', 'South', 'East', 'West', 'Center'][i % 5],
          color: ['Violet', 'Indigo', 'Blue', 'Green', 'Yellow', 'Orange', 'Red'][i % 7],
          duration: 5 + (i % 60),
          chant: `Om Quantum ${entropySeed.substring(0, 8)} Om`,
          entropySignature: entropySeed.substring(0, 16)
        });
        break;
      default:
        content = 'Unknown artifact type';
    }
    
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let sealedData = cipher.update(content, 'utf8', 'hex');
    sealedData += cipher.final('hex');
    sealedData = iv.toString('hex') + ':' + sealedData;
    
    await templeDB.exec`
      INSERT INTO ceremonial_artifacts (
        timestamp, artifact_type, content, entropy_seed, encryption_key, sealed_data
      )
      VALUES (
        ${timestamp}, ${artifactType}, ${content}, ${entropySeed}, ${encryptionKey}, ${sealedData}
      )
    `;
  }
}

async function seedSystemHarmonics(): Promise<void> {
  const existingCount = await templeDB.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM system_harmonics
  `;

  if (existingCount && existingCount.count > 0) {
    console.log('System harmonics already exist, skipping...');
    return;
  }

  console.log('Seeding system harmonics...');
  
  for (let i = 0; i < 25; i++) {
    const timestamp = new Date(Date.now() - (i * 300000)); // Every 5 minutes
    const cpuFrequency = Math.random() * 1000 + 2000; // 2-3 GHz
    const networkActivity = Math.random() * 100;
    
    const dbStats = {
      connections: Math.floor(Math.random() * 50) + 10,
      queries_per_second: Math.floor(Math.random() * 1000) + 100,
      cache_hit_ratio: Math.random() * 0.3 + 0.7
    };
    
    const musicalPattern = {
      tempo: Math.max(60, Math.min(180, Math.round(networkActivity * 2))),
      key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)],
      frequencies: Array.from({ length: 8 }, (_, j) => ({
        note: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][j % 7],
        frequency: 440 * Math.pow(2, j / 12),
        amplitude: Math.max(0.1, 1 - (j * 0.15)),
        duration: 0.25
      }))
    };
    
    const laserSyncData = {
      beamCount: Math.min(8, musicalPattern.frequencies.length),
      rotationSpeed: musicalPattern.tempo / 60,
      colors: musicalPattern.frequencies.map((freq: any, index: number) => ({
        hue: (freq.frequency / 10) % 360,
        saturation: 80,
        brightness: 70,
        position: index * 45
      })),
      effects: {
        prism: true,
        fog: musicalPattern.tempo > 120,
        mirror: true,
        kaleidoscope: musicalPattern.frequencies.length > 4
      }
    };
    
    await templeDB.exec`
      INSERT INTO system_harmonics (
        timestamp, cpu_frequency, network_activity, db_stats, musical_pattern, laser_sync_data
      )
      VALUES (
        ${timestamp}, ${cpuFrequency}, ${networkActivity},
        ${JSON.stringify(dbStats)}, ${JSON.stringify(musicalPattern)}, ${JSON.stringify(laserSyncData)}
      )
    `;
  }
}

// API endpoint to trigger data seeding for the temple service
export const seedTempleData = api<void, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/admin/seed-temple" },
  async () => {
    try {
      await seedTempleDatabase();
      return {
        success: true,
        message: "Temple data seeded successfully"
      };
    } catch (error) {
      console.error('Failed to seed temple data:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to seed Temple data"
      };
    }
  }
);
