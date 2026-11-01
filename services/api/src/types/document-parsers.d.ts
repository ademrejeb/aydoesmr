/**
 * Type shims for document parsers used by the sprint planner.
 * pdf-parse ships without types; mammoth's official typings are incomplete.
 */

declare module "pdf-parse" {
  interface PdfParseData {
    text: string
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    version: string
  }
  function pdfParse(
    data: Buffer | Uint8Array | string,
    options?: Record<string, unknown>
  ): Promise<PdfParseData>
  export default pdfParse
}

declare module "mammoth" {
  interface RawTextResult {
    value: string
    messages: unknown[]
  }
  interface MammothInput {
    buffer?: Buffer
    path?: string
  }
  function extractRawText(input: MammothInput): Promise<RawTextResult>
  function extractRawText(path: string): Promise<RawTextResult>
  const version: string
  export { extractRawText, version }
}