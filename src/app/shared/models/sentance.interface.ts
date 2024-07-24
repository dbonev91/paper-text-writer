import { ImageTypeEnum } from "../enums/image-type.enum";
import { ITextPart } from "./text-part.interface";

export interface ISentance {
  id: string;
  isCentered?: boolean;
  shouldTextTransfer?: boolean;
  newLineAutoPrefix?: string;
  image?: ISentanceImage;
  textParts: ITextPart[];
}

export interface ISentanceImage {
  file: number[];
  width: number;
  height: number;
  type: ImageTypeEnum;
}
