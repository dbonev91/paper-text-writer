import { IFontData } from "./font-data.interface";

export interface IMeasureAllTextPartsRequestData {
  textData: IMeasureTextData[];
  fontData: IFontData;
  fontSize: number;
}

export interface IMeasureTextData {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  fontSize?: number;
}