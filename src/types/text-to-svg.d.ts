declare module "text-to-svg" {
  interface TextToSVGOptions {
    x?: number;
    y?: number;
    fontSize?: number;
    anchor?: string;
    letterSpacing?: number;
  }

  interface TextToSVGInstance {
    getD(
      text: string,
      options?: TextToSVGOptions,
    ): string;
  }

  interface TextToSVGStatic {
    loadSync(fontPath: string): TextToSVGInstance;
  }

  const TextToSVG: TextToSVGStatic;

  export default TextToSVG;
}