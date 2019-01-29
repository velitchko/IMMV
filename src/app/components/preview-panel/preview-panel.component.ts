import { Component, Inject, AfterViewInit, Input, OnChanges, SimpleChanges } from '@angular/core';
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
import { MusicMapService } from '../../services/musicmap.service';
import * as URL from 'url';
import { LightboxComponent } from '../lightbox/lightbox.component';
import { resolve } from 'bluebird';
import { promise } from 'protractor';


@Component({
  selector: 'app-previewpanel',
  templateUrl: './preview-panel.component.html',
  styleUrls: ['./preview-panel.component.scss']
})

export class PreviewComponent {
  @Input() event: Event;
  eventLoaded: boolean = false;
  eventMedia: Source;

  loadingLocation = true;
  loadingOrganization = true;
  loadingPeople = true;
  loadingEvent = true;
  loadingSource = true;
  loadingTheme = true;

  constructor(private mms: MusicMapService, public lightbox: MatDialog) {
    this.eventMedia = new Source();
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes && this.event) {
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
  getColorForCategory(category: string): string {
    return this.mms.getColorAssignmentForCategory(category);
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
    return URL.parse(url).hostname;
  }

}
