// Test-only literal query; Vitest's isolated Phase project loads the public32 fixture.
// This declaration grants no Native capability and is absent from the production graph.
declare module '*?test-before-phase-capture492' {
  export function captureNativeMessageForDeferred(value: unknown): unknown;
}
declare module '*?test-qualified-phase-capture492' {
  export function captureNativeMessageForDeferred297(value: unknown): unknown;
}
declare module '*?test-qualified-native-lane492' {
  export function createNativeCloneResidentLane(): import('../src/bridge/native-clone-resident').NativeCloneResidentLane;
}
