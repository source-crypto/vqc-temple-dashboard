import { api, StreamOut } from "encore.dev/api";
import log from "encore.dev/log";

export interface VQCStreamData {
  type: "metrics" | "attestation" | "harmonics" | "system";
  timestamp: Date;
  data: any;
}

export interface StreamHandshake {
  clientId: string;
  subscriptions: string[];
}

const connectedStreams: Set<StreamOut<VQCStreamData>> = new Set();

// Real-time VQC dashboard data stream.
export const vqcDashboardStream = api.streamOut<StreamHandshake, VQCStreamData>(
  { expose: true, path: "/stream/dashboard" },
  async (handshake, stream) => {
    log.info(`Client ${handshake.clientId} connected to VQC dashboard stream`);
    connectedStreams.add(stream);

    try {
      // Send initial data
      await stream.send({
        type: "system",
        timestamp: new Date(),
        data: {
          status: "connected",
          subscriptions: handshake.subscriptions,
          clientId: handshake.clientId
        }
      });

      // Start periodic updates
      const interval = setInterval(async () => {
        try {
          // Generate mock real-time data
          const mockMetrics = generateMockVQCMetrics();
          await stream.send({
            type: "metrics",
            timestamp: new Date(),
            data: mockMetrics
          });

          const mockHarmonics = generateMockHarmonics();
          await stream.send({
            type: "harmonics",
            timestamp: new Date(),
            data: mockHarmonics
          });
        } catch (err) {
          log.error("Error sending stream data:", err);
          clearInterval(interval);
          connectedStreams.delete(stream);
        }
      }, 1000); // Update every second

      // Keep the stream alive - this will run until the client disconnects
      await new Promise<void>((resolve) => {
        // Set up a cleanup function for when the stream closes
        const cleanup = () => {
          clearInterval(interval);
          connectedStreams.delete(stream);
          log.info(`Client ${handshake.clientId} disconnected from VQC dashboard stream`);
          resolve();
        };
      });
    } catch (error) {
      log.error(`Stream error for client ${handshake.clientId}:`, error);
      connectedStreams.delete(stream);
    }
  }
);

export async function broadcastToAllStreams(data: VQCStreamData): Promise<void> {
  const disconnectedStreams: StreamOut<VQCStreamData>[] = [];
  
  for (const stream of connectedStreams) {
    try {
      await stream.send(data);
    } catch (err) {
      log.error("Error broadcasting to stream:", err);
      disconnectedStreams.push(stream);
    }
  }
  
  // Clean up disconnected streams
  disconnectedStreams.forEach(stream => connectedStreams.delete(stream));
}

function generateMockVQCMetrics(): any {
  return {
    cycleCount: Math.floor(Math.random() * 1000000) + 500000,
    entropyLevel: Math.random() * 0.3 + 0.7, // 0.7-1.0
    systemHealth: Math.random() * 0.2 + 0.8, // 0.8-1.0
    quantumCoherence: Math.random() * 0.4 + 0.6, // 0.6-1.0
    temperature: Math.random() * 10 + 20, // 20-30°C
    powerConsumption: Math.random() * 50 + 100, // 100-150W
  };
}

function generateMockHarmonics(): any {
  const cpuFreq = Math.random() * 1000 + 2000; // 2-3 GHz
  const networkActivity = Math.random() * 100;
  
  return {
    cpuFrequency: cpuFreq,
    networkActivity: networkActivity,
    musicalPattern: {
      tempo: Math.round(Math.random() * 60 + 90), // 90-150 BPM
      key: ['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(Math.random() * 7)],
      harmonics: Array.from({ length: 8 }, (_, i) => 440 * Math.pow(2, i / 12))
    },
    laserSync: {
      beamCount: Math.floor(Math.random() * 4) + 4,
      rotationSpeed: Math.random() * 2 + 1,
      intensity: Math.random() * 0.5 + 0.5
    }
  };
}
