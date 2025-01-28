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
  isHeading?: boolean;
  isNewSentanceStart?: boolean;
  horizontalJustify?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  isCentered?: boolean;
  isBottom?: boolean;
  isVerticalCenter?: boolean;
  hasntShy?: boolean;
  dontJustify?: boolean;
  requiredJustify?: boolean;
  fontWeight?: string | number;
  fontFamily?: string;
  fontSize?: number;
  fontSerif?: boolean;
  margin?: IMargin;
  image?: ISentanceImage;
}

export interface ICoordinateText {
  text: string;
  ascii?: number;
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