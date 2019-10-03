import { Relationship } from './relationship';
export class Geodata {
  streetName: string;
  streetNumber: string;
  districtNumber: number;
  lat: number;
  lng: number;

  constructor(streetName?: string, streetNumber?: string, districtNumber?: number, lat?: number, lng?: number) {
    this.streetName = streetName ? streetName : '';
    this.streetNumber = streetNumber ? streetNumber : '';
    this.districtNumber = districtNumber ? districtNumber : 0;
    this.lat = lat ? lat : 0;
    this.lng = lng ? lng : 0;
  }
}

export class Location extends Relationship {
  objectId: string;
  objectType: string;
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  name: string;
  names: Array<{
    name: string,
    nameType: string
  }>;
  locationTypes: Array<string>;

  identifiers: Array<{
    url: string,
    title: string,
    copyright: string;
    identifierType: string
  }>;

  geodata: Array<Geodata>;
  locations: Array<{
    location: Location,
    relationship: string
  }>;

  constructor(relationship?: string) {
    super(relationship);
    this.objectType = 'Location';
    this.identifiers = new Array<{ url: string, title: string, copyright: string, identifierType: string}>();
    this.names = new Array<{ name: string, nameType: string }>();
    this.locations = new Array<{ location: Location, relationship: string }>();
    this.locationTypes = new Array<string>();
    this.geodata = new Array<Geodata>();
  }
}
