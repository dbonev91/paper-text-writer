import { ITextPart } from "./text-part.interface";

export interface ISentance {
  id: string;
  isCentered?: boolean;
  shouldTextTransfer?: boolean;
  newLineAutoPrefix?: string;
  textParts: ITextPart[];
}