/**
 * Process-lifetime cache of upstream RPC capabilities.
 * After eth_simulateV1 returns unsupported (-32601 / -32602 / etc.),
 * skip that method for the same upstream URL for the rest of the process.
 * Same pattern for debug_traceCall (optional reason / log-proof path).
 */

const simulateV1Unsupported = new Set<string>();
const debugTraceCallUnsupported = new Set<string>();

export function isSimulateV1Unsupported(upstreamUrl: string): boolean {
  return simulateV1Unsupported.has(upstreamUrl);
}

export function markSimulateV1Unsupported(upstreamUrl: string): void {
  simulateV1Unsupported.add(upstreamUrl);
}

/** Test helper — clears process-lifetime cache. */
export function clearSimulateV1CapabilityCache(): void {
  simulateV1Unsupported.clear();
}

export function simulateV1UnsupportedCount(): number {
  return simulateV1Unsupported.size;
}

export function isDebugTraceCallUnsupported(upstreamUrl: string): boolean {
  return debugTraceCallUnsupported.has(upstreamUrl);
}

export function markDebugTraceCallUnsupported(upstreamUrl: string): void {
  debugTraceCallUnsupported.add(upstreamUrl);
}

export function clearDebugTraceCallCapabilityCache(): void {
  debugTraceCallUnsupported.clear();
}

/** Clears both capability caches (tests). */
export function clearAllCapabilityCaches(): void {
  clearSimulateV1CapabilityCache();
  clearDebugTraceCallCapabilityCache();
}

export function debugTraceCallUnsupportedCount(): number {
  return debugTraceCallUnsupported.size;
}
