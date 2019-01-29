import { Relationship } from './relationship';

export class Theme extends Relationship{
  objectId: string;
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  name: string;
  names: Array<{
    name: string,
    nameType: string
  }>;

  abstract: string;
  description: string;

  dates: Array<{
    startDate: Date,
    endDate: Date,
    dateName: string
  }>;

  themeTypes: Array<string>;

  identifiers: Array<{
    url: string,
    title: string,
    copyright: string,
    identifierType: string
  }>;

  themes: Array<{
    theme: Theme,
    relationship: string;
  }>;

  constructor(relationship?: string) {
    super(relationship);
    this.names = new Array<{ name: string, nameType: string }>();
    this.dates = new Array<{ startDate: Date, endDate: Date, dateName: string }>();
    this.themeTypes = new Array<string>();
    this.identifiers = new Array<{ url: string, title: string, copyright: string, identifierType: string }>();
    this.themes = new Array<{ theme: Theme, relationship: string }>();
  }
}
