import { Injectable } from '@angular/core';
import { Event } from '../models/event';
import { HistoricEvent } from '../models/historic.event';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Location } from '../models/location';
import { Source } from '../models/source';
import { Theme } from '../models/theme';
import { PersonOrganization } from '../models/person.organization';


@Injectable()
export class EventService {
  events: Event[];
  historicEvents: HistoricEvent[];

  private eventInterval = new BehaviorSubject<Array<Date>>(null);
  currentEventInterval = this.eventInterval.asObservable();

  private _START_DATE: Date;
  private _END_DATE: Date;

  constructor(private http: HttpClient) {
    this.events = new Array<Event>();
    this.historicEvents = new Array<HistoricEvent>();

    this._START_DATE = new Date('1/1/1918');
    this._END_DATE = new Date(); // Today
  }

  getOriginalStartDate(): Date {
    return this._START_DATE;
  }

  getOriginalEndDate(): Date {
    return this._END_DATE;
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
            reject('No data in response');
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
   * Returns all historic events we have in the service
   * @return this.historicEvents - array of historic events we currently have
   */
  getHistoricEvents(): HistoricEvent[] {
    return this.historicEvents;
  }

  /**
   * Performs HTTP GET to recieve all historic events from the DB
   * @return promise - either resolve and return all historic events or reject with error
   */
  getAllHistoricEvents(): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'historicevents/').subscribe(
        (response: any) => {
          if(response.data) {
            for(let e of response.data) {
              this.historicEvents.push(this.getAsHistoricEvent(e));
            }
            resolve(this.historicEvents);
          } else {
            reject('Could not parse as historic events');
          }
        }
      );
    });
    return promise;
  }

  getHistoricEvent(id: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'historicevents/' + id).subscribe(
        (response: any) => {
          if(response.data) {
            resolve(this.getAsHistoricEvent(response.data));
          } else {
            reject('Could not parse into historic event');
          }
        }
      );
    });
    return promise;
  }

  /**
   * Returns all events we have in the service
   * @return this.events - array of events we currently have
   */
  getEvents(): Event[] {
    return this.events;
  }
  
  /**
   * Performs HTTP GET to recieve all events from the DB
   * @return promise - either resolve and return all events or reject with error
   */
  getAllEvents(): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'events/').subscribe(
        (response: any) => {
          if(response.data) {
            for(let e of response.data) {
              this.events.push(this.getAsEvent(e, true));
            }
            resolve(this.events);
          } else {
            reject('Could not parse as events');
          }
        }
      );
    });
    return promise;
  }

  /**
   * Get event by its ID
   * @param id - the id of the event to get
   * @return promise - either resolve with the event or reject with error
   */
  getEvent(objectId: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      this.http.get(environment.API_URL + 'events/' + objectId).subscribe(
        (response: any) => {
          if(response.data) {
            resolve(this.getAsEvent(response.data));
          } else {
            reject('Could not parse as Event');
          }
        }
      );
    });
    return promise;
  }

  /**
   * Adds locations to the data model of the event
   * @param locations - array of locations
   * @param objectId - event record ID where we will add locations
   */
  addLocations(locations: {location: Location, relationship: string}[], objectId: string): void {
    let event = this.events.find((e: Event) => { return e.objectId === objectId; });
    event.locations = locations;
  }

  /**
   * Adds themes to the data model of the event
   * @param themes - array of themes
   * @param objectId - event record ID where we will add themes
   */
  addThemes(themes: {theme: Theme, relationship: string}[], objectId: string): void {
   let event = this.events.find((e: Event) => { return e.objectId === objectId; });
   event.themes = themes;
  }

  /**
   * Adds sources to the data model of the event
   * @param sources - array of sources
   * @param objectId - event record ID where we will add sources
   */
  addSources(sources: {source: Source, relationship: string}[], objectId: string): void {
    let event = this.events.find((e: Event) => { return e.objectId === objectId; });
    event.sources = sources;
  }

  /**
   * Adds people/organizations to the data model of the event
   * @param people - array of people
   * @param objectId - event record ID where we will add people
   */
  addPeopleOrganizations(peopleOrganizations: {personOrganization: PersonOrganization, relationship: string}[], objectId: string): void {
    let event = this.events.find((e: Event) => { return e.objectId === objectId; });
    event.peopleOrganizations = peopleOrganizations;
  }

  /**
   * Adds related events to the data model of the event
   * @param events - array of related events
   * @param objectId - event record ID where we will add related events
   */
  addRelatedEvents(events: {event: Event, relationship: string}[], objectId: string): void {
    let event = this.events.find((e: Event) => { return e.objectId === objectId; });
    event.events = events;
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
    event.startDate = new Date(json.startDate);
    event.endDate =  new Date(json.endDate);
    event.internal = json.internal;
    event.external = json.external;
    event.geodata = json.geodata;

    // RELATIONSHIPS
    // look them up and add them to the event model
    let themePromise = new Array<Promise<any>>();
    let locationPromise = new Array<Promise<any>>();
    let histEvPromise = new Array<Promise<any>>();
    let sourcePromise = new Array<Promise<any>>();
    let eventPromise = new Array<Promise<any>>();
    let peoplePromise = new Array<Promise<any>>();
    let creatorPromise = new Array<Promise<any>>();
    let contributorPromise = new Array<Promise<any>>();
    if(populate) {
      // let events = new Array<{event: Event, relationship: string}>();
      for(let e of json.events) {
        eventPromise.push(this.populateRelationships(e.event, 'events'));
        // .then( (success) => {
        //   events.push({ event: success, relationship: e.relationship });
        // });
      }
      // event.events = events;
      // let peopleOrganizations = new Array<{personOrganization: PersonOrganization, relationship: string}>();
      for(let pO of json.peopleOrganizations) {
        peoplePromise.push(this.populateRelationships(pO.personOrganization, 'peopleorganizations'));
        // .then( (success) => {
        //   peopleOrganizations.push({ personOrganization : success, relationship: pO.relationship});
        // })
      }
      // event.peopleOrganizations = peopleOrganizations;

      let historicEvents = new Array<{historicEvent: HistoricEvent, relationship: string}>();
      for(let h of json.historicEvents) {
        histEvPromise.push(this.populateRelationships(h.historicEvent, 'historicevents'));
        // .then( (success) => {
        //   historicEvents.push({ historicEvent : success, relationship: h.relationship});
        // });
      }
     
      event.historicEvents = historicEvents;

      // let themes = new Array<{theme: Theme, relationship: string}>();
      for(let t of json.themes) {
        themePromise.push(this.populateRelationships(t.theme, 'themes'));
        // .then( (success) => {
        //   themes.push({ theme : success, relationship: t.relationship});
        // })
      }
     
      // event.themes = themes;

      // let sources = new Array<{source: Source, relationship: string}>();
      for(let s of json.sources) {
        sourcePromise.push(this.populateRelationships(s.source, 'sources'));
        // .then( (success) => {
        //   sources.push({ source : success, relationship: s.relationship});
        // })
      }
      // event.sources = sources;

      // let locations = new Array<{location: Location, relationship: string}>();
      for(let l of json.locations) {
        locationPromise.push(this.populateRelationships(l.location, 'locations'));
        // .then( (success) => {
        //   locations.push({ location : success, relationship: l.relationship});
        // })
      }
      // event.locations = locations;

      // let contributors = new Array<any>();
      for(let c of json.contributor) {
        contributorPromise.push(this.populateRelationships(c.personOrganization, 'peopleorganizations'));
        // .then((success) => {
        //   contributors.push({ personOrganization: success, relationship: c.relationship});
        // });
      }
      // event.contributor = contributors;
      // let creators = new Array<any>();
      for(let c of json.creator) {
        creatorPromise.push(this.populateRelationships(c.personOrganization, 'peopleorganizations'));
        // .then((success) => {
        //   creators.push({ personOrganization: success, relationship: c.relationship});
        // });
      }
      // event.creator = creators;
      Promise.all(themePromise).then((success) => {
        event.themes = success;
      })
      Promise.all(eventPromise).then((success) => {
        event.events = success;
      })
      Promise.all(locationPromise).then((success) => {
        event.locations = success;
      })
      Promise.all(peoplePromise).then((success) => {
        event.peopleOrganizations = success;
      })
      Promise.all(histEvPromise).then((success) => {
        event.historicEvents = success;
      })
      Promise.all(sourcePromise).then((success) => {
        event.sources = success;
      })
      Promise.all(creatorPromise).then((success) => {
        event.creator = success;
      })
      Promise.all(contributorPromise).then((success) => {
        event.contributor = success;
      })
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
    event.routes = json.routes;
    event.isMainEvent = json.isMainEvent;
    Promise.all([
      themePromise,
      locationPromise,
      histEvPromise,
      sourcePromise,
      eventPromise,
      peoplePromise,
      creatorPromise,
      contributorPromise
    ]).then((success) => {
      console.log('all promises resolved');
      return event;
    });
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
   * Query the database for events matching a given name
   @param name - the name of the event we are looking for
   @return promise - promise with resolve and reject
   */
  findEvent(name: string): Promise<any> {
    // TODO implement (check db)
    return new Promise<any>((resolve, reject) => {});
  }

  /**
   * Updates the time interval that the user is looking at
   @param dates - a date array index 0 is the minimum date, index 1 is the maximum date
   */
  updateEventServiceInterval(dates: Array<Date>): void {
      // if(dates[0] < this._START_DATE) {
      //   `console`.log('start date out of bound setting to' + this.prettyPrintDate(this._START_DATE));
      //   dates[0] = this._START_DATE;
      // }
      // if(dates[1] > this._END_DATE) {
      //   console.log('end date out of bound setting to' + this.prettyPrintDate(this._END_DATE));
      //   dates[0] = this._END_DATE;
      // }
      this.eventInterval.next(dates);
  }

  /**
   * Remove events from array that have no date or location
   * @return array - number array with the id's of the items we want to remove
   */
  cleanData(): Array<number> {
    // TODO just check if status===ONLINE (ready to go objects)
    let idArr = new Array<number>();
    let idx = 0;
    for(let e of this.events) {
      if(!e.startDate) {
        idArr.push(idx);
      }
      idx++;
    }
    return idArr;
  }

  /**
   * Removes all elements from the array based on their id
   * @param ids - array of id's to remove
   */
  removeIDs(ids: Array<number>): void {
    let removedItems = 0;
    for(let id of ids) {
      // id's of spliced array keep changing as we remove them
      // removedItems should account for that
      this.events.splice((id - removedItems), 1);
      removedItems++;
    }
  }



  /**
   * Check which events are considered subevents and which are main
   */
  checkForHierarchicalEvents(): void {
    // we are interested in setting isMainEvent based on the following relationships:
    // * references
    // * hasPart
    // * hasVersion
    // * isBasisFor
    // first pass to tag sub events
    // let subEvents = new Array<Event>()
    // for(let i of this.events) {
    //   for(let j of i.events) {
    //     //if(j.relationType === 'references' || j.relationType === 'isPartOf' || j.relationType === 'isVersionOf' || j.relationType === 'isBasedOn') {
    //     //j.relationType === 'isReferencedBy' ||
    //     if(j.relationType === 'hasPart') { // Event A hasPart-> Event B means that B is a subevent of A
    //       subEvents.push(j);
    //     }
    //   }
    // }

    // for(let i of subEvents) {
    //   for(let j of this.events) {
    //     if(i.name === j.name) {
    //       j.isMainEvent = false;
    //     }
    //   }
    // }
  }

  /**
   * Utility function for printing gates in the format DD/MM/YYYY
   * @param date - the date object to print
   * @param seperator - if true prepends a ' - ' to the date
   */
  prettyPrintDate(date: Date, separator?: boolean): string {
    if(date === null) return '';
    return (separator ? ' - ' : '') + date.getDate() +  '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
  }
}
