import { ITextPart } from "./text-part.interface";

export interface INewLineCurrentWidthAndTextPart {
    isNewLine: boolean;
    currentWidth: number;
    textPart: ITextPart;
}