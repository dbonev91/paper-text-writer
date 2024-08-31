import { ISizes } from "./sizes.interface";

export interface ISizesResponse {
  data: ISizesData;
}

export interface IWordSizesAndCharSizes {
  wordSizes: ISizes;
  charSizes: ISizes[];
}

export interface ISizesData {
  outputSizes: IWordSizesAndCharSizes[];
  dashSizesMap: Record<string, ISizes>;
}