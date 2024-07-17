import { AxiosResponse } from "axios";
import { INITIAL_TEXT_ROW_DATA_OBJECT, sentanceIdPageMap, sentanceIdsByPageMap } from "../constants";
import { FontSerifEnum } from "../enums/font-serif.enum";
import { FontStyleEnum } from "../enums/font-style.enum";
import { ICoordinate } from "../models/coordinate.interface";
import { ISentance } from "../models/sentance.interface";
import { ISizes } from "../models/sizes.interface";
import { ITextMeasureResponse } from "../models/text-measure-response.interface";
import { IMargin } from "../models/text-part-margin.interface";
import { ITextPart } from "../models/text-part.interface";
import { ITextRowGenerateData } from "../models/text-row-generate-data.interface";
import CanvasService from "../services/canvas/canvas.service";
import { placeShy, SHY, NEW, INV, DEFAULT_SPECIAL_SYMBOL_VALUE_MAP, SPECIAL_SYMBOL_MAP, EMPTY_SPECIAL_SYMBOL_VALUE_MAP, SPACE } from "./string/string.helper";
import { IDrawerSettingsResponse } from "../models/drawer-settings-response.interface";
import PDFService from "../services/pdf/pdf.service";
import { GenerationTypeEnum } from "../enums/generation-type.enum";
import { IFontData } from "../models/font-data.interface";
import { IPDFObjectSettings } from "../models/pdf-object-settings.interface";

export const prepareAllTextWithDashes = (sentences: ISentance[]): ITextPart[] => {
  const groupedNewLines: ITextPart[] = [];

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence: ISentance = sentences[i];
    const textParts: ITextPart[] = sentence.textParts;

    groupedNewLines.push(
      textParts.reduce(
        (accumulator: ITextPart, current: ITextPart) => {
          const accumulatorText: string = accumulator.text || '';

          return {
            ...sentence,
            ...current,
            text: newRowText(i, `${accumulatorText}${current.text}`, sentence.newLineAutoPrefix)
          }
        },
        {} as ITextPart
      )
    );
  }

  let newLines: ITextPart[] = [];

  for (let i = 0; i < groupedNewLines.length; i += 1) {
    const groupedLine: ITextPart = groupedNewLines[i];
    const texts: string[] = splitByNewLine(replaceDoubleRN(groupedLine.text))
      .map((text: string, index: number) => newRowText(index, text, groupedLine.newLineAutoPrefix));

    newLines = newLines.concat(
      texts.map((text: string) => {
        return {
          ...groupedLine,
          text
        }
      }
    ));
  }

  const allTextParts: ITextPart[] = [];

  for (let m = 0; m < newLines.length; m += 1) {
    let spacesQueue: boolean[] = [false];
    let charsQueue: boolean[] = [false];

    const lineData: ITextPart = newLines[m];
    const line: string = lineData.text;

    for (let k = 0; k < line.length; k += 1) {
      const currentChar: ITextPart = {
        ...lineData,
        text: line[k]
      }


      isOnlySpaces(currentChar.text) ?
        addTextPart(spacesQueue[0], currentChar, allTextParts, charsQueue, spacesQueue) :
        addTextPart(charsQueue[0], currentChar, allTextParts, spacesQueue, charsQueue);
    }
  }

  let allTextPartsWithDashes: ITextPart[] = [];
  const sentanceIdMap: Record<string, boolean> = {};

  for (let i = 0; i < allTextParts.length; i += 1) {
    const currentTextPart: ITextPart = allTextParts[i];
    const currentText: string = currentTextPart.text;
    const dashedText: string = currentTextPart.hasntShy ? currentText : placeShy(currentText);

    if (dashedText.indexOf(SHY) === -1) {
      allTextPartsWithDashes.push({
        ...allTextParts[i],
        text: currentText,
        isNewSentanceStart: sentanceIdMap[allTextParts[i].sentanceId] ? false : true,
        shouldStartOnTheNextPage: !sentanceIdMap[allTextParts[i].sentanceId] ? allTextParts[i].shouldStartOnTheNextPage : false
      });

      sentanceIdMap[allTextParts[i].sentanceId] = true;

      continue;
    }

    const splittedDashedText: ITextPart[] = dashedText.split(SHY).map((text: string) => {
      const output: ITextPart = {
        ...allTextParts[i],
        text,
        isNewSentanceStart: sentanceIdMap[allTextParts[i].sentanceId] ? false : true,
        shouldStartOnTheNextPage: !sentanceIdMap[allTextParts[i].sentanceId] ? allTextParts[i].shouldStartOnTheNextPage : false
      };

      sentanceIdMap[allTextParts[i].sentanceId] = true;
      
      return output;
    });

    const dashesCount: number = splittedDashedText.length - 1;

    for (let j = 1; j < splittedDashedText.length + dashesCount; j += 2) {
      if (j >= splittedDashedText.length) {
        continue;
      }

      splittedDashedText.splice(j, 0, {
        ...allTextParts[i],
        text: SHY,
        isNewSentanceStart: sentanceIdMap[allTextParts[i].sentanceId] ? false : true,
        shouldStartOnTheNextPage: !sentanceIdMap[allTextParts[i].sentanceId] ? allTextParts[i].shouldStartOnTheNextPage : false
      });

      sentanceIdMap[allTextParts[i].sentanceId] = true;
    }

    allTextPartsWithDashes = allTextPartsWithDashes.concat(splittedDashedText);
  }

  return allTextPartsWithDashes;
}

