import axios, { AxiosResponse } from "axios";
import { URLFormatter } from "../../../../../../paper-node-configuration/src/shared/classes/url-formatter.class";
import { httpsAgent } from "../../helpers/https.helper";
import { ITextMeasureResponse } from "../../models/text-measure-response.interface";
import { IPDFObjectSettings } from "../../models/pdf-object-settings.interface";
import { IDrawerSettingsResponse } from "../../models/drawer-settings-response.interface";
import { ImageTypeEnum } from "../../enums/image-type.enum";
import { IMeasureAllTextPartsRequestData } from "../../models/measure-all-text-parts-request-data.interface";
import { IPDFGenerativeData } from "../../models/pdf-generative-data.interface";

export default class PDFService extends URLFormatter {
  constructor () {
    super(process.env.PROTOCOL, process.env.LINK_TO_PAPER_PDF, Number(process.env.PAPER_PDF_PORT));
  }

  writeText (
    id: string,
    text: string,
    x: number,
    y: number,
    pageIndex: number
  ): Promise<AxiosResponse<any>> {
    return axios.post(
      `${this.url}/write-text-on-a-pdf-page/${id}`,
      { pageIndex, text, x, y },
      { httpsAgent }
    );
  }

  measureText (id: string, fontSize: number, text: string): Promise<AxiosResponse<ITextMeasureResponse>> {
    return axios.post(
      `${this.url}/measure-text-on-a-pdf/${id}`,
      { fontSize, text },
      { httpsAgent }
    )
  }

  changeDrawerObjectSettings (
    id: string,
    r?: number,
    g?: number,
    b?: number,
    fontSize?: number,
    fontFamily?: string
  ) {
    return axios.get(
      `${this.url}/change-drawer-settings/${id}?r=${r}&g=${g}&b=${b}&font-size=${fontSize || ''}&font-family=${fontFamily || ''}`,
      { httpsAgent }
    );
  }

  getDrawerObjectSettings (id: string): Promise<AxiosResponse<IDrawerSettingsResponse<IPDFObjectSettings>>> {
    return axios.get(
      `${this.url}/get-drawer-settings/${id}`,
      { httpsAgent }
    );
  }

  addImage (
    id: string,
    imageType: ImageTypeEnum,
    image: number[],
    pageIndex: number,
    width: number,
    height: number,
    x: number,
    y: number
  ): Promise<AxiosResponse<any>> {
    return axios.post(
      `${this.url}/add-image-to-pdf-page/${id}`,
      {
        imageType,
        image,
        pageIndex,
        width,
        height,
        x,
        y,
      },
      { httpsAgent });
  }

  measureMultipleTextParts (
    id: string,
    allTextParts: IMeasureAllTextPartsRequestData
  ): Promise<AxiosResponse<any>> {
    return axios.post(
      `${this.url}/measure-multiple-text-parts/${id}`,
      { allTextParts },
      { httpsAgent }
    )
  }

  arrangePDFParts (id: string): Promise<AxiosResponse<any>> {
    return axios.post(`${this.url}/arrange-pdf-from-parts/${id}`, { httpsAgent })
  }

  streamPDFParts (id: string): Promise<AxiosResponse<any>> {
    return axios.get(`${this.url}/stream-pdf-parts/${id}`,
      { httpsAgent }
    );
  }
}