import { Injectable } from '@angular/core';
import { COLORS } from '../../environments/colors';

@Injectable()
export class ColorService {
  private colors: Map<string, boolean>;

  constructor() {
    this.colors = new Map<string, boolean>();
    this.populateColors();
  }

  recompute(threshold: number): void {
    this.populateColors(threshold);
  }

  /**
   * Populates the colors map with perceptually different colors
   * reference: https://en.wikipedia.org/wiki/Color_difference#CIE94
   * color space conversion math: http://www.easyrgb.com/en/math.php
   */
  private populateColors(threshold: number = 5): void {
    // TODO similarity works but need to rethink...
    for(let c1 of COLORS) {
      //let sim = new Array<any>();
      let currentColors = Array.from(this.colors.keys());
      let collision = false;
      for(let c of currentColors) {
        let colorA = c1;
        let colorB = c;

        let similiarity = this.getSimilarity(colorA.substring(1,7), colorB.substring(1,7));
        if(similiarity < threshold) {
          collision = true;
          continue;
        }
      }
      if(!collision) {
        this.colors.set(c1, false);
      } else {
        this.colors.delete(c1);
      }
      // for(let c2 of COLORS) {
      //     if(c1 === c2) continue;
      //     let colorA = c1;
      //     let colorB = c2;
      //     sim.push( { similarity: this.getSimilarity(colorA.substring(1,7), colorB.substring(1,7)) });
      // }
      // let accSim = 0; // accumulated similarity for colors with similiarity of 50+
      // let count = 0; // color count
      // sim.forEach( (s) => {
      //   console.log(s);
      //   if(s.similarity > 50) {
      //     accSim += s.similarity;
      //     count += 1;
      //   }
      // });
      // let totalSim = accSim/count;
      // console.log(totalSim);
      // if(totalSim > 50) {
      //   // is either of the colors in the map already?
      //   this.colors.set(c1, false);
      // }
    }
    console.log(`old: ${COLORS.length}; new: ${this.colors.size}`);
  }

  /**
   * Returns how similar two colors are (euclidean distance)
   * @param colorA - string hex representation of first color
   * @param colorB - string hex representation of second color
   * @return number - in range [0,1]; where 0 means opposite colors 1 means same colors
   */
  getSimilarity(colorA: string, colorB: string): number {
    // HEX -> RGB
    let rgbColorA = this.hexToRGB(colorA);
    let rgbColorB = this.hexToRGB(colorB);
    // RGB -> XYZ
    let xyzColorA = this.RGBtoXYZ(rgbColorA);
    let xyzColorB = this.RGBtoXYZ(rgbColorB);
    // XYZ -> Lab
    let labColorA = this.XYZtoLab(xyzColorA);
    let labColorB = this.XYZtoLab(xyzColorB);
    // we are now in a color space where we can compute perceptual similarity of colors
    return this.calculateDelta(labColorA, labColorB);
  }

  /**
   * Converts HEX color to RGB color
   * @param color - color string representation in HEX
   * @return object - color object with r,g,b components
   */
  hexToRGB(color: string): any {
    // get red/green/blue int values of a
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);

