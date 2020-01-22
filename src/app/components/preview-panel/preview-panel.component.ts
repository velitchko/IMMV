import { Component, Inject, AfterViewInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PersonOrganization } from '../../models/person.organization';
import { Event } from '../../models/event';
import { Location } from '../../models/location';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { HistoricEvent } from '../../models/historic.event';
import * as URL from 'url';
import { LightboxComponent } from '../lightbox/lightbox.component';
import { ThemeService } from '../../services/theme.service';
import { DatabaseService } from 'src/app/services/db.service';
import * as moment from 'moment';

@Component({
  selector: 'app-previewpanel',
  templateUrl: './preview-panel.component.html',
  styleUrls: ['./preview-panel.component.scss']
})

export class PreviewComponent {
  @Input() event: Event;
  eventLoaded: boolean = false;
  eventMedia: Source;

  objects: Array<any>;

  loadingLocation = true;
  loadingOrganization = true;
  loadingPeople = true;
  loadingEvent = true;
  loadingSource = true;
  loadingTheme = true;

  constructor(private ts: ThemeService, 
              private db: DatabaseService,
              public lightbox: MatDialog) {
    this.eventMedia = new Source();
    console.log('initializing object array');
    console.log(this.objects);
    this.objects = new Array<any>();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes && this.event) {
      this.objects.push(this.event);
      this.eventLoaded = true;
      this.eventMedia = new Source();
      this.event.sources.forEach((s: any) => {
        s.source.identifiers.forEach((m: any) => {
          this.eventMedia.identifiers.push(m);
        });
      });
    }
  }


  goToPerson(p: PersonOrganization): void {
    this.objects.push(p);
  }

  goToEvent(event: Event): void {
    // TODO: Loading indicator
    this.db.getAsEvent(event).then((success: any) => {
      // update event object
      this.objects.push(success);
      this.event = this.objects[this.objects.length - 1];
      // update sources
      this.eventMedia = new Source();
      this.event.sources.forEach((s: any) => {
        s.source.identifiers.forEach((m: any) => {
          this.eventMedia.identifiers.push(m);
        });
      });
    });
  }

  goToLocation(l: Location): void {
    this.objects.push(l);
  }

  goToSource(s: Source): void {
    this.objects.push(s);
  }

  goBack(): void {
    if(this.objects.length === 1) return; // dont pop with 1 element
    this.objects.pop();
    this.event = this.objects[this.objects.length - 1];
  }

  /**
   * Get a random hex color
   * @return string - hex color
   */
  getRandomColor(): string {
    return '#5516d2';
    //return '#'+Math.floor(Math.random()*16777215).toString(16);
  }


  /**
   * Opens a modal (dialog)
   * @param e - event with data that we will display in the modal
   */
  open(e: any, idx: number): void {
    let lightboxRef = this.lightbox.open(LightboxComponent, {
      width: '55%',
      data: e,
    });
    lightboxRef.componentInstance.currentIdx = idx;
  }

  /**
   * Get the hex color assigned to a specific category
   * @param category - the category we are searching a color for
   * @return string - hex color
   */
  getColorForCategory(category: Theme): string {
    let color = this.ts.getColorForTheme(category.objectId);
    return color ? color : 'lightgray';
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


  getMediaIcon(stype: string): string {
    if (this.isPDF(stype)) return 'picture_as_pdf';
    if (this.isVideo(stype)) return 'video_library'
    if (this.isImage(stype)) return 'photo_library'
  }

  /** Utility used to display dates in dialog
   * @param date - the date object
   * @param seperator - false for start dates, true for enddates
   * @return string - string representation of date in format startdate - enddate
   */
  prettyPrintDate(date: Date, separator?: boolean): string {
    if (date === null) return '';
    if(isNaN(date.getTime())) return '';
    return (separator ? ' - ' : '') + date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
  }

  /**
   * Returns host name from a URL
   * @param url - URL string
   * @return string - the hostname of the URL e.g., example.com
   */
  getHost(url: string): string {
    return URL.parse(url).hostname.replace('www.', '');
  }

  hasHost(url: string): boolean {
    return URL.parse(url).hostname ? true : false;
  }

  displaySource(source: Source): boolean {
    // if at least one indentifier points to an external url
    let show = false;
    source.identifiers.forEach((s: any) => {
      if(this.hasHost(s.url)) { 
        show = true;
        return;
      }
    });
    return show;
  }

  getIconForSource(source: any): string {
    let icon: string;
    switch(source.sourceType) {
      case 'Image':
        icon = 'image';
        break; 
      case 'Sound':
        icon = 'audiotrack';
        break;
      case 'Text':
        icon = 'short_text';
        break;
      case 'Moving Image':
        icon = 'play_arrow';
        break;
      default: 
        icon = 'link';
        break;
    }

    return icon;
  }

}
