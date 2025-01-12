import { PageNumberPlacementEnum } from "../enums/page-number-placement.enum";
import { IFontData } from "./font-data.interface";
import { ISizes } from './sizes.interface';
import { ICoordinateText } from "./text-part.interface";

export interface IPDFGenerativeData {
  pages: IPDFPageData[];
  generalSettings: IGeneralSettings;
  pageNumberSettings: IPageNumberSettings;
  headingPages: number[];
}

export interface IPDFPageData {
  coordinateText: ICoordinateText[];
}

export interface IGeneralSettings {
  id: string;
  sizes: ISizes;
  scale: number;
  knifeBorder: number;
  saveSizes?: ISizes;
  fontData: IFontData;
  fontSize: number;
  mirrorMargin: number;
  useTextInsteadOfVector: boolean;
}

export interface IPageNumberSettings {
  paddingTop: number;
  startFromPage: number;
  fontSize: number;
  placement: PageNumberPlacementEnum;
}