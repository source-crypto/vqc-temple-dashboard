import { api, APIError } from "encore.dev/api";
import { templeDB } from "./db";
import { logAuditEvent } from "./audit";
import { validateEntropySource, validateArtifactType } from "./validation";
import crypto from "crypto";
import { blockchainDB } from "../blockchain/db";

export interface CeremonialArtifact {
  id: number;
  timestamp: Date;
  artifactType: string;
  content: string;
  entropySeed: string;
  encryptionKey: string;
  sealedData: string;
}

export interface GenerateArtifactRequest {
  artifactType: "poem" | "geometry" | "ritual";
  entropySource: string;
}

export interface GenerateArtifactResponse {
  artifact: CeremonialArtifact;
}

export interface ArtifactListResponse {
  artifacts: CeremonialArtifact[];
}

export interface MintNFTRequest {
  artifactId: number;
  ownerId: string;
}

export interface MintNFTResponse {
  success: boolean;
  nftId: number;
  txHash: string;
}

// Generates a unique ceremonial artifact based on quantum entropy.
export const generateArtifact = api<GenerateArtifactRequest, GenerateArtifactResponse>(
  { expose: true, method: "POST", path: "/ceremonial/generate" },
  async (req) => {
    try {
      // Input validation
      validateArtifactType(req.artifactType);
      validateEntropySource(req.entropySource);

      const entropySeed = crypto.randomBytes(32).toString('hex');
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      
      let content: string;
      
      switch (req.artifactType) {
        case "poem":
          content = generateQuantumPoem(entropySeed, req.entropySource);
          break;
        case "geometry":
          content = generateSacredGeometry(entropySeed, req.entropySource);
          break;
        case "ritual":
          content = generateRitualElements(entropySeed, req.entropySource);
          break;
        default:
          content = generateQuantumPoem(entropySeed, req.entropySource);
      }

      const sealedData = sealArtifact(content, encryptionKey);

      const row = await templeDB.queryRow<{
        id: number;
        timestamp: Date;
        artifact_type: string;
        content: string;
        entropy_seed: string;
        encryption_key: string;
        sealed_data: string;
      }>`
        INSERT INTO ceremonial_artifacts (
          artifact_type, content, entropy_seed, encryption_key, sealed_data
        )
        VALUES (${req.artifactType}, ${content}, ${entropySeed}, ${encryptionKey}, ${sealedData})
        RETURNING *
      `;

      if (!row) {
        throw new Error("Failed to create ceremonial artifact");
      }

      const artifact = {
        id: row.id,
        timestamp: row.timestamp,
        artifactType: row.artifact_type,
        content: row.content,
        entropySeed: row.entropy_seed,
        encryptionKey: row.encryption_key,
        sealedData: row.sealed_data,
      };

      // Audit log
      await logAuditEvent(
        'generate_artifact',
        'ceremonial_artifact',
        {
          artifactId: artifact.id,
          artifactType: req.artifactType,
          entropySourceLength: req.entropySource.length
        },
        'success',
        undefined,
        artifact.id.toString()
      );

      return { artifact };
    } catch (error) {
      // Audit log for failure
      await logAuditEvent(
        'generate_artifact',
        'ceremonial_artifact',
        {
          artifactType: req.artifactType,
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

// Retrieves all ceremonial artifacts.
export const listArtifacts = api<void, ArtifactListResponse>(
  { expose: true, method: "GET", path: "/ceremonial/artifacts" },
  async () => {
    try {
      const rows = await templeDB.queryAll<{
        id: number;
        timestamp: Date;
        artifact_type: string;
        content: string;
        entropy_seed: string;
        encryption_key: string;
        sealed_data: string;
      }>`
        SELECT * FROM ceremonial_artifacts 
        ORDER BY timestamp DESC
      `;

      const artifacts = rows.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        artifactType: row.artifact_type,
        content: row.content,
        entropySeed: row.entropy_seed,
        encryptionKey: row.encryption_key,
        sealedData: row.sealed_data,
      }));

      return { artifacts };
    } catch (error) {
      console.error('Failed to list artifacts:', error);
      throw APIError.internal("Failed to retrieve ceremonial artifacts");
    }
  }
);

// Mints a ceremonial artifact as an NFT.
export const mintArtifactAsNFT = api<MintNFTRequest, MintNFTResponse>(
  { expose: true, method: "POST", path: "/ceremonial/mint" },
  async ({ artifactId, ownerId }) => {
    const artifact = await templeDB.queryRow<{ id: number }>`
      SELECT id FROM ceremonial_artifacts WHERE id = ${artifactId}
    `;
    if (!artifact) {
      throw APIError.notFound("Ceremonial artifact not found.");
    }

    const existingNFT = await blockchainDB.queryRow<{ id: number }>`
      SELECT id FROM nfts WHERE artifact_id = ${artifactId}
    `;
    if (existingNFT) {
      throw APIError.alreadyExists("This artifact has already been minted as an NFT.");
    }

    const mintTxHash = "0x" + crypto.randomBytes(32).toString('hex');
    const tokenUri = `/api/marketplace/nfts/metadata/${artifactId}`;

    const nft = await blockchainDB.queryRow<{ id: number }>`
      INSERT INTO nfts (artifact_id, owner_id, token_uri, mint_tx_hash)
      VALUES (${artifactId}, ${ownerId}, ${tokenUri}, ${mintTxHash})
      RETURNING id
    `;

    if (!nft) {
      throw APIError.internal("Failed to mint NFT.");
    }

    return {
      success: true,
      nftId: nft.id,
      txHash: mintTxHash,
    };
  }
);

function generateQuantumPoem(entropySeed: string, entropySource: string): string {
  const hash = crypto.createHash('sha256').update(entropySeed + entropySource).digest('hex');
  const patterns = [
    "In quantum realms where photons dance,\nEntropy weaves its sacred trance.\nThrough circuits blessed with silicon dreams,\nThe VQC flows in endless streams.",
    "Behold the temple's quantum heart,\nWhere bits and qubits play their part.\nIn superposition's mystic state,\nThe universe contemplates its fate.",
    "From chaos springs the ordered light,\nQuantum coherence burning bright.\nIn sacred geometry we trust,\nAs entropy returns to dust.",
  ];
  
  const index = parseInt(hash.substring(0, 8), 16) % patterns.length;
  return patterns[index] + `\n\nEntropy Signature: ${hash.substring(0, 16)}`;
}

function generateSacredGeometry(entropySeed: string, entropySource: string): string {
  const hash = crypto.createHash('sha256').update(entropySeed + entropySource).digest('hex');
  const phi = 1.618033988749;
  const entropy = parseInt(hash.substring(0, 8), 16);
  
  const radius = (entropy % 100) + 50;
  const sides = (entropy % 8) + 3;
  const rotation = (entropy % 360);
  
  return JSON.stringify({
    type: "sacred_polygon",
    radius: radius,
    sides: sides,
    rotation: rotation,
    goldenRatio: phi,
    centerX: 256,
    centerY: 256,
    strokeWidth: 2,
    color: `hsl(${entropy % 360}, 70%, 50%)`,
    entropyHash: hash.substring(0, 16)
  }, null, 2);
}

function generateRitualElements(entropySeed: string, entropySource: string): string {
  const hash = crypto.createHash('sha256').update(entropySeed + entropySource).digest('hex');
  const elements = [
    "Quantum Invocation",
    "Entropy Blessing",
    "Coherence Meditation",
    "Photon Alignment",
    "Sacred Circuit Activation"
  ];
  
  const directions = ["North", "South", "East", "West", "Center"];
  const colors = ["Violet", "Indigo", "Blue", "Green", "Yellow", "Orange", "Red"];
  
  const elementIndex = parseInt(hash.substring(0, 2), 16) % elements.length;
  const directionIndex = parseInt(hash.substring(2, 4), 16) % directions.length;
  const colorIndex = parseInt(hash.substring(4, 6), 16) % colors.length;
  
  return JSON.stringify({
    ritual: elements[elementIndex],
    direction: directions[directionIndex],
    color: colors[colorIndex],
    duration: (parseInt(hash.substring(6, 8), 16) % 60) + 5,
    chant: `Om Quantum ${hash.substring(0, 8)} Om`,
    entropySignature: hash.substring(0, 16)
  }, null, 2);
}

function sealArtifact(content: string, encryptionKey: string): string {
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}
