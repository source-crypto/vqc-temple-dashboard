import { api, APIError } from "encore.dev/api";
import { templeDB } from "./db";
import { logAuditEvent } from "./audit";
import { validateHarmonicsData } from "./validation";

export interface SystemHarmonics {
  id: number;
  timestamp: Date;
  cpuFrequency: number;
  networkActivity: number;
  dbStats: any;
  musicalPattern: any;
  laserSyncData: any;
}

export interface CreateHarmonicsRequest {
  cpuFrequency: number;
  networkActivity: number;
  dbStats: any;
}

export interface HarmonicsResponse {
  harmonics: SystemHarmonics;
}

export interface HarmonicsListResponse {
  harmonics: SystemHarmonics[];
}

// Creates new system harmonics data with musical patterns and laser sync.
export const createHarmonics = api<CreateHarmonicsRequest, HarmonicsResponse>(
  { expose: true, method: "POST", path: "/harmonics" },
  async (req) => {
    try {
      // Input validation
      validateHarmonicsData(req);

      const musicalPattern = generateMusicalPattern(req.cpuFrequency, req.networkActivity);
      const laserSyncData = generateLaserSync(musicalPattern);

      const row = await templeDB.queryRow<{
        id: number;
        timestamp: Date;
        cpu_frequency: number;
        network_activity: number;
        db_stats: any;
        musical_pattern: any;
        laser_sync_data: any;
      }>`
        INSERT INTO system_harmonics (
          cpu_frequency, network_activity, db_stats, musical_pattern, laser_sync_data
        )
        VALUES (
          ${req.cpuFrequency}, ${req.networkActivity}, 
          ${JSON.stringify(req.dbStats)}, ${JSON.stringify(musicalPattern)}, 
          ${JSON.stringify(laserSyncData)}
        )
        RETURNING *
      `;

      if (!row) {
        throw new Error("Failed to create system harmonics");
      }

      const harmonics = {
        id: row.id,
        timestamp: row.timestamp,
        cpuFrequency: row.cpu_frequency,
        networkActivity: row.network_activity,
        dbStats: row.db_stats,
        musicalPattern: row.musical_pattern,
        laserSyncData: row.laser_sync_data,
      };

      // Audit log
      await logAuditEvent(
        'create_harmonics',
        'system_harmonics',
        {
          harmonicsId: harmonics.id,
          cpuFrequency: req.cpuFrequency,
          networkActivity: req.networkActivity,
          tempo: musicalPattern.tempo
        },
        'success',
        undefined,
        harmonics.id.toString()
      );

      return { harmonics };
    } catch (error) {
      // Audit log for failure
      await logAuditEvent(
        'create_harmonics',
        'system_harmonics',
        {
          cpuFrequency: req.cpuFrequency,
          networkActivity: req.networkActivity,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        'failure',
        undefined,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }
);

// Retrieves system harmonics data.
export const getHarmonics = api<void, HarmonicsListResponse>(
  { expose: true, method: "GET", path: "/harmonics" },
  async () => {
    try {
      const rows = await templeDB.queryAll<{
        id: number;
        timestamp: Date;
        cpu_frequency: number;
        network_activity: number;
        db_stats: any;
        musical_pattern: any;
        laser_sync_data: any;
      }>`
        SELECT * FROM system_harmonics 
        ORDER BY timestamp DESC 
        LIMIT 50
      `;

      const harmonics = rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        cpuFrequency: row.cpu_frequency,
        networkActivity: row.network_activity,
        dbStats: row.db_stats,
        musicalPattern: row.musical_pattern,
        laserSyncData: row.laser_sync_data,
      }));

      return { harmonics };
    } catch (error) {
      console.error('Failed to get harmonics:', error);
      throw APIError.internal("Failed to retrieve system harmonics");
    }
  }
);

function generateMusicalPattern(cpuFreq: number, networkActivity: number): any {
  // Convert system metrics to musical patterns
  const baseFreq = 440; // A4
  const cpuNote = Math.round((cpuFreq / 1000) % 12); // Map to chromatic scale
  const networkRhythm = Math.max(1, Math.round(networkActivity / 10));
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const frequencies = [];
  
  // Generate harmonic series based on CPU frequency
  for (let i = 0; i < 8; i++) {
    const harmonic = baseFreq * Math.pow(2, (cpuNote + i * 2) / 12);
    frequencies.push({
      note: notes[(cpuNote + i * 2) % 12],
      frequency: harmonic,
      amplitude: Math.max(0.1, 1 - (i * 0.15)),
      duration: networkRhythm * 0.25
    });
  }
  
  return {
    tempo: Math.max(60, Math.min(180, networkRhythm * 20)),
    key: notes[cpuNote],
    frequencies: frequencies,
    pattern: generateRhythmPattern(networkActivity),
    harmonicSeries: frequencies.map(f => f.frequency)
  };
}

function generateRhythmPattern(networkActivity: number): number[] {
  const basePattern = [1, 0, 1, 0, 1, 0, 1, 0]; // Basic 4/4 beat
  const complexity = Math.round(networkActivity / 25);
  
  // Add complexity based on network activity
  for (let i = 0; i < complexity && i < basePattern.length; i++) {
    if (Math.random() > 0.5) {
      basePattern[i * 2 + 1] = 0.5; // Add syncopation
    }
  }
  
  return basePattern;
}

function generateLaserSync(musicalPattern: any): any {
  return {
    beamCount: Math.min(8, musicalPattern.frequencies.length),
    colors: musicalPattern.frequencies.map((freq: any, index: number) => ({
      hue: (freq.frequency / 10) % 360,
      saturation: 80 + (freq.amplitude * 20),
      brightness: 50 + (freq.amplitude * 50),
      position: index * 45 // degrees
    })),
    syncPattern: musicalPattern.pattern.map((beat: number) => ({
      intensity: beat,
      duration: 0.125, // 1/8 note
      strobe: beat > 0.5
    })),
    rotationSpeed: musicalPattern.tempo / 60, // RPM based on tempo
    effects: {
      prism: true,
      fog: musicalPattern.tempo > 120,
      mirror: true,
      kaleidoscope: musicalPattern.frequencies.length > 4
    }
  };
}
