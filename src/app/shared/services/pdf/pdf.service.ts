import axios, { AxiosResponse } from "axios";
import { URLFormatter } from "../../../../../../paper-node-configuration/src/shared/classes/url-formatter.class";
import { httpsAgent } from "../../helpers/https.helper";
import { ITextMeasureResponse } from "../../models/text-measure-response.interface";

export default class PDFService extends URLFormatter {
  constructor () {
    super(process.env.PROTOCOL, process.env.LINK_TO_PAPER_PDF, Number(process.env.PAPER_PDF_PORT));
  }

  writeText (
    id: string,
    pageIndex: number,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    r: number,
    g: number,
    b: number
  ): Promise<AxiosResponse<any>> {
    return axios.post(
      `${this.url}/write-text-on-a-pdf-page/${id}`,
      { pageIndex, text, x, y, fontSize, r, g, b },
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
}