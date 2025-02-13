import { ImageTypeEnum } from "../enums/image-type.enum";
import { ISizes } from "./sizes.interface";
import { ITextPart } from "./text-part.interface";

export interface ISentance {
  id: string;
  isCentered?: boolean;
  isBottom?: boolean;
  isVerticalCenter?: boolean;
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
  pageSizes: ISizes;
  fullInBox: boolean;
  verticalCenter?: boolean;
  bottom?: boolean;
}
