// Declaración de tipos local para SheetJS (xlsx). El paquete distribuido por el CDN
// de SheetJS trae un .d.ts con sintaxis que esta versión de TypeScript no parsea;
// declaramos acá el subconjunto de la API que usa el portal. No afecta el runtime.
declare module 'xlsx' {
  export function read(data: any, opts?: any): any;
  export function write(wb: any, opts?: any): any;
  export function writeFile(wb: any, filename: string, opts?: any): void;
  export const utils: {
    sheet_to_json<T = any>(ws: any, opts?: any): T[];
    json_to_sheet(data: any[], opts?: any): any;
    aoa_to_sheet(data: any[][], opts?: any): any;
    book_new(): any;
    book_append_sheet(wb: any, ws: any, name?: string): void;
    decode_range(ref: string): any;
    encode_cell(cell: any): string;
    [k: string]: any;
  };
}
