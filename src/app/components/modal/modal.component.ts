import { Component, Inject, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { PersonOrganization } from '../../models/person.organization';
import { Event } from '../../models/event';
import { Location } from '../../models/location';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { LocationService } from '../../services/location.service';
import { EventService } from '../../services/event.service';
import { ThemeService } from '../../services/themes.service';
import { SourceService } from '../../services/sources.service';
import { PersonOrganizationService } from '../../services/people.organizations.service';
import { MiniMapComponent } from '../minimap/minimap.component';
import * as URL from 'url';
import { LightboxComponent } from '../lightbox/lightbox.component';


@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: [ './modal.component.scss' ]
})
export class ModalDialogComponent {
  loadingLocation = true;
  loadingOrganization = true;
  loadingPeople = true;
  loadingEvent = true;
  loadingSource = true;
  loadingTheme = true;
  private _albums: Array<any>;

  constructor(public dialogRef: MatDialogRef<ModalDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: any,
              private ls: LocationService,
              private es: EventService,
              private ps: PersonOrganizationService,
              private ts: ThemeService,
              private ss: SourceService,
              public lightbox: MatDialog) {
              this._albums = new Array<any>();
            }

  /**
   * Opens a modal (dialog)
   * @param e - event with data that we will display in the modal
   */
  open(e: any, idx: number): void {
    console.log(e);
    let lightboxRef = this.lightbox.open(LightboxComponent, {
      width: '55%',
      data: e,
    });
    lightboxRef.componentInstance.currentIdx = idx;
    lightboxRef.afterClosed().subscribe( (result: any) => {
      //console.log(result);
    });
  }

  closeModal(): void {
    this.dialogRef.close();
  }

  goToPerson(p: PersonOrganization): void {
    console.log('should navigate to ');
    console.log(p);
  }

  goToEvent(e: Event): void {
    console.log('should navigate to ');
    console.log(e);
  }

  goToLocation(l: Location): void {

  }

  goToSource(s: Source): void {

  }