export const writeTextInsideBox = async (
  allTextPartsWithDashes: ITextPart[],
  generationType: GenerationTypeEnum,
  processId: string,
  textBox: ICoordinate,
  fontSize: number,
  fontData: IFontData,
  startHeight: number,
  drawerId: string,
  canvasService: CanvasService,
  pdfService: PDFService,
  currentPage: number,
  currentTextIndex: number[],
  r?: number,
  g?: number,
  b?: number,
  lineHeight?: number
): Promise<number[]> => {
  let textRowIndex: number = 0;
  let currentWidth: number = 0;
  let currentHeight: number = startHeight;
  const currentLineHeight: number = (lineHeight || fontSize);

  const textRowData: ITextRowGenerateData[] = [];
  const lastLineIndexMap: Record<number, number> = {};
  const cuttedLinesIndexMap: Record<number, number> = {};

  for (let i = 0; i < allTextPartsWithDashes.length; i += 1) {
    const previousTextPart: ITextPart = allTextPartsWithDashes[i - 1];
    const currentTextPart: ITextPart = allTextPartsWithDashes[i];
    let textPartSizes: ISizes;

    try {
      textPartSizes = await measureTheTextWidthAndHeight(
        generationType,
        drawerId,
        processId,
        fontSize,
        fontData,
        currentTextPart,
        canvasService,
        pdfService,
        EMPTY_SPECIAL_SYMBOL_VALUE_MAP
      );
    } catch (error) {
      throw error;
    }

    const previousText: string = previousTextPart ? previousTextPart.text : '';
    
    if (currentTextPart.text !== NEW && currentTextPart.text !== SHY) {
      currentWidth += textPartSizes.width;
    }

    const isNewLine: boolean = (currentTextPart.text.indexOf(NEW) >= 0);

    if (isNewLine) {
      lastLineIndexMap[textRowIndex] = textRowIndex;
    }

    attachInitialTextObject(textRowData, textRowIndex);

    textRowData[textRowIndex].isNewSentanceStart = currentTextPart.isNewSentanceStart;
    textRowData[textRowIndex].shouldStartOnTheNextPage = currentTextPart.shouldStartOnTheNextPage;

    if (
      textRowData &&
      textRowData[textRowIndex] &&
      textRowData[textRowIndex].fontSize &&
      currentTextPart.fontSize
    ) {
      textRowData[textRowIndex].fontSize =
        (Number(textRowData[textRowIndex].fontSize) > currentTextPart.fontSize) ?
          textRowData[textRowIndex].fontSize :
          currentTextPart.fontSize;
    }

    if (
      textRowData &&
      textRowData[textRowIndex] &&
      !textRowData[textRowIndex].fontSize &&
      currentTextPart.fontSize
    ) {
      textRowData[textRowIndex].fontSize = currentTextPart.fontSize;
    }

    if ((currentWidth > textBox.width) || isNewLine) {
      if (previousText === SHY) {
        textRowData[textRowIndex].textParts.push({
          ...textRowData[textRowIndex].textParts[0],
          text: SHY,
          sentanceId: currentTextPart.sentanceId
        });
      }

      if (isOnlySpaces(previousText)) {
        textRowData[textRowIndex].textParts.pop();
      }

      const shouldJumpToTheNextPage: boolean = Boolean(textRowData[textRowIndex] && textRowData[textRowIndex].shouldStartOnTheNextPage);

      if (
        i &&
        (
          shouldJumpToTheNextPage ||
          (currentHeight + getCurrentTop(textRowIndex, currentLineHeight, startHeight, textRowData[textRowIndex]?.margin?.top || 0, textRowData, textRowIndex - 2) >= textBox.height)
        )
      ) {
        cuttedLinesIndexMap[textRowIndex] = textRowIndex;

        currentTextIndex.pop();
        currentTextIndex.push(i);

        break;
      }

      if (textRowData[textRowIndex].textParts.length) {
        textRowIndex += 1;
        currentHeight = getCurrentTop(textRowIndex, currentLineHeight, startHeight, textRowData[textRowIndex]?.margin?.top || 0, textRowData);
        currentWidth = isNewLine ? 0 : textPartSizes.width;
      } else {
        delete lastLineIndexMap[textRowIndex];
      }
    }

    attachInitialTextObject(textRowData, textRowIndex);

    if ((currentTextPart.text !== SHY) && (currentTextPart.text !== NEW)) {
      if (!textRowData[textRowIndex].textParts.length && currentTextPart.text === ' ') {
        continue;
      }

      if (currentTextPart.text.indexOf(NEW) >= 0) {
        currentTextPart.text = currentTextPart.text.split(NEW)[1];
      }

      textRowData[textRowIndex].textParts.push(currentTextPart);

      const margin: IMargin = textRowData[textRowIndex].margin || {};

      if (sentanceIdPageMap[drawerId][currentTextPart.sentanceId] === currentPage) {
        margin.top = currentTextPart?.margin?.top || 0;

        const keys: string[] = Object.keys(sentanceIdsByPageMap[drawerId][currentPage] || {});

        for (let i = 0; i < keys.length; i += 1) {
          margin.top += keys[i] !== currentTextPart.sentanceId ? sentanceIdsByPageMap[drawerId][currentPage][keys[i]] : 0;
        }

        textRowData[textRowIndex].margin = margin;
      }

      if (!sentanceIdsByPageMap[drawerId][currentPage]) {
        sentanceIdsByPageMap[drawerId][currentPage] = {};
      }

      sentanceIdsByPageMap[drawerId][currentPage][currentTextPart.sentanceId] = currentTextPart?.margin?.top || 0;

      if (sentanceIdPageMap[drawerId][currentTextPart.sentanceId] === undefined) {
        sentanceIdPageMap[drawerId][currentTextPart.sentanceId] = currentPage;
      }
    }
  }

  const justifyStep: number[] = [];

  for (let i = 0; i < textRowData.length; i += 1) {
    const textRow: ITextRowGenerateData = textRowData[i];
    let textWidth: number = 0;

    for (let i = 0; i < textRow.textParts.length; i += 1) {
      const textPart: ITextPart = textRow.textParts[i];
      let currentTextPartSizes: ISizes;

      try {
        currentTextPartSizes = await measureTheTextWidthAndHeight(
          generationType,
          drawerId,
          processId,
          fontSize,
          fontData,
          textPart,
          canvasService,
          pdfService
        );
      } catch (error) {
        throw error;
      }

      textWidth += currentTextPartSizes.width;
    }

    const difference: number = textBox.width - textWidth;

    if (!difference) {
      justifyStep.push(0);
      continue;
    }
    
    let spacesCount: number = textRow.textParts.filter((textPart: ITextPart) => textPart.text === ' ').length;

    justifyStep.push(difference / spacesCount);
  }

  for (let i = 0; i < textRowData.length; i += 1) {
    const textRow: ITextRowGenerateData = textRowData[i];
    let entireTextWidth: number = 0;

    if (textRow.textParts && textRow.textParts.length && textRow.textParts[0].isCentered) {
      for (let i = 0; i < textRow.textParts.length; i += 1) {
        const textPart: ITextPart = textRow.textParts[i];
        let currentTextPartSizes: ISizes;
  
        try {
          currentTextPartSizes = await measureTheTextWidthAndHeight(
            generationType,
            drawerId,
            processId,
            fontSize,
            fontData,
            textPart,
            canvasService,
            pdfService
          );
        } catch (error) {
          throw error;
        }

        entireTextWidth += currentTextPartSizes.width;
      }
    }

    const prefixSpace: number = entireTextWidth ? (textBox.width - entireTextWidth) / 2 : 0;

    let left: number = 0;

    for (let j = 0; j < textRow.textParts.length; j += 1) {
      const textPartObject: ITextPart = textRow.textParts[j];
      let textPartMeasure: ISizes;
      
      try {
        textPartMeasure = await measureTheTextWidthAndHeight(
          generationType,
          drawerId,
          processId,
          fontSize,
          fontData,
          textPartObject,
          canvasService,
          pdfService
        );
      } catch (error) {
        throw error;
      }
      
      const isASpace: boolean = textPartObject.text === ' ';
      const noLastLine: boolean = isNaN(lastLineIndexMap[i]);
      const noLastLineOfTheCurrentSentace: boolean = i < (textRowData.length - 1);
      const isLastLineCutted: boolean = !isNaN(cuttedLinesIndexMap[i]);

      if (!textPartObject.dontJustify && 
        isASpace && noLastLine && (isLastLineCutted || noLastLineOfTheCurrentSentace)) {
        left += justifyStep[i];
      }

      let oldFillStyle: string;

      try {
        oldFillStyle = (await getDrawerObjectSettings(drawerId, processId, canvasService, pdfService, generationType)).fillStyle as string;
      } catch (error) {
        throw error;
      }

      if (textPartObject.text === INV) {
        try {
          await (generationType === GenerationTypeEnum.CANVAS ?
            canvasService.changeDrawerObjectSettings(drawerId, undefined, 'transparent') :
            pdfService.changeDrawerObjectSettings(processId, 255, 255, 255))
        } catch (error) {
          throw error;
        }
      }

      try {
        await (generationType === GenerationTypeEnum.CANVAS ?
          canvasService.changeDrawerObjectSettings(drawerId, getCtxFont(fontSize, textPartObject)) :
          pdfService.changeDrawerObjectSettings(processId, undefined, undefined, undefined, textRowData[i]?.fontSize || currentLineHeight, getPDFFont(textPartObject, fontData)));
      } catch (error) {
        throw error;
      }

      const currentTop: number = getCurrentTop(
        i,
        currentLineHeight,
        startHeight,
        textRowData[i]?.margin?.top || 0,
        textRowData
      );
      const text: string = formatSpecialSymbolsText(textPartObject.text);

      try {
        await (generationType === GenerationTypeEnum.CANVAS ?
          canvasService.fillTextOnDrawer(
            drawerId,
            text,
            prefixSpace + left,
            currentTop
          ) :
          pdfService.writeText(
            processId,
            text,
            prefixSpace + left,
            textBox.height - currentTop - (textRowData[i]?.fontSize || currentLineHeight),
            currentPage,
          )
        )
      } catch (error) {
        throw error;
      }

      let currentFillStyle: string;

      try {
        currentFillStyle = (await getDrawerObjectSettings(drawerId, processId, canvasService, pdfService, generationType)).fillStyle as string;
      } catch (error) {
        throw error;
      }

      if (oldFillStyle !== currentFillStyle) {
        try {
          await (generationType === GenerationTypeEnum.CANVAS ?
            canvasService.changeDrawerObjectSettings(drawerId, undefined, oldFillStyle) :
            pdfService.changeDrawerObjectSettings(processId, 0, 0, 0, textRowData[i]?.fontSize || currentLineHeight, getPDFFont(textPartObject, fontData)))
        } catch (error) {
          throw error;
        }
      }

      left += textPartMeasure.width;
    }
  }

  return currentTextIndex;
}

