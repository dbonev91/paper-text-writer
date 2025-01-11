import { AxiosResponse } from "axios";
import { DEFAULT_FONT_DATA, INITIAL_TEXT_ROW_DATA_OBJECT, SINGLE_QUERY_PAGES } from "../constants";
import { FontSerifEnum } from "../enums/font-serif.enum";
import { FontStyleEnum } from "../enums/font-style.enum";
import { ICoordinate } from "../models/coordinate.interface";
import { ISentance, ISentanceImage } from "../models/sentance.interface";
import { ISizes } from "../models/sizes.interface";
import { ITextPart } from "../models/text-part.interface";
import { ITextRowGenerateData } from "../models/text-row-generate-data.interface";
import CanvasService from "../services/canvas/canvas.service";
import { placeShy, SHY, NEW, INV, DEFAULT_SPECIAL_SYMBOL_VALUE_MAP, SPECIAL_SYMBOL_MAP, EMPTY_SPECIAL_SYMBOL_VALUE_MAP, getProperSize, fontMapKey, GAP, GAP_SPECIAL_SYMBOL_VALUE_MAP } from "./string/string.helper";
import PDFService from "../services/pdf/pdf.service";
import { IFontData } from "../models/font-data.interface";
import { ITextGeneratveInput } from '../models/text-generative-input.interface';
import { IPDFGenerativeData, IPDFPageData } from '../models/pdf-generative-data.interface';
import { PageNumberPlacementEnum } from "../enums/page-number-placement.enum";
import { directoryPathToFontData } from "./object/object.helper";
import { IMeasureAllTextPartsRequestData } from "../models/measure-all-text-parts-request-data.interface";
import { ISizesData, ISizesResponse } from "../models/sizes-response.interface";
import { INewLineCurrentWidthAndTextPart } from "../models/new-line-current-width.interface";

const marginPageSentanceMap: Record<number, Record<string, number>> = {};
const pdfGenerationMap: Record<string, IPDFGenerativeData> = {};