  /**
   * Perform POST request to backend to get details about associated sources
   * We use the eventService for this
   * @param sources - array of sources as defined in the event
   * @param eventId - the record Id of the event
   */
  getSources(sources: Source[], eventId: string): void {
    let promiseArr = new Array<Promise<any>>();
    for(let s of sources) {
      //console.log(`looking for ${s.name}`);
      promiseArr.push(this.ss.findSource(s.name));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('sources');
      console.log(results);
      console.log('------------');
      this.es.addSources(results, eventId);
      for(let r of results) {
        for(let f of r.files) {
          let album = {
            src: f.url,
            caption: f.title
          }
          this._albums.push(album);
        }
      }
      this.loadingSource = false;
    });
  }

  /**
   * Perform POST request to backend to get details about associated events
   * We use the eventService for this
   * @param events - array of events as defined in the event
   * @param eventId - the record Id of the event
   */
  getEvents(events: Event[], eventId: string): void {
    let promiseArr = new Array<Promise<any>>();
    for(let e of events) {
      console.log(e.name);
      promiseArr.push(this.es.findEvent(e.name)
      .catch( (err) => {
        console.log('error in promise');
        console.log(err);
      }));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('events');
      console.log(results);
      console.log('------------');
      this.es.addRelatedEvents(results, eventId);
      this.loadingEvent = false;
    });
  }

  /**
   * Perform POST request to backend to get details about associated locations
   * We use the locationService for this
   * @param themes - array of themes as defined in the event
   * @param eventId - the record Id of the event
   */
  getThemes(themes: Theme[], eventId: string) {
    let promiseArr = new Array<Promise<any>>();
    for(let t of themes) {
      promiseArr.push(this.ts.findTheme(t.names[0].name));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('themes');
      console.log(results);
      console.log('------------');
      this.es.addThemes(results, eventId);
      this.loadingTheme = false;
    });
  }

  /**
   * Perform POST request to backend to get details about associated locations
   * We use the locationService for this
   * @param locations - array of locations as defined in the event
   * @param eventId - the record Id of the event
   */
  getLocations(locations: Location[], eventId: string): void {
    let promiseArr = new Array<Promise<any>>();
    console.log(locations);
    for(let l of locations) {
      promiseArr.push(this.ls.findLocation(l.names[0].name));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('locations');
      console.log(results);
      console.log('------------');
      this.es.addLocations(results, eventId);
      this.loadingLocation = false;
    });
  }

  /**
   * Perform POST request to backend to get details about associated people
   * We use the peopleService for this
   * @param people - array of people as defined in the event
   * @param eventId - the record Id of the event
   */
  getPeople(people: PersonOrganization[], eventId: string): void {
    let promiseArr = new Array<Promise<any>>();

    for(let p of people) {
      //console.log(p.names);
      promiseArr.push(this.ps.findPerson(p.names[0].name));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('people');
      console.log(results);
      console.log('------------');
      this.peopleOrOrganizations(results, eventId);
      this.loadingPeople = false;
    });
  }

  /**
   * Since we receive mixed array of results of type Person or Organisation
   * from FileMaker we need to correctly determine the type of object
   * and correctly update the services
   * @param results - array of mixed objects
   * @param eventId - id of the event that we want to update
   */
  peopleOrOrganizations(results: Array<any>, eventId: string): void {
    let peopleOrOrganizations = new Array<{ personOrganization: PersonOrganization, relationship: string}>();
    this.es.addPeopleOrganizations(peopleOrOrganizations, eventId);
  }

  /**
   * Returns true if the stype string is a image format
   * @param stype - the extension of a file
   */
  isImage(stype: string) {
    return stype.toLowerCase() === 'jpg' || stype.toLowerCase() === 'png' || stype.toLowerCase() === 'gif' || stype.toLowerCase() === 'tif';
  }

  /**
   * Returns true if the stype string is a video format
   * @param stype - the extension of a file
   */
  isVideo(stype: string) {
    return stype.toLowerCase() === 'webm' || stype.toLowerCase() === 'mp4';
  }

  /**
   * Returns true if the stype string is a pdf format
   * @param stype - the extension of a file
   */
  isPDF(stype: string) {
    return stype.toLowerCase() === 'pdf';
  }

  /**
   * Returns true if the stype string is a audio format
   * @param stype - the extension of a file
   */
  isAudio(stype: string) {
    return stype.toLowerCase() === 'mp3' || stype.toLowerCase() === 'mpeg' || stype.toLowerCase() === 'wav' || stype.toLowerCase() === 'ogg';
  }

  /**
   * Perform POST request to backend to get details about associated people
   * We use the peopleService for this
   * @param people - array of people as defined in the event
   * @param eventId - the record Id of the event
   */
  getOrganizations(organizations: PersonOrganization[], eventId: string): void {
    let promiseArr = new Array<Promise<any>>();

    for(let o of organizations) {
      //console.log(p.names);
      promiseArr.push(this.ps.findOrganization(o.names[0].name));
    }
    Promise.all(promiseArr).then( (results) => {
      console.log('organizations');
      console.log(results);
      console.log('------------');
      this.peopleOrOrganizations(results, eventId);
      this.loadingOrganization = false;
    });
  }

  /** Utility used to display dates in dialog
   * @param date - the date object
   * @param seperator - false for start dates, true for enddates
   * @return string - string representation of date in format startdate - enddate
   */
  prettyPrintDate(date: Date, separator?: boolean): string {
    if(date === null) return '';
    return (separator ? ' - ' : '') + date.getDate() +  '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
  }

  /**
   * Returns host name from a URL
   * @param url - URL string
   * @return string - the hostname of the URL e.g., example.com
   */
  getHost(url: string): string {
    return URL.parse(url).hostname;
  }

}