const getCurrentTop = (
  index: number,
  currentLineHeight: number,
  startHeight: number,
  marginTop: number,
  textRowData: ITextRowGenerateData[],
  stopIndex?: number
): number => {
  let height: number = 0;

  for (let i = index - 1; i >= (stopIndex || 0); i -= 1) {
    height += (
      (textRowData[i] && textRowData[i].isNewSentanceStart) ?
        currentLineHeight :
        (textRowData[i]?.fontSize || currentLineHeight)
      );
  }
  
  return height + startHeight + marginTop;
}

const getDrawerObjectSettings = async (
  drawerId: string,
  proccessId: string,
  canvasService: CanvasService,
  pdfService: PDFService,
  generationType: GenerationTypeEnum
): Promise<CanvasRenderingContext2D> => {
  try {
    if (generationType == GenerationTypeEnum.CANVAS) {
      const drawerObjectSettings: AxiosResponse<IDrawerSettingsResponse<CanvasRenderingContext2D>> = await canvasService.getDrawerObjectSettings(drawerId);
    
      if (!drawerObjectSettings || !drawerObjectSettings.data || !drawerObjectSettings.data.settings) {
        throw Error('There are no any drawer settings');
      }
  
      return drawerObjectSettings.data.settings;
    } else {
      const drawerObjectSettings: AxiosResponse<IDrawerSettingsResponse<IPDFObjectSettings>> = await pdfService.getDrawerObjectSettings(proccessId);

      if (!drawerObjectSettings || !drawerObjectSettings.data || !drawerObjectSettings.data.settings) {
        throw Error('There are no any drawer settings');
      }

      const settings: IPDFObjectSettings = drawerObjectSettings.data.settings;

      return {
        fillStyle: `${settings.r}${settings.g}${settings.b}${settings.fontFamilyPath}${settings.fontSize}`
      } as CanvasRenderingContext2D
    }
  } catch (error) {
    throw error;
  }
}