export const prepareAllTextWithDashes = (sentences: ISentance[]): ITextPart[] => {
  const groupedNewLinesMap: ITextPart[][] = [];

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence: ISentance = sentences[i];
    const textParts: ITextPart[] = sentence.textParts;

    if (!groupedNewLinesMap[i]) {
      groupedNewLinesMap[i] = [];
    }

    for (let j = 0; j < textParts.length; j += 1) {
      groupedNewLinesMap[i].push({
        ...sentence,
        ...textParts[j],
        text: j ? textParts[j].text : newRowText(i, `${textParts[j].text}`, sentence.newLineAutoPrefix)
      });
    }
  }

  let newLines: ITextPart[] = [];

  for (let i = 0; i < groupedNewLinesMap.length; i += 1) {
    const textParts: ITextPart[] = groupedNewLinesMap[i];

    for (let j = 0; j < textParts.length; j += 1) {
      const groupedLine: ITextPart = textParts[j];
      const texts: string[] = splitByNewLine(replaceDoubleRN(groupedLine.text))
        .map((text: string, index: number) => newRowText(index, text, j && !index ? '' : groupedLine.newLineAutoPrefix));
  
      newLines = newLines.concat(
        texts.map((text: string) => {
          return {
            ...groupedLine,
            text
          }
        }
      ));
    }
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

    for (let currentTextPart of splittedDashedText) {
      allTextPartsWithDashes.push(currentTextPart);
    }
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
    pages: [
      {
        coordinateText: []
      }
    ],
    generalSettings: {
      id,
      sizes: {
        width: input.width,
        height: input.height
      },
      saveSizes: {
        width: (input.saveWidth as number) + input.knifeBorderValue,
        height: (input.saveHeight as number) + (input.knifeBorderValue * 2)
      },
      fontData,
      fontSize: input.fontSize,
      scale: input.scale,
      knifeBorder: input.knifeBorderValue,
      mirrorMargin: input.mirrorMargin,
      useTextInsteadOfVector: input.useTextInsteadOfVector
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

  const textRectangles: ICoordinate[] = input.textRectangles as ICoordinate[];

  const isCover: boolean = Boolean(textRectangles && textRectangles.length);

  // TODO: for canvas should variate for each while iteration
  // the reason is it multiplys the margin
  // if same text is on two or more pages
  const drawerId: string = `${Math.random()}`.split('.')[1];

  while ((currentIndex === 0) || (currentIndex < (allTextPartsWithDashes.length - 1))) {
    if (input.mirrorMargin) {
      left = (currentPage % 2) ? (input.left - input.mirrorMargin) + input.knifeBorderValue : input.left + input.mirrorMargin;
      right = (currentPage % 2) ? (input.right + input.mirrorMargin) - input.knifeBorderValue : input.right - input.mirrorMargin;
    }

    let currentTextBox: ICoordinate;

    if (isCover) {
      currentTextBox = textRectangles[currentPage];
    } else {
      currentTextBox = {
        top: input.top,
        left,
        width: input.width - (left + right),
        height: input.height - input.bottom
      };
  
      pdfGenerativeData.pages[currentPage] = {
        coordinateText: []
      }
    }

    if (!currentTextBox && isCover) {
      break;
    }

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

    const imageOnASpecificPage: ISentanceImage = input.specificPagesImages[currentPage];
    
    try {
      currentTextIndex = await writeTextInsideBox(
        imageOnASpecificPage ? [{ image: imageOnASpecificPage, text: 'е', sentanceId: '' }] : allTextPartsWithDashes.slice(currentIndex),
        currentTextBox,
        input.fontSize,
        input.startHeight,
        input.height,
        input.bottom,
        isCover,
        drawerId,
        isCover ? 0 : currentPage,
        currentTextIndex,
        sizesResponse.data.data,
        pdfGenerativeData.pages[isCover ? 0 : currentPage],
        input.knifeBorderValue,
        input.bottom,
        input.lineHeight
      );
    } catch (error) {
      throw error;
    }

    if (!(currentPage % SINGLE_QUERY_PAGES) && !isCover) {
      pdfGenerationMap[id] = pdfGenerativeData;

      try {
        await pdfService.streamPDFParts(id);
      } catch (error) {
        console.log('ERROR STREAM:');
        console.log(error);
      }
    }

    if (!currentTextIndex[0] && !imageOnASpecificPage) {
      break;
    }

    currentIndex += currentTextIndex[0];
    currentPage += 1;
  }

  const keys = Object.keys(marginPageSentanceMap);

  for (let key of keys) {
    delete marginPageSentanceMap[key as any];
  }

  pdfGenerationMap[id] = pdfGenerativeData;

  try {
    await pdfService.streamPDFParts(id);
  } catch (error) {
    console.log('ERROR STREAM:');
    console.log(error);
  }

  console.log('START ARRANGE PDF');

  try {
    await pdfService.arrangePDFParts(id);   
  } catch (error) {
    console.log('ERROR ARRANGE PDF:');
    console.log(error)
  }

  console.log('PDF COMPLETED');

  return pdfGenerativeData;
}

export const streamPDFParts = async (id: string, response: any) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Transfer-Encoding', 'chunked');

  const length: number = pdfGenerationMap[id].pages.length;
  const substractedLength: number = (length - 1);
  const lengthPart: number = substractedLength % SINGLE_QUERY_PAGES;
  const step: number = lengthPart ? lengthPart : SINGLE_QUERY_PAGES;
  const pagesStep: number = length <= SINGLE_QUERY_PAGES ? length : step;

  const pdfDataToSend: IPDFGenerativeData = {
    ...pdfGenerationMap[id],
    pages: pdfGenerationMap[id].pages.slice(length - pagesStep, length)
  };

  for (let i = 0; i < pdfDataToSend.pages.length; i += 1) {
    for (let j = 0; j < pdfDataToSend.pages[i].coordinateText.length; j += 1) {
      pdfDataToSend.pages[i].coordinateText[j].ascii = pdfDataToSend.pages[i].coordinateText[j].text.charCodeAt(0);
    }
  }

  response.write(JSON.stringify(pdfDataToSend));

  response.end();
}

