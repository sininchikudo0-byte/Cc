export enum CameraStatus {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  CAPTURING = 'CAPTURING',
  CAPTURED = 'CAPTURED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  ERROR = 'ERROR',
  UNSUPPORTED = 'UNSUPPORTED',
}

export interface Capture {
  src: string;
  label: string;
}
