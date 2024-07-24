import { IFontData } from "../../models/font-data.interface";

export const directoryPathToFontData = (directoryPath: string): IFontData | undefined => {
  const parts: string[] = directoryPath.split('/');

  if (!parts || !parts.length || parts.length !== 5) {
    return;
  }

  const extensionParts: string[] = parts[4].split('.');

  if (!extensionParts || !extensionParts.length || extensionParts.length !== 2) {
    return;
  }

  return {
    directory: `${parts[0]}/${parts[1]}`,
    name: parts[2],
    style: parts[3],
    extension: extensionParts[1]
  }
}