const measureTheTextWidthAndHeight = async (
  generationType: GenerationTypeEnum,
  drawerId: string,
  processId: string,
  fontSize: number,
  fontData: IFontData,
  currentTextPart: ITextPart,
  canvasService: CanvasService,
  pdfService: PDFService,
  specialSymbolValueMap: Record<string, string> = DEFAULT_SPECIAL_SYMBOL_VALUE_MAP
) => {
  try {
    await (generationType === GenerationTypeEnum.CANVAS ?
      canvasService.changeDrawerObjectSettings(drawerId, getCtxFont(fontSize, currentTextPart)) :
      pdfService.changeDrawerObjectSettings(processId, undefined, undefined, undefined, currentTextPart?.fontSize || fontSize, getPDFFont(currentTextPart, fontData)))
  } catch (error) {
    console.log('error');
    console.log(error);
    throw error;
  }

  const text: string = `|-|${formatSpecialSymbolsText(currentTextPart.text, specialSymbolValueMap)}-|-`;

  try {
    return (
      await (generationType === GenerationTypeEnum.CANVAS ?
        canvasService.measureText(drawerId, text) :
        pdfService.measureText(processId, fontSize, text)
      )
    ).data.sizes;
  } catch (error) {
    throw error;
  }
}

const attachInitialTextObject = (textRowData: ITextRowGenerateData[], index: number) => {
  if (!textRowData[index]) {
    textRowData[index] = JSON.parse(JSON.stringify(INITIAL_TEXT_ROW_DATA_OBJECT));
  }
}

