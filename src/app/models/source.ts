import { Relationship } from './relationship';
import { PersonOrganization } from './person.organization';

export class Source extends Relationship {
  objectId: string;
  objectType: string;
  status: string; // ONLINE / OFFLINE
  author: string; // person editing / creating this
  name: string;
  // local file urls from backend or urls (wiki ,etc.)
  identifiers: Array<{
    url: string,
    identifierType: string,
    title: string,
    copyright: string,
    sourceType?: string
  }>;

  provenance: {
    from: string, //PersonOrganization,
    provenanceType: string
  };

  dates: Array<{
    startDate: Date,
    endDate: Date,
    dateName: string
  }>;

  languages: Array<string>;
  keywords: Array<string>;
  rights: string;
  abstract: string;
  description: string;
  transcription: string;


  creatorContributorPublisher: Array<{
    personOrganization: PersonOrganization,
    position: string,
    role: string
  }>;

  sourceType1: string;
  sourceType2: string;

  sources: Array<{
    source: Source,
    relationship: string
  }>;

  constructor(relationship? : string) {
    super(relationship);
    this.objectType = 'Source';
    this.identifiers = new Array<{ url: string, title: string, copyright: string, identifierType: string, sourceType?: string }>();
    this.dates = new Array<{ startDate: Date, endDate: Date, dateName: string}>();
    this.languages = new Array<string>();
    this.keywords = new Array<string>();
    this.creatorContributorPublisher = new Array<{ personOrganization: PersonOrganization, position: string, role: string}>();
    this.sources = new Array<{ source: Source, relationship: string}>();
  }
}
