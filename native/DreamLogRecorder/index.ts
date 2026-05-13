import { NativeModulesProxy } from 'expo-modules-core';

const Mod = NativeModulesProxy.DreamLogRecorder;

export const DreamLogRecorder = {
  startRecording: (): Promise<string> => Mod.startRecording(),
  stopRecording: (): Promise<string> => Mod.stopRecording(),
  scheduleWakeWindow: (startHour: number, startMinute: number): Promise<void> =>
    Mod.scheduleWakeWindow(startHour, startMinute),
  cancelWakeWindow: (): Promise<void> => Mod.cancelWakeWindow(),
};