export const formatSpecialSymbolsText = (
  text: string,
  specialSymbolValueMap: Record<string, string> = DEFAULT_SPECIAL_SYMBOL_VALUE_MAP
) => {
  const specialSymbols: string[] = Object.keys(SPECIAL_SYMBOL_MAP);

  for (let i = 0; i < specialSymbols.length; i += 1) {
    if (text.indexOf(specialSymbols[i]) >= 0) {
      return text.replace(specialSymbols[i], specialSymbolValueMap[specialSymbols[i]]);
    }
  }

  return text;
}

export const getCtxFont = (
  inheritFontSize: number,
  textPart: ITextPart
): string => {
  const fontStylingMap: Record<string, boolean> = { [FontStyleEnum.NORMAL]: true };

  if (textPart.isBold) {
    delete fontStylingMap[FontStyleEnum.NORMAL];
    fontStylingMap[FontStyleEnum.BOLD] = true;
  }

  if (textPart.isItalic) {
    delete fontStylingMap[FontStyleEnum.NORMAL];
    fontStylingMap[FontStyleEnum.ITALIC] = true;
  }

  return `${Object.keys(fontStylingMap).join(' ')} ${textPart.fontSize || inheritFontSize}px ${textPart.fontSerif ? FontSerifEnum.SERIF : FontSerifEnum.SANS_SERIF}`;
}

