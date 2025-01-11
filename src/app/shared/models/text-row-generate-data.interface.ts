import { ISentanceImage } from "./sentance.interface";
import { IMargin } from "./text-part-margin.interface";
import { ITextPart } from "./text-part.interface";

export interface ITextRowGenerateData {
  isLastLine?: boolean;
  isCuttedLine?: boolean;
  isCentered?: boolean;
  isBottom?: boolean;
  isVerticalCenter?: boolean;
  fontSize?: number;
  margin?: IMargin;
  isNewSentanceStart?: boolean;
  shouldStartOnTheNextPage?: boolean;
  image?: ISentanceImage;
  textParts: ITextPart[];
}