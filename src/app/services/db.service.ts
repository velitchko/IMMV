import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { Event } from '../models/event';
import { HistoricEvent } from '../models/historic.event';
import { PersonOrganization } from '../models/person.organization';
import { Location } from '../models/location';
import { Theme } from '../models/theme';
import { Source } from '../models/source';


@Injectable()
export class DatabaseService {
    events: Array<Event>;
    historicEvents: Array<HistoricEvent>;
    people: Array<PersonOrganization>;
    organizations: Array<PersonOrganization>
    locations: Array<Location>;
    themes: Array<Theme>;
    sources: Array<Source>;

    constructor(private http: HttpClient) {
        this.events = new Array<Event>();
        this.historicEvents = new Array<HistoricEvent>();
        this.people = new Array<PersonOrganization>();
        this.organizations = new Array<PersonOrganization>();
        this.locations = new Array<Location>();
        this.themes = new Array<Theme>();
        this.sources = new Array<Source>();
    }

    private getAsObjectType(type: string, response: any): any {
        switch (type) {
            case 'events':
                return this.getAsSimpleEvent(response.data);
            case 'historicevents':
                return this.getAsSimpleHistoricEvent(response.data);
            case 'peopleorganizations':
                return this.getAsSimplePersonOrganization(response.data);
            case 'themes':
                return this.getAsSimpleTheme(response.data);
            case 'locations':
                return this.getAsSimpleLocation(response.data);
            case 'sources':
                return this.getAsSimpleSource(response.data);
            default:
                break; // nothing found error or null return? TODO
        }
    }

    private populateRelationships(id: string, relationship: string, endPoint: string, role?: string): Promise<any> {
        let promise = new Promise<any>((resolve, reject) => {
            this.http.get(`${environment.API_URL}${endPoint}/${id}`)
                .subscribe((response: any) => {
                    if (response.data) {
                        resolve({
                            entry: this.getAsObjectType(endPoint, response),
                            relationship: relationship,
                            role: role ? role : '',
                            type: endPoint
                        });
                    } else {
                        reject('No data in response');
                    }
                });
        });

        return promise;
    }

    getEvents(): Array<Event> {
        return this.events;
    }

