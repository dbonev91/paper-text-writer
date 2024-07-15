export interface IFilesBufferInput {
  images: IFileBufferInput[];
}

export interface IFileBufferInput {
  image: IFileBufferArray;
}

export interface IFileBufferArray {
  data: Buffer;
}