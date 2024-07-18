import express from "express";
import cors from "cors";
import { PaperConfiguration } from '../../../paper-node-configuration/src/app';
import { IEnv } from "../../../paper-node-configuration/src/shared/models/env.interface";
import { prepareAllTextWithDashes, writeTextInsideBox } from "./shared/helpers/text.helper";
import { ISentance } from "./shared/models/sentance.interface";
import { DRAWER_ID_PARAM, sentanceIdPageMap, sentanceIdsByPageMap } from "./shared/constants";
import { ITextPart } from "./shared/models/text-part.interface";
import { ICoordinate } from "./shared/models/coordinate.interface";
import CanvasService from "./shared/services/canvas/canvas.service";
import PDFService from "./shared/services/pdf/pdf.service";
import { GenerationTypeEnum } from "./shared/enums/generation-type.enum";
import { IFontData } from "./shared/models/font-data.interface";


const app: express.Application = express();
const paperConfiguration: PaperConfiguration = new PaperConfiguration(process.env as IEnv, app);
app.disable("x-powered-by");
app.use(cors(paperConfiguration.getCorsOrigin()));

// Parse JSON bodies (as sent by API clients)
app.use(express.json({limit: '500mb'}));
app.use(express.urlencoded({limit: '500mb'}));

const canvasService: CanvasService = new CanvasService();
const pdfService: PDFService = new PDFService();

app.get(
  "/edno",
  async (request: express.Request, response: express.Response) => {
    return response.status(200).send('edno')
  }
);

app.post(
  "/prepare-all-text-with-dashes",
  async (request: express.Request, response: express.Response) => {
    const sentences: ISentance[] = request.body.sentences;

    if (!sentences || !sentences.length) {
      return response.status(400).json({
        status: 'error',
        message: 'You should provide sentences'
      });
    }

    return response.status(200).json({
      textParts: prepareAllTextWithDashes(sentences)
    });
  }
);

app.get(
  `/initialize-drawer/:${DRAWER_ID_PARAM}`,
  async (request: express.Request, response: express.Response) => {
    const sentanceIdPageMapData: any = sentanceIdPageMap;
    const sentanceIdsByPageMapData: any = sentanceIdsByPageMap;

    const drawerId: string = request.params[DRAWER_ID_PARAM];

    if (sentanceIdPageMapData[drawerId] || sentanceIdsByPageMapData[drawerId]) {
      return response.status(400).json({
        status: 'error',
        message: `Drawer with id: ${drawerId} already exists. please provide unique one`
      });
    }

    sentanceIdPageMapData[drawerId] = {};
    sentanceIdsByPageMapData[drawerId] = {};

    return response.status(200).json({
      status: 'success',
      message: `Drawer with id: ${drawerId} initialized`
    });
  }
);

app.get(
  `/destroy-drawer/:${DRAWER_ID_PARAM}`,
  async (request: express.Request, response: express.Response) => {
    const sentanceIdPageMapData: any = sentanceIdPageMap;
    const sentanceIdsByPageMapData: any = sentanceIdsByPageMap;

    const drawerId: string = request.params[DRAWER_ID_PARAM];

    if (!sentanceIdPageMapData[drawerId] || !sentanceIdsByPageMapData[drawerId]) {
      return response.status(400).json({
        status: 'error',
        message: `Drawer with id: ${drawerId} doesn't exists. please provide unique one`
      });
    }

    sentanceIdPageMapData[drawerId] = null;
    sentanceIdsByPageMapData[drawerId] = null;

    delete sentanceIdPageMapData[drawerId];
    delete sentanceIdsByPageMapData[drawerId];

    return response.status(200).json({
      status: 'success',
      message: `Drawer with id: ${drawerId} destroyed`
    });
  }
);

app.post(
  `/write-text-inside-box/:${DRAWER_ID_PARAM}`,
  async (request: express.Request, response: express.Response) => {
    const allTextPartsWithDashes: ITextPart[] = request.body.allTextPartsWithDashes;

    if (!allTextPartsWithDashes || !allTextPartsWithDashes.length) {
      return response.status(400).json({
        status: 'error',
        message: 'allTextPartsWithDashes should be provided'
      });
    }

    const textBox: ICoordinate = request.body.textBox;

    if (!textBox) {
      return response.status(400).json({
        status: 'error',
        message: 'textBox should be provided'
      });
    }

    const fontSize: number = Number(request.body.fontSize);

    if (isNaN(fontSize)) {
      return response.status(400).json({
        status: 'error',
        message: 'fontSize should be provided'
      });
    }

    const startHeight: number = Number(request.body.startHeight);

    if (isNaN(startHeight)) {
      return response.status(400).json({
        status: 'error',
        message: 'startHeight should be provided'
      });
    }

    const currentPage: number = Number(request.body.currentPage);

    if (isNaN(currentPage)) {
      return response.status(400).json({
        status: 'error',
        message: 'currentPage should be provided'
      });
    }

    const currentTextIndex: number[] = request.body.currentTextIndex;

    if (!currentTextIndex || !currentTextIndex.length) {
      return response.status(400).json({
        status: 'error',
        message: 'currentTextIndex should be provided'
      });
    }

    const processId: string = request.body.processId as string;

    if (!processId) {
      return response.status(400).json({
        status: 'error',
        message: 'processId should be provided'
      });
    }

    const fontData: IFontData = request.body.fontData as IFontData;
    const generationType: GenerationTypeEnum = request.body.generationType as GenerationTypeEnum;
    const r: number | undefined = request.body.r ? Number(request.body.r) : undefined;
    const g: number | undefined = request.body.g ? Number(request.body.g) : undefined;
    const b: number | undefined = request.body.b ? Number(request.body.b) : undefined;
    const paddingBottom: number | undefined = request.body.paddingBottom ? Number(request.body.paddingBottom) : undefined;

    console.log('HERE');

    try {
      return response.status(200).json({
        status: 'error',
        currentTextIndex: (await writeTextInsideBox(
          allTextPartsWithDashes,
          generationType,
          processId,
          textBox,
          fontSize,
          fontData,
          startHeight,
          request.params[DRAWER_ID_PARAM],
          canvasService,
          pdfService,
          currentPage,
          currentTextIndex,
          paddingBottom,
          r,
          g,
          b,
          request.body.lineHeight
        ))
      });
    } catch (error) {
      console.log(error)
      return response.status(400).json({
        status: 'error',
        error
      });
    }
  }
);

paperConfiguration.startNodeServer();