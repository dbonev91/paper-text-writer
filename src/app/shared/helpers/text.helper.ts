import { AxiosResponse } from "axios";
import { DEFAULT_FONT_DATA, INITIAL_TEXT_ROW_DATA_OBJECT } from "../constants";
import { FontSerifEnum } from "../enums/font-serif.enum";
import { FontStyleEnum } from "../enums/font-style.enum";
import { ICoordinate } from "../models/coordinate.interface";
import { ISentance } from "../models/sentance.interface";
import { ISizes } from "../models/sizes.interface";
import { ITextPart } from "../models/text-part.interface";
import { ITextRowGenerateData } from "../models/text-row-generate-data.interface";
import CanvasService from "../services/canvas/canvas.service";
import { placeShy, SHY, NEW, INV, DEFAULT_SPECIAL_SYMBOL_VALUE_MAP, SPECIAL_SYMBOL_MAP, EMPTY_SPECIAL_SYMBOL_VALUE_MAP, getProperSize, fontMapKey } from "./string/string.helper";
import PDFService from "../services/pdf/pdf.service";
import { IFontData } from "../models/font-data.interface";
import { ITextGeneratveInput } from '../models/text-generative-input.interface';
import { IPDFGenerativeData, IPDFPageData } from '../models/pdf-generative-data.interface';
import { PageNumberPlacementEnum } from "../enums/page-number-placement.enum";
import { directoryPathToFontData } from "./object/object.helper";
import { IMeasureAllTextPartsRequestData } from "../models/measure-all-text-parts-request-data.interface";
import { ISizesData, ISizesResponse } from "../models/sizes-response.interface";

const marginPageSentanceMap: Record<number, Record<string, number>> = {};

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
        image: currentText === 'е' ? allTextParts[i].image : undefined,
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
        image: text === 'е' ? allTextParts[i].image : undefined,
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
        image: undefined,
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

export const collectTextGenerativeInstructions = async (
  id: string,
  input: ITextGeneratveInput,
  canvasService: CanvasService,
  pdfService: PDFService
) => {
  const allTextPartsWithDashes: ITextPart[] = prepareAllTextWithDashes(input.sentences);
  const fontData: IFontData = directoryPathToFontData(input.fontFilePaths.stringPaths[input.fontFamily]) || DEFAULT_FONT_DATA;
  const measureAllTextPartsRequestData: IMeasureAllTextPartsRequestData = {
    textData: allTextPartsWithDashes.map((textPart: ITextPart, index: number) => {
      allTextPartsWithDashes[index].index = index;
      return {
        text: formatSpecialSymbolsText(textPart.text, EMPTY_SPECIAL_SYMBOL_VALUE_MAP),
        isBold: textPart.isBold,
        isItalic: textPart.isItalic,
        fontSize: textPart.fontSize || input.fontSize
      }
    }),
    fontData,
    fontSize: input.fontSize
  };

  let sizesResponse: AxiosResponse<ISizesResponse>;

  try {
    sizesResponse = await pdfService.measureMultipleTextParts(id, measureAllTextPartsRequestData);
  } catch (error) {
    throw error;
  }

  if (!sizesResponse || !sizesResponse.data) {
    throw Error('No sizes data');
  }

  let currentTextIndex: number[] = [0];
  let currentIndex: number = 0;
  let currentPage: number = 0;

  const pdfGenerativeData: IPDFGenerativeData = {
    pages: [],
    generalSettings: {
      id,
      sizes: {
        width: input.width,
        height: input.height
      },
      fontData,
      fontSize: input.fontSize,
      mirrorMargin: input.mirrorMargin
    },
    pageNumberSettings: {
      placement: PageNumberPlacementEnum.CENTER,
      fontSize: input.fontSize,
      paddingTop: input.pageNumbersPaddingTop,
      startFromPage: input.pageNumbersFromPage
    }
  };

  let left: number = input.left;
  let right: number = input.right;

  // TODO: for canvas should variate for each while iteration
  // the reason is it multiplys the margin
  // if same text is on two or more pages
  const drawerId: string = `${Math.random()}`.split('.')[1];

  while ((currentIndex === 0) || (currentIndex <= allTextPartsWithDashes.length)) {
    if (input.mirrorMargin) {
      left = (currentPage % 2) ? input.left - input.mirrorMargin : input.left + input.mirrorMargin;
      right = (currentPage % 2) ? input.right + input.mirrorMargin : input.right - input.mirrorMargin;
    }

    const textBox: ICoordinate = {
      top: input.top,
      left: left,
      width: input.width - (left + right),
      height: input.height - input.bottom
    };

    const slicedTextParts: ITextPart[] = allTextPartsWithDashes.slice(currentIndex);

    // if (generationType === GenerationTypeEnum.CANVAS) {
    //   await firstValueFrom(
    //     this.canvasService.changeDrawerObjectSettings(
    //       drawerId,
    //       `normal ${fontSize}px serif`,
    //       'black',
    //       'left',
    //       'top'
    //     )
    //   );
    // }

    pdfGenerativeData.pages[currentPage] = {
      coordinateText: []
    }
    
    try {
      currentTextIndex = await writeTextInsideBox(
        slicedTextParts,
        textBox,
        input.fontSize,
        input.startHeight,
        drawerId,
        currentPage,
        currentTextIndex,
        sizesResponse.data.data,
        pdfGenerativeData.pages[currentPage],
        input.bottom,
        input.lineHeight
      );
    } catch (error) {
      throw error;
    }

    if (!currentTextIndex[0]) {
      break;
    }

    currentIndex += currentTextIndex[0];
    currentPage += 1;
  }

  const keys = Object.keys(marginPageSentanceMap);

  for (let key of keys) {
    delete marginPageSentanceMap[key as any];
  }

  try {
    await pdfService.arrangePDFParts(
      id,
      pdfGenerativeData
    );   
  } catch (error) {
    console.log(error)
  }

  return pdfGenerativeData;
}