export const getPDFFont = (
  textPart: ITextPart,
  fontData: IFontData
): string => {
  const fontStyle: string = getFontStyle(textPart);
  return `${fontData.directory}/${fontData.name}/${fontStyle}/${fontData.name}-${fontStyle}.${fontData.extension}`;
}

export const getFontStyle = (textPart: ITextPart): string => {
  if (textPart.isBold && textPart.isItalic) {
    return `${FontStyleEnum.BOLD}${FontStyleEnum.ITALIC}`;
  }

  if (textPart.isBold) {
    return FontStyleEnum.BOLD;
  }

  if (textPart.isItalic) {
    return FontStyleEnum.ITALIC;
  }

  return FontStyleEnum.REGULAR;
}

export const newRowText = (index: number, text: string, prefix?: string ): string =>
  `${addText(Boolean(index), text, `${NEW} `)}${addText(true, text, prefix)}${text}`;

export const addText = (shouldAdd: boolean, text: string, value?: string): string =>
  (value && (shouldAdd && text.indexOf(value) === -1)) ? value : '';

export const isOnlySpaces = (input: string): boolean => input.trim() === '';

export const addTextPart = (isInQueue: boolean, char: ITextPart, textArray: ITextPart[] = [], prevQueue: boolean[] = [], nextQueue: boolean[] = []) => {
  prevQueue[0] = false;
  isInQueue ? (textArray[textArray.length - 1].text += char.text) : textArray.push(char);
  nextQueue[0] = true;
}

export const splitByNewLine = (text: string): string[] => text.split(/\r?\n/);

export const replaceDoubleRN = (text: string): string => text.replaceAll(/\r?\n\r?\n/g, ` ${NEW} ${INV} ${NEW}`);