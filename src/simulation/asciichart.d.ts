declare module 'asciichart' {
  export const red: number
  export const green: number
  export const blue: number
  export const yellow: number
  export const cyan: number
  export const magenta: number
  export const white: number
  export const lightgray: number
  export const darkgray: number

  export interface PlotConfig {
    height?: number
    offset?: number
    padding?: string
    min?: number
    max?: number
    colors?: number[]
    format?: (x: number) => string
  }

  export function plot(series: number[] | number[][], config?: PlotConfig): string
}
