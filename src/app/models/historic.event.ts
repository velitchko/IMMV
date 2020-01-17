import { Relationship } from './relationship';

export class HistoricEvent extends Relationship {
  objectId: string;
  objectType: string;
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  name: string;
  startDate: Date;
  endDate: Date;
  eventStructuralType: string;
  eventDescriptiveType: string;

  abstract: string;
  description: string;

  identifiers: Array<{
    url: string,
    title: string,
    copyright: string,
    identifierType: string
  }>;

  dates: Array<{
    startDate: Date,
    endDate: Date,
    dateName: string
  }>;

  historicEvents: Array<{
    historicEvent: HistoricEvent,
    relationship: string;
  }>;


  constructor(relationship?: string) {
    super(relationship);
    this.objectType = 'HistoricEvent';
    this.identifiers = new Array<{url: string, title: string, copyright: string, identifierType: string}>();
    this.dates = new Array<{startDate: Date, endDate: Date, dateName: string}>();
    this.historicEvents = new Array<{historicEvent: HistoricEvent, relationship: string}>();
  }
}