export const writeTextInsideBox = async (
  allTextPartsWithDashes: ITextPart[],
  textBox: ICoordinate,
  fontSize: number,
  startHeight: number,
  drawerId: string,
  currentPage: number,
  currentTextIndex: number[],
  sizesData: ISizesData,
  pageGenerativeData: IPDFPageData,
  paddingBottom: number = 0,
  lineHeight?: number
): Promise<number[]> => {
  if (!marginPageSentanceMap[currentPage]) {
    marginPageSentanceMap[currentPage] = {};
  }

  let textRowIndex: number = 0;
  let currentWidth: number = 0;
  let currentHeight: number = startHeight || textBox.top;
  const currentLineHeight: number = (lineHeight || fontSize);

  const textRowData: ITextRowGenerateData[] = [];
  const lastLineIndexMap: Record<number, number> = {};
  const cuttedLinesIndexMap: Record<number, number> = {};

  for (let i = 0; i < allTextPartsWithDashes.length; i += 1) {
    const previousTextPart: ITextPart = allTextPartsWithDashes[i - 1];
    const currentTextPart: ITextPart = allTextPartsWithDashes[i];
    currentTextPart.sizes = getProperSize(formatSpecialSymbolsText(currentTextPart.text, EMPTY_SPECIAL_SYMBOL_VALUE_MAP), sizesData.outputSizes[currentTextPart.index || 0], EMPTY_SPECIAL_SYMBOL_VALUE_MAP);

    const previousText: string = previousTextPart ? previousTextPart.text : '';
    
    if (currentTextPart.text !== NEW && currentTextPart.text !== SHY) {
      currentWidth += currentTextPart.sizes.width;
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

    if (textRowData[textRowIndex] && currentTextPart.image) {
      textRowData[textRowIndex].image = currentTextPart.image;
    }

    if (
      textRowData &&
      textRowData[textRowIndex] &&
      !textRowData[textRowIndex].fontSize &&
      currentTextPart.fontSize &&
      textRowData[textRowIndex].textParts &&
      textRowData[textRowIndex].textParts.find((part: ITextPart) => part.sentanceId === currentTextPart.sentanceId)
    ) {
      textRowData[textRowIndex].fontSize = currentTextPart.fontSize;
    }

    if ((currentWidth > textBox.width) || isNewLine || currentTextPart?.image) {
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
          (
            (currentHeight -
              (startHeight || textBox.top)) +
              getCurrentTop(
                textRowIndex,
                currentLineHeight,
                startHeight || textBox.top,
                textRowData[textRowIndex]?.margin?.top || 0,
                textRowData,
                textRowIndex
              ) >= textBox.height)
        )
      ) {
        cuttedLinesIndexMap[textRowIndex] = textRowIndex;

        currentTextIndex.pop();
        currentTextIndex.push(i);

        break;
      }

      if (textRowData[textRowIndex].textParts.length) {
        textRowIndex += 1;
        currentHeight = getCurrentTop(
          textRowIndex,
          currentLineHeight,
          startHeight || textBox.top,
          textRowData[textRowIndex]?.margin?.top || 0,
          textRowData
        );
        currentWidth = isNewLine ? 0 : currentTextPart.sizes.width;
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

      if (
        isNaN(marginPageSentanceMap[currentPage][currentTextPart.sentanceId]) &&
        !isSameSentanceUpperPageMargin(currentPage, currentTextPart.sentanceId)
      ) {
        marginPageSentanceMap[currentPage][currentTextPart.sentanceId] = currentTextPart?.margin?.top || 0;
      }

      let top: number = 0;
      const keys: string[] = Object.keys(marginPageSentanceMap[currentPage]);
      for (let key of keys) {
        top += marginPageSentanceMap[currentPage][key];
      }

      textRowData[textRowIndex].margin = {
        top
      }
    }
  }

  const justifyStep: number[] = [];

  for (let i = 0; i < textRowData.length; i += 1) {
    const textRow: ITextRowGenerateData = textRowData[i];
    let textWidth: number = 0;

    for (let i = 0; i < textRow.textParts.length; i += 1) {
      const textPart: ITextPart = textRow.textParts[i];

      textPart.sizes = getProperSize(formatSpecialSymbolsText(textPart.text), sizesData.outputSizes[textPart.index || 0]);
      
      if (textPart.text === SHY) {
        textPart.sizes = sizesData.dashSizesMap[fontMapKey({
          ...textPart,
          fontSize: textPart.fontSize || fontSize
        })];
      }

      textWidth += (textPart.sizes as ISizes).width;
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
      
        textPart.sizes = getProperSize(formatSpecialSymbolsText(textPart.text), sizesData.outputSizes[textPart.index || 0]);
      
        if (textPart.text === SHY) {
          textPart.sizes = sizesData.dashSizesMap[fontMapKey({
            ...textPart,
            fontSize: textPart.fontSize || fontSize
          })];
        }

        entireTextWidth += (textPart.sizes as ISizes).width;
      }
    }

    const prefixSpace: number = entireTextWidth ? (textBox.width - entireTextWidth) / 2 : 0;

    let left: number = textBox.left;

    for (let j = 0; j < textRow.textParts.length; j += 1) {
      const textPartObject: ITextPart = textRow.textParts[j];

      textPartObject.sizes = getProperSize(formatSpecialSymbolsText(textPartObject.text), sizesData.outputSizes[textPartObject.index || 0]);
      
      if (textPartObject.text === SHY) {
        textPartObject.sizes = sizesData.dashSizesMap[fontMapKey({
          ...textPartObject,
          fontSize: textPartObject.fontSize || fontSize
        })];
      }
      
      const isASpace: boolean = textPartObject.text === ' ';
      const noLastLine: boolean = isNaN(lastLineIndexMap[i]);
      const noLastLineOfTheCurrentSentace: boolean = i < (textRowData.length - 1);
      const isLastLineCutted: boolean = !isNaN(cuttedLinesIndexMap[i]);

      if (!textPartObject.dontJustify && 
        isASpace && noLastLine && (isLastLineCutted || noLastLineOfTheCurrentSentace)) {
        left += justifyStep[i];
      }

      const currentTop: number = getCurrentTop(
        i,
        currentLineHeight,
        startHeight || textBox.top,
        textRowData[i]?.margin?.top || 0,
        textRowData
      );
      const text: string = formatSpecialSymbolsText(textPartObject.text);

      try {
        const color: number = textPartObject.text === INV ? 255 : 0;
        pageGenerativeData.coordinateText.push({
          fontSize: textPartObject.fontSize || fontSize,
          text,
          page: currentPage,
          x: textPartObject.image ? (textBox.left + ((textBox.width / 2) - (((textPartObject.image as any).width || 0) / 2))) : prefixSpace + left,
          y: textBox.height + paddingBottom - currentTop - (textRowData[i]?.image?.height || textRowData[i]?.fontSize || fontSize),
          r: color,
          g: color,
          b: color,
          image: textPartObject.image,
          isBold: textPartObject.isBold,
          isItalic: textPartObject.isItalic
        });
      } catch (error) {
        throw error;
      }

      left += (textPartObject.sizes as ISizes).width;
    }
  }

  return currentTextIndex;
}

const isSameSentanceUpperPageMargin = (page: number, sentanceId: string): boolean => {
  for (let i = 0; i < page; i += 1) {
    if (marginPageSentanceMap[i] && !isNaN(marginPageSentanceMap[i][sentanceId])) {
      return true;
    }
  }

  return false;
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
    height += (textRowData[i]?.image?.height || textRowData[i]?.fontSize || currentLineHeight);
  }
  
  return height + startHeight + marginTop;
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