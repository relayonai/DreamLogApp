// Stub — full implementation in Task 11 (Swift native module)
export const DreamLogRecorder = {
  startRecording: (): Promise<string> => Promise.resolve(''),
  stopRecording: (): Promise<string> => Promise.resolve(''),
  scheduleWakeWindow: (_startHour: number, _startMinute: number): Promise<void> => Promise.resolve(),
  cancelWakeWindow: (): Promise<void> => Promise.resolve(),
};
