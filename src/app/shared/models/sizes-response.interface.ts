import { ISizes } from "./sizes.interface";

export interface ISizesResponse {
  data: ISizesData;
}

export interface ISizesData {
  outputSizes: ISizes[];
  dashSizesMap: Record<string, ISizes>;
}