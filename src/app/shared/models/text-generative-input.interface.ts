import { ISentance } from "./sentance.interface";
import { GenerationTypeEnum } from '../enums/generation-type.enum';
import { IFontFilePaths } from "./directory.interface";
import { ICoordinate } from "./coordinate.interface";

export interface ITextGeneratveInput {
  sentences: ISentance[];
  fontSize: number;
  fontFamily: string;
  fontFilePaths: IFontFilePaths;
  textRectangles?: ICoordinate[];
  r?: number;
  g?: number;
  b?: number;
  mirrorMargin: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  scale: number;
  generationType: GenerationTypeEnum;
  startHeight: number;
  lineHeight: number;
  pageNumbersPaddingTop: number;
  pageNumbersFromPage: number;
  pageNumbersFontSize: number;
  bookBodyHeadingsAutoPrefixValue: boolean;
  useTextInsteadOfVector: boolean;
}