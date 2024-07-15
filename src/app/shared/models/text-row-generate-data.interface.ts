import { IMargin } from "./text-part-margin.interface";
import { ITextPart } from "./text-part.interface";

export interface ITextRowGenerateData {
  isLastLine?: boolean;
  isCuttedLine?: boolean;
  isCentered?: boolean;
  fontSize?: number;
  margin?: IMargin;
  isNewSentanceStart?: boolean;
  shouldStartOnTheNextPage?: boolean;
  textParts: ITextPart[];
}