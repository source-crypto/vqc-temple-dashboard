import { APIError } from "encore.dev/api";

export function validateYubikeySerial(serial: string): void {
  if (!serial || typeof serial !== 'string') {
    throw APIError.invalidArgument("YubiKey serial is required and must be a string");
  }
  
  if (serial.length < 4 || serial.length > 20) {
    throw APIError.invalidArgument("YubiKey serial must be between 4 and 20 characters");
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(serial)) {
    throw APIError.invalidArgument("YubiKey serial must contain only alphanumeric characters");
  }
}

export function validateYubikeyOTP(otp: string): void {
  if (!otp || typeof otp !== 'string') {
    throw APIError.invalidArgument("YubiKey OTP is required and must be a string");
  }
  
  if (otp.length !== 44) {
    throw APIError.invalidArgument("YubiKey OTP must be exactly 44 characters long");
  }
  
  if (!/^[cbdefghijklnrtuv]+$/.test(otp)) {
    throw APIError.invalidArgument("YubiKey OTP contains invalid characters");
  }
}

export function validateShamirShares(shares: string[], threshold?: number): void {
  if (!Array.isArray(shares)) {
    throw APIError.invalidArgument("Shamir shares must be an array");
  }
  
  if (shares.length === 0) {
    throw APIError.invalidArgument("At least one Shamir share is required");
  }
  
  if (shares.length > 255) {
    throw APIError.invalidArgument("Too many Shamir shares (maximum 255)");
  }
  
  for (const share of shares) {
    if (!share || typeof share !== 'string') {
      throw APIError.invalidArgument("Each Shamir share must be a non-empty string");
    }
    
    if (share.length < 10 || share.length > 1000) {
      throw APIError.invalidArgument("Shamir share length must be between 10 and 1000 characters");
    }
  }
  
  if (threshold !== undefined) {
    if (typeof threshold !== 'number' || threshold < 1) {
      throw APIError.invalidArgument("Threshold must be a positive number");
    }
    
    if (threshold > shares.length) {
      throw APIError.invalidArgument("Threshold cannot be greater than the number of shares");
    }
  }
}

export function validateExpirationHours(hours: number): void {
  if (typeof hours !== 'number' || hours < 1) {
    throw APIError.invalidArgument("Expiration hours must be a positive number");
  }
  
  if (hours > 8760) { // 1 year
    throw APIError.invalidArgument("Expiration hours cannot exceed 8760 (1 year)");
  }
}

export function validateTPMQuote(quote: string): void {
  if (!quote || typeof quote !== 'string') {
    throw APIError.invalidArgument("TPM quote is required and must be a string");
  }
  
  if (quote.length < 10 || quote.length > 10000) {
    throw APIError.invalidArgument("TPM quote length must be between 10 and 10000 characters");
  }
}

export function validateSignature(signature: string): void {
  if (!signature || typeof signature !== 'string') {
    throw APIError.invalidArgument("Signature is required and must be a string");
  }
  
  if (signature.length < 10 || signature.length > 10000) {
    throw APIError.invalidArgument("Signature length must be between 10 and 10000 characters");
  }
}

export function validatePCRValues(pcrValues: any): void {
  if (!pcrValues || typeof pcrValues !== 'object') {
    throw APIError.invalidArgument("PCR values are required and must be an object");
  }
  
  const requiredPCRs = ['pcr0', 'pcr1', 'pcr2', 'pcr3', 'pcr4', 'pcr5', 'pcr6', 'pcr7'];
  
  for (const pcr of requiredPCRs) {
    if (!pcrValues[pcr] || typeof pcrValues[pcr] !== 'string') {
      throw APIError.invalidArgument(`${pcr} is required and must be a string`);
    }
    
    if (!/^[a-fA-F0-9]{40}$/.test(pcrValues[pcr])) {
      throw APIError.invalidArgument(`${pcr} must be a 40-character hexadecimal string`);
    }
  }
}

export function validateEntropySource(entropySource: string): void {
  if (!entropySource || typeof entropySource !== 'string') {
    throw APIError.invalidArgument("Entropy source is required and must be a string");
  }
  
  if (entropySource.length < 1 || entropySource.length > 10000) {
    throw APIError.invalidArgument("Entropy source length must be between 1 and 10000 characters");
  }
}

export function validateArtifactType(artifactType: string): void {
  const validTypes = ['poem', 'geometry', 'ritual'];
  
  if (!artifactType || typeof artifactType !== 'string') {
    throw APIError.invalidArgument("Artifact type is required and must be a string");
  }
  
  if (!validTypes.includes(artifactType)) {
    throw APIError.invalidArgument(`Artifact type must be one of: ${validTypes.join(', ')}`);
  }
}

export function validateVQCMetrics(metrics: any): void {
  const requiredFields = [
    'cycleCount', 'entropyLevel', 'systemHealth', 
    'quantumCoherence', 'temperature', 'powerConsumption'
  ];
  
  for (const field of requiredFields) {
    if (metrics[field] === undefined || metrics[field] === null) {
      throw APIError.invalidArgument(`${field} is required`);
    }
    
    if (typeof metrics[field] !== 'number') {
      throw APIError.invalidArgument(`${field} must be a number`);
    }
  }
  
  // Validate ranges
  if (metrics.cycleCount < 0) {
    throw APIError.invalidArgument("Cycle count must be non-negative");
  }
  
  if (metrics.entropyLevel < 0 || metrics.entropyLevel > 1) {
    throw APIError.invalidArgument("Entropy level must be between 0 and 1");
  }
  
  if (metrics.systemHealth < 0 || metrics.systemHealth > 1) {
    throw APIError.invalidArgument("System health must be between 0 and 1");
  }
  
  if (metrics.quantumCoherence < 0 || metrics.quantumCoherence > 1) {
    throw APIError.invalidArgument("Quantum coherence must be between 0 and 1");
  }
  
  if (metrics.temperature < -273.15) {
    throw APIError.invalidArgument("Temperature cannot be below absolute zero");
  }
  
  if (metrics.powerConsumption < 0) {
    throw APIError.invalidArgument("Power consumption must be non-negative");
  }
}

export function validateHarmonicsData(data: any): void {
  if (!data || typeof data !== 'object') {
    throw APIError.invalidArgument("Harmonics data is required and must be an object");
  }
  
  if (typeof data.cpuFrequency !== 'number' || data.cpuFrequency <= 0) {
    throw APIError.invalidArgument("CPU frequency must be a positive number");
  }
  
  if (typeof data.networkActivity !== 'number' || data.networkActivity < 0) {
    throw APIError.invalidArgument("Network activity must be a non-negative number");
  }
  
  if (!data.dbStats || typeof data.dbStats !== 'object') {
    throw APIError.invalidArgument("Database stats are required and must be an object");
  }
}
