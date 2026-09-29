import type {
  CameraProviderStatus,
  CameraRecord,
} from "@workspace/api-zod";

export type CameraProviderSnapshot = {
  provider: CameraProviderStatus;
  cameras: CameraRecord[];
};

export interface CameraProviderAdapter {
  id: string;
  name: string;
  attribution: string;
  catalogueUrl: string;
  getSnapshot(): Promise<CameraProviderSnapshot>;
}