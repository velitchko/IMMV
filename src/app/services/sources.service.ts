import { Injectable } from '@angular/core';
import { Event } from '../models/event';
import { Location } from '../models/location';
import { HistoricEvent } from '../models/historic.event';
import { PersonOrganization } from '../models/person.organization';
import { Theme } from '../models/theme';
import { Source } from '../models/source';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';


@Injectable()
export class SourceService {
  sources: Source[];

  constructor(private http: HttpClient) {
    this.sources = new Array<Source>();
  }

  private getAsObjectType(type: string, response: any): any {
    switch(type) {
      case 'events':
        return this.getAsEvent(response.data, false);
      case 'historicevents':
        return this.getAsHistoricEvent(response.data, false);
      case 'peopleorganizations':
        return this.getAsPersonOrganization(response.data, false);
      case 'themes':
        return this.getAsTheme(response.data, false);
      case 'locations':
        return this.getAsLocation(response.data, false);
      case 'sources':
        return this.getAsSource(response.data, false);
      default:
        break; // nothing found error or null return? TODO
    }
  }

  private populateRelationships(id: string, endPoint: string): Promise<any> {
    let promise = new Promise<any>( (resolve, reject) => {
        this.http.get(`${environment.API_URL}${endPoint}/${id}`)
        .subscribe( (response: any) => {
          if(response.data) {
            // need to check what endpoint we are calling
            // and get object as that type TODO
            resolve(this.getAsObjectType(endPoint, response));
          } else {
            reject();
          }
        });
    });

    return promise;
  }

   /**
   * Returns an Location object constructred from json
   * @param json - json with all location properties
   * @return location - location object
   */
  getAsLocation(json: any, populate: boolean = false): Location {
    let location = new Location();
    location.objectId = json._id;
    location.status = json.status;
    location.author = json.author;
    location.name = json.name;
    location.names = json.names;
    location.locationTypes = json.locationTypes;
    location.identifiers = json.identifiers;
    location.geodata = json.geodata;

    if(populate) {
      let locations = new Array<{location: Location, relationship: string}>();
      for(let l of json.locations) {
        this.populateRelationships(l.location, 'locations').then( (success) => {
          locations.push({ location : success, relationship: l.relationship});
        })
      }
      location.locations = locations;
    } else {
      location.locations = json.locations;
    }
    return location;
  }


