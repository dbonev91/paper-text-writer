import { FontStyleEnum } from "../../enums/font-style.enum";
import { ISizes } from "../../models/sizes.interface";
import { ITextPart } from "../../models/text-part.interface";

export const getFileExtension = (input: string): string => {
  return input.split('.').pop() as string;
}

export const SHY: string = '&shy;';
export const NEW: string = '&new;';
export const INV: string = '&inv;';
export const GAP: string = '&gap;';
export const SPACE: string = '&space;';

export const SPECIAL_SYMBOL_MAP: Record<string, boolean> = {
  [SHY]: true,
  [NEW]: true,
  [SPACE]: true,
  [GAP]: true
};

export const DEFAULT_SPECIAL_SYMBOL_VALUE_MAP: Record<string, string> = {
  [SHY]: '-',
  [NEW]: '',
  [SPACE]: ' '
};

export const GAP_SPECIAL_SYMBOL_VALUE_MAP: Record<string, string> = {
  [SHY]: '-',
  [NEW]: '',
  [SPACE]: ' ',
  [GAP]: ''
};

export const EMPTY_SPECIAL_SYMBOL_VALUE_MAP: Record<string, string> = {
  [SHY]: '',
  [NEW]: '',
  [SPACE]: ' '
};

export const getProperSize = (
  text: string,
  sizes: ISizes,
  specialSybolMap: Record<string, string> = DEFAULT_SPECIAL_SYMBOL_VALUE_MAP,
  empty: boolean = false
): ISizes => {
  if (specialSybolMap.hasOwnProperty(text) && !specialSybolMap[text] && empty) {
    return { width: 0, height: 0 };
  }

  return sizes;
}

export const fontMapKey = (measureTextData: ITextPart): string => {
  return `${measureTextData.fontSize}${(measureTextData.isBold || measureTextData.isItalic) ? '-' : ''}${measureTextData.isBold ? FontStyleEnum.BOLD : ''}${measureTextData.isItalic ? FontStyleEnum.ITALIC : ''}`;
}

const firstFromAlphabet = 1072; // а
const lastFromAlphabet = 1103; // я

const isVowel = (char: string): boolean => {
  const vowelLetters: number[] = [
    firstFromAlphabet, // а
    1077, // е
    1080, // и
    1086, // о
    1091, // у
    1098, // ъ
    1102, // ю
    lastFromAlphabet, // я
  ];

  return Boolean(vowelLetters.indexOf(char.charCodeAt(0)) >= 0);
};

export const placeShy = (value: string) => {
  const characters: string[] = value.split("");
  let output = "";

  for (let i = 0; i < characters.length; i += 1) {
    const prevCharacter: string | null = i > 0 ? characters[i - 1] : null;
    const currentCharacter: string = characters[i];
    const nextCharacter: string | null =
      i === characters.length - 1 ? null : characters[i + 1];
    const doubleNextCharacter: string | null =
      i === characters.length - 2 ? null : characters[i + 2];

    output += currentCharacter;

    const isCurrentCharVowel: boolean =
      doubleNextCharacter && nextCharacter
        ? isVowel(currentCharacter.toLowerCase()) &&
          (isVowel(nextCharacter.toLowerCase()) ||
            isVowel(doubleNextCharacter.toLowerCase()))
        : false;

    const isCurrentCharNotVowel: boolean = nextCharacter
      ? !isVowel(currentCharacter.toLowerCase()) &&
        !isVowel(nextCharacter.toLowerCase())
      : false;

    if (
      prevCharacter &&
      nextCharacter &&
      doubleNextCharacter &&
      (isCurrentCharVowel || isCurrentCharNotVowel) &&
      prevCharacter.toLowerCase().charCodeAt(0) >= firstFromAlphabet &&
      prevCharacter.toLowerCase().charCodeAt(0) <= lastFromAlphabet &&
      currentCharacter.toLowerCase().charCodeAt(0) >= firstFromAlphabet &&
      currentCharacter.toLowerCase().charCodeAt(0) <= lastFromAlphabet &&
      nextCharacter.toLowerCase().charCodeAt(0) >= firstFromAlphabet &&
      nextCharacter.toLowerCase().charCodeAt(0) <= lastFromAlphabet &&
      doubleNextCharacter.toLowerCase().charCodeAt(0) >= firstFromAlphabet &&
      doubleNextCharacter.toLowerCase().charCodeAt(0) <= lastFromAlphabet &&
      (
        (isVowel(prevCharacter) || isVowel(currentCharacter)) &&
        (isVowel(nextCharacter) || isVowel(doubleNextCharacter))
      )
    ) {
      output += SHY;
    }
  }

  return output;
};