import axios, { AxiosResponse } from "axios";
import { httpsAgent } from "../../helpers/https.helper";
import { URLFormatter } from '../../../../../../paper-node-configuration/src/shared/classes/url-formatter.class';
import { IDrawerSettingsResponse } from "../../models/drawer-settings-response.interface";
import { IFileBufferInput } from "../../models/file-buffer-input.interface";
import { ITextMeasureResponse } from "../../models/text-measure-response.interface";

export default class CanvasService extends URLFormatter {
  constructor () {
    super(process.env.PROTOCOL, process.env.LINK_TO_PAPER_NODE_CANVAS, Number(process.env.PAPER_NODE_CANVAS_PORT));
  }

  measureText (id: string, text: string): Promise<AxiosResponse<ITextMeasureResponse>> {
    return axios.get(
      `${this.url}/measure-text/${id}?drawerText=${text}`, {
        httpsAgent
      }
    );
  }

  changeDrawerObjectSettings (id: string, font?: string, fillStyle?: string, textAlign?: string, textBaseline?: string) {
    return axios.get(
      `${this.url}/change-drawer-object-settings/${id}?drawerFont=${font}&drawerFillStyle=${fillStyle}&drawerTextAlign=${textAlign}&drawerTextBaseline=${textBaseline}`, {
        httpsAgent
      }
    );
  }

  getDrawerObjectSettings (id: string): Promise<AxiosResponse<IDrawerSettingsResponse<CanvasRenderingContext2D>>> {
    return axios.get(
      `${this.url}/get-drawer-object-settings/${id}`, {
        httpsAgent
      }
    );
  }

  fillTextOnDrawer (id: string, text: string, x: number, y: number) {
    return axios.post(
      `${this.url}/fill-text/${id}?drawerText=${text}&drawerX=${x}&drawerY=${y}`, {
        httpsAgent
      }
    )
  }

  getDrawerOutputImage (id: string): Promise<AxiosResponse<IFileBufferInput>> {
    return axios.post(
      `${this.url}/get-stream/${id}`, {
        httpsAgent
      }
    )
  }

  getManyDocuments(collectionName: string, filter?: string) {
    const filterParam: string = filter ? `?filter=${filter}` : '';

    return axios.get(
      `${this.url}/generic/get/many/${collectionName}${filterParam}`, {
        httpsAgent
      }
    );
  }
}