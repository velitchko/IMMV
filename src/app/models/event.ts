import { PersonOrganization } from './person.organization';
import { HistoricEvent } from './historic.event';
import { Theme } from './theme';
import { Source } from './source';
import { Location, Geodata } from './location';
import { Relationship } from './relationship';

export class Event extends Relationship {
  // GENERAL INFO
  objectId: string; // identifier from mongodb
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  name: string;
  eventType: string;
  startDate: Date;
  endDate: Date;

  internal: string;
  external: string;
  // META INFO - OLD
  // abstract: string;
  // interpretation: string;
  // formal:string;
  // eventCharacterization: string;
  // spatialUseAndType: string;
  // audienceAndAction: string;
  // ideology: string;
  // education: string;
  // ephemeralView: string;

  geodata: Geodata; // main location
  routes: Array<Array<Geodata>>; // array of routes

  // RELATIONSHIPS
  peopleOrganizations: Array<{
    personOrganization: PersonOrganization,
    role?: string,
    relationship: string
  }>;
  historicEvents: Array<{
    historicEvent: HistoricEvent,
    relationship: string
  }>;
  themes: Array<{
    theme: Theme,
    relationship: string
  }>;
  sources: Array<{
    source: Source,
    relationship: string
  }>;
  locations: Array<{
    location: Location,
    relationship: string
  }>;
  events: Array<{
    event: Event,
    relationship: string
  }>;

  contributor: Array<{ personOrganization: PersonOrganization, role: string}>;
  creator: Array<{ personOrganization: PersonOrganization, role: string }>;

  medialCoverage: Array<string>;
  eras: Array<string>;
  season: string;
  relationalType?: string;
  // INTERNAL USE
  isMainEvent: boolean;

  constructor(relationship?: string) {
    super(relationship);

    this.isMainEvent = true;
    this.geodata = new Geodata();
    this.medialCoverage = new Array<string>();
    this.peopleOrganizations = new Array<{personOrganization: PersonOrganization, relationship: string, role?: string}>();
    this.historicEvents = new Array<{historicEvent: HistoricEvent, relationship: string}>();
    this.themes = new Array<{theme: Theme, relationship: string}>();
    this.sources = new Array<{source: Source, relationship: string}>();
    this.locations = new Array<{location: Location, relationship: string}>();
    this.events = new Array<{event: Event, relationship: string}>();
    this.routes = new Array<Array<Geodata>>();
    this.eras = new Array<string>();
    this.contributor = new Array<{personOrganization: PersonOrganization, role: string}>();
    this.creator = new Array<{personOrganization: PersonOrganization, role: string}>();
  }
}