    return {r: r, g: g, b: b};
  }

  /**
   * Converts RGB color to XYZ color
   * @param color - color object with r,g,b components
   * @return object - color object with x,y,z components
   */
  RGBtoXYZ(color: any): any {
    let _R = (color.r / 255);
    let _G = (color.g / 255);
    let _B = (color.b / 255);

    // REDS
    if(_R > 0.04045) {
      _R = Math.pow(((_R + 0.055) / 1.055), 2.4);
    } else {
      _R = _R / 12.92;
    }
    // GREENS
    if(_G > 0.04045) {
      _G = Math.pow(((_G + 0.055) / 1.055), 2.4);
    }
    else {
      _G = _G / 12.92;
    }
    // BLUES
    if(_B > 0.04045) {
      _B = Math.pow(((_B + 0.055) / 1.055), 2.4);
    }
    else {
      _B = _B / 12.92;
    }

    _R = _R * 100;
    _G = _G * 100;
    _B = _B * 100;

    let x = _R * 0.4124 + _G * 0.3576 + _B * 0.1805;
    let y = _R * 0.2126 + _G * 0.7152 + _B * 0.0722;
    let z = _R * 0.0193 + _G * 0.1192 + _B * 0.9505;

    return {x: x, y: y, z: z};
  }

  /**
   * Converts XYZ color to L*a*b color
   * @param color - color object with x,y,z components
   * @return object - color object with L,a,b components
   */
  XYZtoLab(color: any): any {
    let _X = color.x / 95.047;
    let _Y = color.y / 100;
    let _Z = color.z / 108.883;

    // X
    if(_X > 0.008856) {
      _X = Math.pow(_X, (1/3));
    } else {
      _X = (7.787 * _X) + (16 / 116);
    }
    // Y
    if(_Y > 0.008856) {
      _Y = Math.pow(_Y, (1/3));
    } else {
      _Y = (7.787 * _Y) + (16 / 116);
    }
    // Z
    if(_Z > 0.008856) {
      _Z = Math.pow(_Z, (1/3));
    } else {
      _Z = (7.787 * _Z) + (16 / 116);
    }

    let l = (116 * _Y) - 16;
    let a = 500 * (_X - _Y);
    let b  = 200 * (_Y - _Z);

    return {L: l, a: a, b: b};
  }

  /**
   * Returns an array with the first N colors from the color service
   * @param n - (optional) number of colors to return
   * @return Array<string> - array of (the first n) hex colors
   */
  getColors(n?: number): Array<string> {
    return !n ? Array.from(this.colors.keys()) : Array.from(this.colors.keys()).slice(0, n);
  }

  /**
   * Computes the perceptual color similarity between two colors in the L*a*b color space
   * port from C# https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs
   * @param colorA - first color object with L,a,b components
   * @param colorB - second color object with L,a,b components
   * @return number - numerical score of similarity in the range [0,100]
   */
  calculateDelta(colorA: any, colorB: any): number {
    // weights for graphics arts
    let KL = 1.0;
    let K1 = 0.045;
    let K2 = 0.015;
    // colorA components
    let L1 = colorA.L;
    let a1 = colorA.a;
    let b1 = colorA.b;
    // colorB components
    let L2 = colorB.L;
    let a2 = colorB.a;
    let b2 = colorB.b;
    // deltas
    let xDL = L1 - L2; // delta L
    let xDA = a1 - a2; // delta a
    let xDB = b1 - b2; // delta b

    let xC1 = Math.sqrt(Math.pow(a1,2) + Math.pow(b1,2)); // C1
    let xC2 = Math.sqrt(Math.pow(a2,2) + Math.pow(b2,2)); // C2
    let xDC = xC1 - xC2; // delta C

    let xDH = Math.pow(xDA,2) + Math.pow(xDB,2) - Math.pow(xDC,2);
    xDH = xDH < 0 ? 0 : Math.sqrt(xDH);
    let SL = 1;
    let KC = 1;
    let KH = 1;
    let SC = 1 + K1 * xC1;
    let SH = 1 + K2 * xC2;

    let xDLKLSL = xDL / (KL * SL);
    let xDCKCSC = xDC / (KC * SC);
    let xDHKHSH = xDH / (KH * SH);
    // 0 = same color; 100 = completely different
    let similarity = Math.pow(xDLKLSL,2) + Math.pow(xDCKCSC,2) + Math.pow(xDHKHSH,2);
    return similarity < 0 ? 0 : Math.sqrt(similarity);
  }

  getAvailableColor(): string {
    this.colors.forEach((v, k) => {
      // console.log(v, k);
      if(!v) {
        this.setUsed(k);
        return k;
      }
    });
    return null;
  }

  /**
   * Checks if a color is currently used
   * @param color - string hex representation of color
   * @return boolean - true if color is used; false otherwise
   */
  checkIfUsed(color: string): boolean {
    return this.colors.get(color);
  }

  setUsed(color: string): void {
    this.colors.set(color, true);
  }
}
