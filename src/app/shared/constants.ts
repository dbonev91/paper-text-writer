import { ITextRowGenerateData } from "./models/text-row-generate-data.interface";

export const INITIAL_TEXT_ROW_DATA_OBJECT: ITextRowGenerateData = {
  textParts: []
}

export const DRAWER_ID_PARAM: string = 'drawerId';

export const sentanceIdPageMap: Record<string, Record<string, number>> = {};
export const sentanceIdsByPageMap: Record<string, Record<number, Record<string, number>>> = {};
