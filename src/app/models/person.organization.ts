import { Relationship } from './relationship';

export class PersonOrganization extends Relationship {
  name: string;
  objectId: string;
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  abstract: string; // ORGANIZATION ONLY
  description: string;
  bio?: string; // PERSON ONLY
  objectType: string;

  names: Array<{ name: string, nameType: string }>;

  dates: Array<{ date: Date, dateName: string }>;

  identifiers: Array<{ url: string, title: string, copyright: string, identifierType: string }>;

  // PERSON ONLY
  roles?: Array<string>;
  functions?: Array<{ startDate: Date, endDate: Date, dateName: string }>;

  // ORGANIZATION ONLY
  organizationTypes?: Array<string>;

  peopleOrganizations: Array<{ personOrganization: PersonOrganization, relationship: string }>;

  constructor(relationship?: string) {
    super(relationship);
    this.objectType = ''; // set to something as default?
    this.names = new Array<{ name: string, nameType: string }>();
    this.identifiers = new Array<{ url: string, title: string, copyright: string, identifierType: string }>();
    this.dates = new Array<{ date: Date, dateName: string }>();
    this.peopleOrganizations = new Array<{ personOrganization: PersonOrganization, relationship: string }>();

    // IF objectType === 'Person'
    this.roles = new Array<string>();
    this.functions = new Array<{ startDate: Date, endDate: Date, dateName: string }>();
    // IF objectType === 'Organization'
    this.organizationTypes = new Array<string>();
  }
}