   /**
   * Returns an Event object constructred from json
   * @param json - json with all event properties
   * @return event - event object
   */
  getAsEvent(json: any, populate: boolean = false): Event {
    let event = new Event();
    
    event.objectId = json._id;
    event.status = json.status;
    event.author = json.author;
    event.name = json.name;
    event.eventType = json.eventType;
    event.startDate = json.startDate;
    event.endDate = json.endDate;
    event.internal = json.internal;
    event.external = json.external;
    event.geodata = json.geodata;

    // RELATIONSHIPS
    // look them up and add them to the event model
    if(populate) {
      let events = new Array<{event: Event, relationship: string}>();
      for(let e of json.events) {
        this.populateRelationships(e.event, 'events').then( (success) => {
          events.push({ event: success, relationship: e.relationship});
        });

      }
      event.events = events;
      let peopleOrganizations = new Array<{personOrganization: PersonOrganization, relationship: string}>();
      for(let pO of json.peopleOrganizations) {
        this.populateRelationships(pO.personOrganization, 'peopleorganizations').then( (success) => {
          peopleOrganizations.push({ personOrganization : success, relationship: pO.relationship});
        })
      }
      event.peopleOrganizations = peopleOrganizations;

      let historicEvents = new Array<{historicEvent: HistoricEvent, relationship: string}>();
      for(let h of json.historicEvents) {
        this.populateRelationships(h.historicEvent, 'historicevents').then( (success) => {
          historicEvents.push({ historicEvent : success, relationship: h.relationship});
        })
      }
      event.historicEvents = historicEvents;

      let themes = new Array<{theme: Theme, relationship: string}>();
      for(let t of json.themes) {
        this.populateRelationships(t.theme, 'themes').then( (success) => {
          themes.push({ theme : success, relationship: t.relationship});
        })
      }
      event.themes = themes;

      let sources = new Array<{source: Source, relationship: string}>();
      for(let s of json.sources) {
        this.populateRelationships(s.source, 'sources').then( (success) => {
          sources.push({ source : success, relationship: s.relationship});
        })
      }
      event.sources = sources;

      let locations = new Array<{location: Location, relationship: string}>();
      for(let l of json.locations) {
        this.populateRelationships(l.location, 'locations').then( (success) => {
          locations.push({ location : success, relationship: l.relationship});
        })
      }
      event.locations = locations;

      let contributors = new Array<any>();
      for(let c of json.contributor) {
        this.populateRelationships(c.personOrganization, 'peopleorganizations').then((success) => {
          contributors.push({ personOrganization: success, relationship: c.relationship});
        });
      }
      event.contributor = contributors;
      let creators = new Array<any>();
      for(let c of json.creator) {
        this.populateRelationships(c.personOrganization, 'peopleorganizations').then((success) => {
          creators.push({ personOrganization: success, relationship: c.relationship});
        });
      }
      event.creator = creators;
    } else {
      event.events = json.events || [];
      event.peopleOrganizations = json.peopleOrganizations || [];
      event.historicEvents = json.historicEvents || [];
      event.themes = json.themes || [];
      event.sources = json.sources || [];
      event.locations = json.locations || [];
      event.contributor = json.contributor || [];
      event.creator = json.creator || [];
    }
    event.medialCoverage = json.medialCoverage;
    event.eras = json.eras;
    event.season = json.season;
    event.routes = json.routes;
    event.isMainEvent = json.isMainEvent;
    return event;
  }

  /**
   * Returns a historic event object constructred from json
   * @param json - json with all historic event properties
   * @return historicEvent - historic event object
   */
  getAsHistoricEvent(json: any, populate: boolean = false): HistoricEvent {
    let historicEvent = new HistoricEvent();
    
    historicEvent.objectId = json._id;
    historicEvent.status = json.status;
    historicEvent.author = json.author;
    historicEvent.name = json.name;
    historicEvent.startDate = json.startDate;
    historicEvent.endDate = json.endDate;
    historicEvent.eventStructuralType = json.eventStructuralType;
    historicEvent.eventDescriptiveType = json.eventDescriptiveType;
    historicEvent.abstract = json.abstract;
    historicEvent.description = json.description;
    historicEvent.identifiers = json.identifiers;
    historicEvent.dates = json.dates;

    if(populate) {
      // if true we should go into all related events and get their details from the db
      let historicEvents = new Array<{historicEvent: HistoricEvent, relationship: string}>();
      for(let h of json.historicEvents) {
        this.populateRelationships(h.historicEvent, 'historicevents').then( (success) => {
          historicEvents.push({ historicEvent : success, relationship: h.relationship});
        })
      }
      historicEvent.historicEvents = historicEvents;
    } else {
      historicEvent.historicEvents = json.historicEvents;
    }
    
    return historicEvent;
  }

/**
   * Returns an organization object constructred from json
   * @param json - json with all organization properties
   * @return organization - organization object
   */
  getAsPersonOrganization(json: any, populate: boolean = false): PersonOrganization {
    let personOrganization = new PersonOrganization();
    personOrganization.name = json.name;
    personOrganization.objectId = json._id;
    personOrganization.status = json.status;
    personOrganization.author = json.author;
    personOrganization.objectType = json.objectType;
    if(json.objectType === 'Person') {
      personOrganization.bio = json.bio;
      personOrganization.roles = json.roles;
      personOrganization.functions = json.functions;
    }
    if(json.objectType === 'Organization') {
      personOrganization.abstract = json.abstract;
      personOrganization.organizationTypes = json.organizationTypes;
    }
    
    if(populate) {
      // if true we should go into all related events and get their details from the db
      let peopleOrganizations = new Array<{personOrganization: PersonOrganization, relationship: string}>();
      for(let pO of json.peopleOrganizations) {
        this.populateRelationships(pO.personOrganization, 'peopleorganizations').then( (success) => {
          peopleOrganizations.push({ personOrganization : success, relationship: pO.relationship});
        })
      }
      personOrganization.peopleOrganizations = peopleOrganizations;
    } else {
      personOrganization.peopleOrganizations = json.peopleOrganizations;
    }

    return personOrganization;
  }
 

