import axios, { AxiosResponse } from "axios";
import { URLFormatter } from "../../../../../../paper-node-configuration/src/shared/classes/url-formatter.class";
import { httpsAgent } from "../../helpers/https.helper";
import { ITextMeasureResponse } from "../../models/text-measure-response.interface";
import { IPDFObjectSettings } from "../../models/pdf-object-settings.interface";
import { IDrawerSettingsResponse } from "../../models/drawer-settings-response.interface";

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
}