import { ISentanceImage } from "./sentance.interface";
import { ISizes } from "./sizes.interface";
import { IMargin } from "./text-part-margin.interface";

export interface ITextPart {
  text: string;
  sentanceId: string;
  index?: number;
  sizes?: ISizes;
  newLineAutoPrefix?: string;
  shouldStartOnTheNextPage?: boolean;
  isNewSentanceStart?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  isCentered?: boolean;
  hasntShy?: boolean;
  dontJustify?: boolean;
  fontWeight?: string | number;
  fontFamily?: string;
  fontSize?: number;
  fontSerif?: boolean;
  margin?: IMargin;
  image?: ISentanceImage;
}

export interface ICoordinateText {
  text: string;
  x: number;
  y: number;
  page: number;
  r: number;
  g: number;
  b: number;
  image?: ISentanceImage;
  isBold?: boolean;
  isItalic?: boolean;
  fontSize?: number;
}