  /**
   * Returns an theme object constructred from json
   * @param json - json with all theme properties
   * @return theme - theme object
   */
  getAsTheme(json: any, populate: boolean = false): Theme {
    let theme = new Theme();
    
    theme.objectId = json._id;
    theme.status = json.status;
    theme.author = json.author;
    theme.name = json.name;
    theme.names = json.names;
    theme.abstract = json.abstract;
    theme.description = json.description;
    theme.dates = json.dates;
    theme.themeTypes = json.themeTypes;
    theme.identifiers = json.identifiers;

    if(populate) {
      // if true we should go into all related events and get their details from the db
      let themes = new Array<{theme: Theme, relationship: string}>();
      for(let t of json.themes) {
        this.populateRelationships(t.theme, 'themes').then( (success) => {
          themes.push({ theme : success, relationship: t.relationship});
        })
      }
      theme.themes = themes;
    } else {
      theme.themes = json.themes;
    }

    return theme;
  }

  /**
   * Returns all sources we have in the service
   * @return this.sources - array of sources we currently have
   */
  getSources(): Source[] {
    return this.sources;
  }

  /**
   * Performs HTTP GET to recieve all sources from the DB
   * @return promise - either resolve and return all sources or reject with error
   */
  getAllSources(): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'sources/').subscribe(
        (response: any) => {
          if(response.data) {
            for(let s of response.data) {
              this.sources.push(this.getAsSource(s));
            }
            resolve(this.sources);
          } else {
            reject('Could not parse as source');
          }
        });
    });
    return promise;
  }

  /**
   * Returns an source object constructred from json
   * @param json - json with all source properties
   * @return source - source object
   */
  getAsSource(json: any, populate: boolean = false): Source {
    let source = new Source();

    source.objectId = json._id;
    source.status = json.status;
    source.author = json.author;
    source.name = json.name;
    source.identifiers = json.identifiers;
    source.dates = json.dates;
    source.provenance = json.provenance;
    source.languages = json.languages;
    source.keywords = json.keywords;
    source.rights = json.rights;
    source.abstract = json.abstract;
    source.description = json.description;
    source.transcription = json.transcription;
    source.sourceType1 = json.sourceType1;
    source.sourceType2 = json.sourceType2;

    if(populate) {
      // if true we should go into all related events and get their details from the db
      let sources = new Array<{source: Source, relationship: string}>();
      for(let s of json.sources) {
        this.populateRelationships(s.source, 'sources').then( (success) => {
          sources.push({ source : success, relationship: s.relationship});
        })
      }
      source.sources = sources;

      let creatorContributors = new Array<{personOrganization: PersonOrganization, role: string, position: string}>();
      for(let c of json.creatorContributorPublisher) {
        this.populateRelationships(c.personOrganization, 'peopleorganizations').then( (success) => {
          creatorContributors.push({ personOrganization: success, role: c.role, position: c.position });
        })
      }
      source.creatorContributorPublisher = creatorContributors;
    } else {
      source.sources = json.sources;
      source.creatorContributorPublisher = json.creatorContributorPublisher;
    }

    return source;
  }

  
  /**
   * Performs HTTP GET to recieve all sources from the DB
   * @return promise - either resolve and return all sources or reject with error
   */
  getSource(id: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'sources/' + id).subscribe(
        (response: any) => {
          if(response.data) {
            resolve(this.getAsSource(response.data));
          } else {
            reject('Could not parse as source');
          }
        });
    });
    return promise;
  }


  /**
   *
   */
  findSource(name: string): Promise<any> {
    // TODO: implement (check db)
    return new Promise<any>((resolve, reject) => {});
  }
}
