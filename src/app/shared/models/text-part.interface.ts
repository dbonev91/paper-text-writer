import { ISentanceImage } from "./sentance.interface";
import { IMargin } from "./text-part-margin.interface";

export interface ITextPart {
  text: string;
  sentanceId: string;
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