export const writeTextInsideBox = async (
  allTextPartsWithDashes: ITextPart[],
  textBox: ICoordinate,
  fontSize: number,
  startHeight: number,
  height: number,
  bottom: number,
  isCover: boolean,
  drawerId: string,
  currentPage: number,
  currentTextIndex: number[],
  sizesData: ISizesData,
  pageGenerativeData: IPDFPageData,
  knifeBorderValue: number,
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
    const data: INewLineCurrentWidthAndTextPart = getTextWidthTextPartAndNewLine(allTextPartsWithDashes, i, sizesData) as INewLineCurrentWidthAndTextPart ;
    const currentTextPart: ITextPart = data.textPart;
    const previousText: string = previousTextPart ? previousTextPart.text : '';

    currentWidth += data.currentWidth;

    const isNewLine: boolean = data.isNewLine;

    if (data.isNewLine) {
      lastLineIndexMap[textRowIndex] = textRowIndex;
    }

    attachInitialTextObject(textRowData, textRowIndex);

    textRowData[textRowIndex].isNewSentanceStart = currentTextPart.isNewSentanceStart;
    textRowData[textRowIndex].shouldStartOnTheNextPage = currentTextPart.shouldStartOnTheNextPage;

    if (textRowData[textRowIndex] && currentTextPart.image) {
      textRowData[textRowIndex].image = currentTextPart.image;
    }

    if ((currentWidth > textBox.width) || isNewLine || currentTextPart?.image) {
      if (previousText === SHY) {
        textRowData[textRowIndex].textParts.push({
          ...textRowData[textRowIndex].textParts[0],
          fontSize: 0,
          text: SHY,
          sentanceId: currentTextPart.sentanceId
        });
      }

      if (isOnlySpaces(previousText)) {
        textRowData[textRowIndex].textParts.pop();
      }

      const shouldJumpToTheNextPage: boolean = Boolean(textRowData[textRowIndex] && textRowData[textRowIndex].shouldStartOnTheNextPage);
      const marginTop: number = textRowData[textRowIndex]?.margin?.top || 0;

      currentHeight = getCurrentTop(
        textRowIndex,
        currentLineHeight,
        isCover ? 0 : (startHeight || textBox.top),
        marginTop,
        textRowData
      );

      currentWidth = isNewLine ? 0 : (currentTextPart.sizes || {}).width as number;

      const metric: number = (currentHeight
        + (getBiggestFontSize(textRowData[textRowIndex], currentLineHeight))
        + ((getBiggestFontSize(getTextRowData(i, allTextPartsWithDashes, sizesData, textBox.width), currentLineHeight)))
      );

      if (i && (shouldJumpToTheNextPage || ((metric >= textBox.height)))) {
        cuttedLinesIndexMap[textRowIndex] = textRowIndex;
        currentTextIndex.pop();
        currentTextIndex.push(i);

        break;
      }

      if (textRowData[textRowIndex].textParts.length) {
        textRowIndex += 1;
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

    currentTextIndex.pop();
    currentTextIndex.push(i);
  }

  const justifyStep: number[] = [];
  const sequantVerticalCenteredRowIndexMap: Record<number, number> = {};
  let verticalCenteredRowsFullHeight: number = 0;

  for (let i = 0; i < textRowData.length; i += 1) {
    const textRow: ITextRowGenerateData = textRowData[i];
    
    if (textRow.textParts[0] && textRow.textParts[0].isVerticalCenter) {
      sequantVerticalCenteredRowIndexMap[i] = getCurrentTop(i, currentLineHeight, 0, 0, textRowData, i - Object.keys(sequantVerticalCenteredRowIndexMap).length);
      verticalCenteredRowsFullHeight += textRow?.image?.height || getBiggestFontSize(textRow, currentLineHeight);
    }

    let textWidth: number = 0;

    for (let i = 0; i < textRow.textParts.length; i += 1) {
      const textPart: ITextPart = textRow.textParts[i];

      textPart.sizes = getProperSize(formatSpecialSymbolsText(textPart.text), sizesData.outputSizes[textPart.index || 0].wordSizes);
      
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

  const verticalCenteredRows: number = Object.keys(sequantVerticalCenteredRowIndexMap).length;
  const verticalCenterDifference: number = verticalCenteredRows ? (verticalCenteredRowsFullHeight / verticalCenteredRows) : 0;

  let isCentered: boolean = false;

  for (let i = 0; i < textRowData.length; i += 1) {
    const textRow: ITextRowGenerateData = textRowData[i];
    let entireTextWidth: number = 0;

    isCentered = Boolean(textRow.textParts && textRow.textParts.length && textRow.textParts[0].isCentered);

    if (textRow.textParts && textRow.textParts.length) {
      for (let i = 0; i < textRow.textParts.length; i += 1) {
        const textPart: ITextPart = textRow.textParts[i];
      
        textPart.sizes = getProperSize(formatSpecialSymbolsText(textPart.text, GAP_SPECIAL_SYMBOL_VALUE_MAP), sizesData.outputSizes[textPart.index || 0].wordSizes);
      
        if (textPart.text === SHY) {
          textPart.sizes = sizesData.dashSizesMap[fontMapKey({
            ...textPart,
            fontSize: textPart.fontSize || fontSize
          })];
        }

        entireTextWidth += (textPart.sizes as ISizes).width;
      }
    }

    const rawPrefixSpace: number = textBox.width - entireTextWidth;
    const prefixSpace: number = (entireTextWidth && isCentered) ? (rawPrefixSpace / 2) : 0;
    const isVerticalCenter: boolean = Boolean(textRowData[i].textParts[0] && textRowData[i].textParts[0].isVerticalCenter);

    let left: number = textBox.left;
    let hasGap: boolean = false;

    for (let j = 0; j < textRow.textParts.length; j += 1) {
      const textPartObject: ITextPart = textRow.textParts[j];
      const isAGap: boolean = textPartObject.text === GAP;

      if (!hasGap && isAGap) {
        hasGap = true;
      }

      textPartObject.sizes = getProperSize(formatSpecialSymbolsText(textPartObject.text), sizesData.outputSizes[textPartObject.index || 0].wordSizes);

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

      if (!textPartObject.dontJustify && ((textPartObject.requiredJustify && isLastLineCutted && isASpace) ||
        (isASpace && noLastLine && (isLastLineCutted || noLastLineOfTheCurrentSentace)))) {
        left += justifyStep[i];
      }

      const currentTop: number = getCurrentTop(
        i,
        currentLineHeight,
        isCover ? 0 : (startHeight || textBox.top),
        textRowData[i]?.margin?.top || 0,
        textRowData
      );
      const text: string = formatSpecialSymbolsText(textPartObject.text, GAP_SPECIAL_SYMBOL_VALUE_MAP);
      const color: number = textPartObject.text === INV ? 255 : 0;

      let accumulatedX: number = 0;
      
      const pageHeight: number = isCover ? (height - textBox.top) : textBox.height;

      for (let k = 0; k < text.length; k += 1) {
        try {
          pageGenerativeData.coordinateText.push({
            fontSize: textPartObject.fontSize || fontSize,
            text: text[k],
            page: currentPage,
            x: textPartObject.image ?
              (textPartObject.image.fullInBox ? ((currentPage % 2) ? knifeBorderValue : 0) :
                (textBox.left + ((textBox.width / 2) - (((textPartObject.image as any).width || 0) / 2)))) :
                ((hasGap ? (rawPrefixSpace + left) : (prefixSpace + left)) + accumulatedX),
            y: computeY(
              isVerticalCenter ?
                (((textBox.height / 2) + (verticalCenteredRowsFullHeight / 2) - sequantVerticalCenteredRowIndexMap[i] + verticalCenterDifference)) + knifeBorderValue :
                (pageHeight + paddingBottom - currentTop - (textRowData[i]?.image?.height || getBiggestFontSize(textRowData[i], currentLineHeight)) + knifeBorderValue),
              knifeBorderValue,
              textBox,
              bottom,
              textPartObject.image
            ),
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

        accumulatedX += sizesData.outputSizes[textPartObject.index || 0].charSizes[k].width;
      }

      left += (textPartObject.sizes as ISizes).width;
    }
  }

  return currentTextIndex;
}

const getTextWidthTextPartAndNewLine = (allTextPartsWithDashes: ITextPart[], index: number, sizesData: ISizesData): INewLineCurrentWidthAndTextPart | null => {
  let currentWidth: number = 0;

  const textPart: ITextPart = allTextPartsWithDashes[index];
  
  if (!textPart) {
    return null;
  }

  textPart.sizes = getProperSize(formatSpecialSymbolsText(textPart.text, EMPTY_SPECIAL_SYMBOL_VALUE_MAP), sizesData.outputSizes[textPart.index || 0].wordSizes, EMPTY_SPECIAL_SYMBOL_VALUE_MAP);
  
  if (textPart.text !== NEW && textPart.text !== SHY) {
    currentWidth = textPart.sizes.width;
  }

  return {
    isNewLine: textPart.text.indexOf(NEW) >= 0,
    currentWidth,
    textPart
  }
}

const getTextRowData = (index: number, allTextPartsWithDashes: ITextPart[], sizesData: ISizesData, textBoxWidth: number): ITextRowGenerateData => {
  const textParts: ITextPart[] = [];

  let localIndex: number = index;
  let data: INewLineCurrentWidthAndTextPart | null = getTextWidthTextPartAndNewLine(allTextPartsWithDashes, localIndex, sizesData);
  let accumulatedWidth: number = 0;

  while (data && (accumulatedWidth <= textBoxWidth) && !data.textPart.image) {
    accumulatedWidth += data.currentWidth;
    textParts.push(data.textPart);

    localIndex += 1;

    data = getTextWidthTextPartAndNewLine(allTextPartsWithDashes, localIndex, sizesData);
  }

  return {
    textParts
  }
}

const computeY = (computedY: number, knifeBorderValue: number, textBox: ISizes, bottom: number, image?: ISentanceImage) => {
  if (!image) {
    return computedY;
  }

  if (image.fullInBox) {
    return knifeBorderValue;
  }

  if (image.verticalCenter) {
    return ((textBox.height + bottom + knifeBorderValue) / 2) - (image.height / 2);
  }

  if (image.bottom) {
    return bottom + knifeBorderValue;
  }

  return computedY;
}

const getBiggestFontSize = (textRowData: ITextRowGenerateData, lineHeight: number): number => {
  if (!textRowData || !textRowData.textParts || !textRowData.textParts.length) {
    return 0;
  }

  let largestLineHeight: number = lineHeight;

  for (let i = 0; i < textRowData.textParts.length; i += 1) {
    const currentFontSize: number = Number(textRowData.textParts[i].fontSize);
    
    if (!isNaN(currentFontSize) && (currentFontSize > largestLineHeight)) {
      largestLineHeight = currentFontSize;
    }
  }

  return largestLineHeight;
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
    height += (textRowData[i]?.image?.height || getBiggestFontSize(textRowData[i], currentLineHeight));
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