    getEventById(objectId: string): Event {
        return this.events.find((e: Event) => { return e.objectId === objectId; });
    }
    /**
   * Performs HTTP GET to recieve all events from the DB
   * @return promise - either resolve and return all events or reject with error
   */
    async getAllEvents(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'events/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsEvent(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: Event) => {
                                    this.events.push(s);
                                })
                                resolve(this.events);
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as events');
                        }
                    } else {
                        for(let e of response.data) {
                            this.events.push(this.getAsSimpleEvent(e));
                        }
                        resolve(this.events);
                    }
                }
            );
        });
        return promise;
    }

    getAsSimpleEvent(json: any): Event {
        let event = new Event();
        event.objectId = json._id;
        event.status = json.status;
        event.author = json.author;
        event.name = json.name;
        event.eventType = json.eventType;
        event.startDate = json.startDate ? new Date(json.startDate) : null;
        event.endDate = json.endDate ? new Date(json.endDate) : null;
        event.internal = json.internal;
        event.external = json.external;
        event.geodata = json.geodata;
        event.routes = json.routes;
        event.isMainEvent = json.isMainEvent;
        event.events = json.events || [];
        event.peopleOrganizations = json.peopleOrganizations || [];
        event.historicEvents = json.historicEvents || [];
        event.themes = json.themes || [];
        event.sources = json.sources || [];
        event.locations = json.locations || [];
        event.contributor = json.contributor || [];
        event.creator = json.creator || [];
        return event;
    }

    async getAsEvent(json: any): Promise<any> {
        let event = new Event();
        event.objectId = json._id ? json._id : json.objectId;
        event.status = json.status;
        event.author = json.author;
        event.name = json.name;
        event.eventType = json.eventType;
        event.startDate = json.startDate ? new Date(json.startDate) : null;
        event.endDate = json.endDate ? new Date(json.endDate) : null;
        event.internal = json.internal;
        event.external = json.external;
        event.geodata = json.geodata;
        event.routes = json.routes;
        event.isMainEvent = json.isMainEvent;
        // RELATIONSHIPS
        // look them up and add them to the event model
        let promiseArr = new Array<Promise<any>>();
        
        for (let e of json.events) {
            if((typeof e.event) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(e.event, e.relationship, 'events'));
        }
        for (let pO of json.peopleOrganizations) {
            if((typeof pO.personOrganization) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(pO.personOrganization, pO.relationship, 'peopleorganizations', pO.role));
        }
        for (let h of json.historicEvents) {
            if((typeof h.historicEvent) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(h.historicEvent, h.relationship, 'historicevents'));
        }
        for (let t of json.themes) {
            if((typeof t.theme) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(t.theme, t.relationship, 'themes'));
        }
        for (let s of json.sources) {
            if((typeof s.source) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(s.source, s.relationship, 'sources'));
        }
        for (let l of json.locations) {
            if((typeof l.location) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(l.location, l.relationship, 'locations'));
        }
        for (let c of json.contributor) {
            if((typeof c.personOrganization) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(c.personOrganization, 'isContributor', 'peopleorganizations'));
        }
        for (let c of json.creator) {
            if((typeof c.personOrganization) !== 'string' ) continue;
            promiseArr.push(this.populateRelationships(c.personOrganization, 'isCreator', 'peopleorganizations'));
        }
        // incase promise arr is empty -> we already have all the objects resolved -> return the event
        if(promiseArr.length === 0) {
            event.events = json.events;
            event.historicEvents = json.historicEvents;
            event.peopleOrganizations = json.peopleOrganizations;
            event.contributor = json.contributor;
            event.creator = json.creator;
            event.locations = json.locations;
            event.themes = json.themes;
            event.sources = json.sources;

            let promise = new Promise((resolve, reject) => {
                resolve(event);
            });

            return promise;
        }

        return Promise.all(promiseArr).then((success) => {
            success.forEach((s: any) => {
                switch (s.type) {
                    case 'themes':
                        event.themes.push({ theme: s.entry, relationship: s.relationship });
                        return;
                    case 'peopleorganizations':
                        event.peopleOrganizations.push({ personOrganization: s.entry, relationship: s.relationship, role: s.role })
                        if (s.relationship === 'isContributor') event.contributor.push({ personOrganization: s.entry, role: 'Contributor' });
                        if (s.relationship === 'isCreator') event.creator.push({ personOrganization: s.entry, role: 'Creator' });
                        return;
                    case 'locations':
                        event.locations.push({ location: s.entry, relationship: s.relationship });
                        return;
                    case 'sources':
                        event.sources.push({ source: s.entry, relationship: s.relationship });
                        return;
                    case 'events':
                        event.events.push({ event: s.entry, relationship: s.relationship });
                        return;
                    case 'historicevents':
                        event.historicEvents.push({ historicEvent: s.entry, relationship: s.relationship });
                        return;
                }
            });
            return event;
        }).catch((err) => {
            console.log(err);
            return null;
        });
    }

    getHistoricEvents(): Array<HistoricEvent> {
        return this.historicEvents;
    }

    getHistoricEventById(objectId: string): HistoricEvent {
        return this.historicEvents.find((e: HistoricEvent) => { return e.objectId === objectId; });
    }

    /**
  * Performs HTTP GET to recieve all events from the DB
  * @return promise - either resolve and return all events or reject with error
  */
    async getAllHistoricEvents(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'historicevents/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsHistoricEvent(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: HistoricEvent) => {
                                    this.historicEvents.push(s);
                                })
                                resolve(this.historicEvents);
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as historic events');
                        }
                    } else {
                        for(let e of response.data) {
                            this.historicEvents.push(this.getAsSimpleHistoricEvent(e));
                        }
                        resolve(this.historicEvents);
                    }
                }
            );
        });
        return promise;
    }

    getAsSimpleHistoricEvent(json: any): HistoricEvent {
        let historicEvent = new HistoricEvent();

        historicEvent.objectId = json._id;
        historicEvent.status = json.status;
        historicEvent.author = json.author;
        historicEvent.name = json.name;
        historicEvent.startDate = json.startDate ? new Date(json.startDate) : null;
        historicEvent.endDate = json.endDate ? new Date(json.endDate) : null;
        historicEvent.eventStructuralType = json.eventStructuralType;
        historicEvent.eventDescriptiveType = json.eventDescriptiveType;
        historicEvent.abstract = json.abstract;
        historicEvent.description = json.description;
        historicEvent.identifiers = json.identifiers;
        historicEvent.dates = json.dates;
        historicEvent.historicEvents = json.historicEvents;
        return historicEvent;
    }

    /**
  * Returns a historic event object constructred from json
  * @param json - json with all historic event properties
  * @return historicEvent - historic event object
  */
    async getAsHistoricEvent(json: any): Promise<any> {
        let historicEvent = new HistoricEvent();

        historicEvent.objectId = json._id ? json._id : json.objectId;
        historicEvent.status = json.status;
        historicEvent.author = json.author;
        historicEvent.name = json.name;
        historicEvent.startDate = json.startDate ? new Date(json.startDate) : null;
        historicEvent.endDate = json.endDate ? new Date(json.endDate) : null;
        historicEvent.eventStructuralType = json.eventStructuralType;
        historicEvent.eventDescriptiveType = json.eventDescriptiveType;
        historicEvent.abstract = json.abstract;
        historicEvent.description = json.description;
        historicEvent.identifiers = json.identifiers;
        historicEvent.dates = json.dates;

        // if true we should go into all related events and get their details from the db
        let promsieArr = new Array<Promise<any>>();
        for (let h of json.historicEvents) {
            promsieArr.push(this.populateRelationships(h.historicEvent, h.relationship, 'historicevents'))
        }
        return Promise.all(promsieArr).then((success) => {
            success.forEach((s: any) => {
                historicEvent.historicEvents.push({
                    historicEvent: s.entry,
                    relationship: s.relationship
                });
            });
            return historicEvent;
        }).catch((err) => {
            console.log(err);
        })

    }

    getPeople(): Array<PersonOrganization> {
        return this.people;
    }

    getPersonById(objectId: string): PersonOrganization {
        return this.people.find((e: PersonOrganization) => { return e.objectId === objectId; });
    }

    getOrganizations(): Array<PersonOrganization> {
        return this.organizations;
    }
    getOrganizationById(objectId: string): PersonOrganization {
        return this.organizations.find((e: PersonOrganization) => { return e.objectId === objectId; });
    }

    /**
* Performs HTTP GET to recieve all events from the DB
* @return promise - either resolve and return all events or reject with error
*/
    async getAllPeopleOrganizationsEvents(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'peopleorganizations/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsPersonOrganization(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: PersonOrganization) => {
                                    if (s.objectType === 'Person') this.people.push(s);
                                    if (s.objectType === 'Organization') this.organizations.push(s);
                                })
                                resolve(this.people.concat(this.organizations));
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as historic events');
                        }
                    } else {
                        for (let e of response.data) {
                            let pO = this.getAsSimplePersonOrganization(e);
                            pO.objectType === 'Person' ? this.people.push(pO) : this.organizations.push(pO);
                        }
                        resolve(this.people.concat(this.organizations));
                    }
                }
            );
        });
        return promise;
    }

    getAsSimplePersonOrganization(json: any): PersonOrganization {
        let personOrganization = new PersonOrganization();
        personOrganization.name = json.name;
        personOrganization.objectId = json._id;
        personOrganization.status = json.status;
        personOrganization.author = json.author;
        personOrganization.objectType = json.objectType;
        personOrganization.dates = json.dates;
        if (json.objectType === 'Person') {
            personOrganization.bio = json.bio;
            personOrganization.roles = json.roles;
            personOrganization.functions = json.functions;
        }
        if (json.objectType === 'Organization') {
            personOrganization.abstract = json.abstract;
            personOrganization.organizationTypes = json.organizationTypes;
        }
        personOrganization.peopleOrganizations = json.peopleOrganizations;
        return personOrganization;

    }


    /**
  * Returns an organization object constructred from json
  * @param json - json with all organization properties
  * @return organization - organization object
  */
    async getAsPersonOrganization(json: any): Promise<any> {
        let personOrganization = new PersonOrganization();
        personOrganization.name = json.name;
        personOrganization.objectId = json._id ? json._id : json.objectId;
        personOrganization.status = json.status;
        personOrganization.author = json.author;
        personOrganization.objectType = json.objectType;
        personOrganization.dates = json.dates;
        if (json.objectType === 'Person') {
            personOrganization.bio = json.bio;
            personOrganization.roles = json.roles;
            personOrganization.functions = json.functions;
        }
        if (json.objectType === 'Organization') {
            personOrganization.abstract = json.abstract;
            personOrganization.organizationTypes = json.organizationTypes;
        }

        // if true we should go into all related events and get their details from the db
        let promiseArr = new Array<Promise<any>>();
        for (let pO of json.peopleOrganizations) {
            promiseArr.push(this.populateRelationships(pO.personOrganization, pO.relationship, 'peopleorganizations'))
        }
        return Promise.all(promiseArr).then((success) => {
            success.forEach((s: any) => {
                personOrganization.peopleOrganizations.push({
                    personOrganization: s.entry,
                    relationship: s.relationship
                });
            });
            return personOrganization;
        }).catch((err) => {
            console.log(err);
        })
    }

    getThemes(): Array<Theme> {
        return this.themes;
    }

    getThemeById(objectId: string): Theme {
        return this.themes.find((e: Theme) => { return e.objectId === objectId; });
    }

    /**
* Performs HTTP GET to recieve all events from the DB
* @return promise - either resolve and return all events or reject with error
*/
    async getAllThemes(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'themes/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsTheme(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: Theme) => {
                                    this.themes.push(s);
                                })
                                resolve(this.themes);
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as historic events');
                        }
                    } else {
                        for(let e of response.data) {
                            this.themes.push(this.getAsSimpleTheme(e));
                        }
                        resolve(this.themes);
                    }
                }
            );
        });
        return promise;
    }

    getAsSimpleTheme(json: any): Theme {
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
        theme.themes = json.themes;
        return theme;
    }

    /**
    * Returns an theme object constructred from json
    * @param json - json with all theme properties
    * @return theme - theme object
    */
    async getAsTheme(json: any): Promise<any> {
        let theme = new Theme();

        theme.objectId = json._id ? json._id : json.objectId;
        theme.status = json.status;
        theme.author = json.author;
        theme.name = json.name;
        theme.names = json.names;
        theme.abstract = json.abstract;
        theme.description = json.description;
        theme.dates = json.dates;
        theme.themeTypes = json.themeTypes;
        theme.identifiers = json.identifiers;

        let promiseArr = new Array<Promise<any>>();
        for (let t of json.themes) {
            promiseArr.push(this.populateRelationships(t.theme, t.relationship, 'themes'));
        }
        return Promise.all(promiseArr).then((success) => {
            success.forEach((s: any) => {
                theme.themes.push({
                    theme: s.entry,
                    relationship: s.relationship
                });
            });
            return theme;
        }).catch((err) => {
            console.log(err);
        });
    }

    getLocations(): Array<Location> {
        return this.locations;
    }

    getLocationById(objectId: string): Location {
        return this.locations.find((e: Location) => { return e.objectId === objectId; });
    }

    /**
    * Performs HTTP GET to recieve all events from the DB
    * @return promise - either resolve and return all events or reject with error
    */
    async getAllLocations(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'locations/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsLocation(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: Location) => {
                                    this.locations.push(s);
                                })
                                resolve(this.locations);
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as historic events');
                        }
                    } else {
                        for(let e of response.data) {
                            this.locations.push(this.getAsSimpleLocation(e));
                        }
                        resolve(this.locations);
                    }
                }
            );
        });
        return promise;
    }

    getAsSimpleLocation(json: any): Location {
        let location = new Location();
        location.objectId = json._id;
        location.status = json.status;
        location.author = json.author;
        location.name = json.name;
        location.names = json.names;
        location.locationTypes = json.locationTypes;
        location.identifiers = json.identifiers;
        location.geodata = json.geodata;
        location.locations = json.locations;
        return location;
    }

    /**
     * Returns an Location object constructred from json
     * @param json - json with all location properties
     * @return location - location object
     */
    async getAsLocation(json: any): Promise<any> {
        let location = new Location();
        location.objectId = json._id ? json._id : json.objectId;
        location.status = json.status;
        location.author = json.author;
        location.name = json.name;
        location.names = json.names;
        location.locationTypes = json.locationTypes;
        location.identifiers = json.identifiers;
        location.geodata = json.geodata;

        let promiseArr = new Array<Promise<any>>();
        for (let l of json.locations) {
            promiseArr.push(this.populateRelationships(l.location, l.relationship, 'locations'));
        }
        return Promise.all(promiseArr).then((success) => {
            success.forEach((s: any) => {
                location.locations.push({
                    location: s.entry,
                    relationship: s.relationship
                });
            });
            return location;
        }).catch((err) => {
            console.log(err);
        });
    }

    getSources(): Array<Source> {
        return this.sources;
    }

    getSourcetById(objectId: string): Source {
        return this.sources.find((e: Source) => { return e.objectId === objectId; });
    }

    /**
* Performs HTTP GET to recieve all events from the DB
* @return promise - either resolve and return all events or reject with error
*/
    async getAllSources(populate = false): Promise<any> {
        let promise = new Promise((resolve, reject) => {
            this.http.get(environment.API_URL + 'sources/').subscribe(
                (response: any) => {
                    if(populate) {
                        let promiseArr = new Array<Promise<any>>();
                        if (response.data) {
                            for (let e of response.data) {
                                promiseArr.push(this.getAsSource(e));
                            }
                            Promise.all(promiseArr).then((success) => {
                                success.forEach((s: Source) => {
                                    this.sources.push(s);
                                })
                                resolve(this.sources);
                            }).catch((err) => {
                                console.log(err);
                            })
                        } else {
                            reject('Could not parse as historic events');
                        }
                    } else {
                        for( let e of response.data) {
                            this.sources.push(this.getAsSimpleSource(e));
                        }
                        resolve(this.sources);
                    }
                }
            );
        });
        return promise;
    }

    getAsSimpleSource(json: any): Source {
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
        source.sources = json.sources;
        source.creatorContributorPublisher = json.creatorContributorPublisher;
        return source;
    }

    /**
     * Returns an source object constructred from json
     * @param json - json with all source properties
     * @return source - source object
     */
    async getAsSource(json: any): Promise<any> {
        let source = new Source();

        source.objectId = json._id ? json._id : json.objectId;
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

        // if true we should go into all related events and get their details from the db
        let promiseArr = new Array<Promise<any>>();
        for (let s of json.sources) {
            promiseArr.push(this.populateRelationships(s.source, s.relationship, 'sources'));
        }
        for (let c of json.creatorContributorPublisher) {
            promiseArr.push(this.populateRelationships(c.personOrganization, c.position, 'peopleorganizations'));
        }
        return Promise.all(promiseArr).then((success) => {
            success.forEach((s: any) => {
                switch (s.type) {
                    case 'sources':
                        source.sources.push({ source: s.entry, relationship: s.relationship });
                        return;
                    case 'peopleorganizations':
                        source.creatorContributorPublisher.push({
                            personOrganization: s.entry,
                            position: '',
                            role: '' // TODO: modify for role ?
                        })
                        return;
                }
            });
            return source;
        }).catch((err) => {
            console.log(err);
        });
    }
}