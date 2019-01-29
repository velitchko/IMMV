import { Pipe, PipeTransform } from '@angular/core';


@Pipe({name : 'mapValues'})

export class MapValuesPipe implements PipeTransform {

  transform(map: Map<any, any>, args?: any[]): any[] {
    let returnArr = new Array<any>();

    map.forEach( (entryVal: any, entryKey: any) => {
      returnArr.push({
        key: entryKey,
        value: entryVal
      });
    });
    // sort based on value
    returnArr.sort( (a: any, b: any) => {
      return b.value - a.value;
    });
    return returnArr;
  }
}
