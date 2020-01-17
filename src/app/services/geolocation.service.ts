import { Injectable } from '@angular/core';
import { Location } from '../models/location';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable()
export class GeoLocationService {
  locations: Location[];

  locationTypesAndIcons: any;

  constructor(private http: HttpClient) {
    this.locations = new Array<Location>();
    // 
    // TODO: https://thenounproject.com/search/
    // can get icons off that website and integrate em
    // District
    // -
    // Street
    // Square
    // Bridge
    // Park
    // -
    // Field
    // Forest
    // Hill
    // Mountain 
    // -
    // Official Building
    // Train Station
    // Airport
    // Hall
    // Factory
    // -
    // Music Hall
    // Opera House
    // Theater
    // Church
    // Memorial
    // Casern
    // Castle
    // Museum
    // Sports Complex
    this.locationTypesAndIcons = [
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
      {type:'', icon:''},
    ];
  }

  /**
   * Reverse geocoding of address (using gmaps API)
   * @param name          - name of the place (usually provided)
   * @param streetName    - streetname (optional)
   * @param streetNumber  - streetnumber (optional)
   * @param postalCode    - postalcode (optional)
   * @return
   */
  lookUpCoordinates(name: string, streetName?: string, streetNumber?: string, postalCode?: string): Promise<any> {
    // lookup coordinates if none are provided
    name = name.replace(' ', '+');
    const addr = encodeURIComponent(`${name}${streetName ? ' ' + streetName : ''}${streetNumber? ' ' + streetNumber : ''}${postalCode ? ' ' + postalCode : ''}, Vienna`);

    //console.log(addr);
    // ?components=locality:vienna|country:AT
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&region=at&key=${environment.GMAPS_API_KEY}`;
    let promise = new Promise((resolve, reject) => {
      this.http.get(url)
      .toPromise()
      .then(
        (success: any) => {
          // success.results[0].geometry.location.lat
          // success.results[0].geometry.location.lng
          if(success.status === 'OK') {
            resolve(success.results[0]);
          } else {
            console.log(`${addr} could not be geocoded ${success.status}`)
            reject();
          }
        },
        (error: any) => {
          console.log('Error');
          reject(error);
        });
    });
    return promise;
  }
}
