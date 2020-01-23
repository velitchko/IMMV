import { Component, Inject, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-lightbox',
  templateUrl: './lightbox.component.html',
  styleUrls: [ './lightbox.component.scss' ]
})
export class LightboxComponent {
  items: Array<any>;
  currentIdx: any;
  lbHeight: number;
  isBrowser: boolean;
  // locally stored in db
  // items - array of images, videos, pdfs
  // item = {
  //  type : image/video/pdf
  //  url : string
  //  title : string
  // note?: string - dunno if this is used
  // }
  constructor(public dialogRef: MatDialogRef<LightboxComponent>,
              @Inject(PLATFORM_ID) private _platformId: Object,
              @Inject(MAT_DIALOG_DATA) public data: any,
              @Inject('WINDOW') private window: any,
              private ref: ChangeDetectorRef,
              private http: HttpClient) {
    this.isBrowser = isPlatformBrowser(this._platformId);
  }

  getHeight(): number {
    return this.lbHeight;
  }

  next(): void {
      this.currentIdx = (this.currentIdx + 1) % this.data.length;
      console.log(`${this.currentIdx}/${this.data.length}`);
      this.ref.detectChanges();
  }
  previous(): void {
    this.currentIdx = (this.currentIdx + (this.data.length - 1)) % this.data.length;
    console.log(`${this.currentIdx}/${this.data.length}`);
    this.ref.detectChanges();
  }

  isImage(url: any): boolean {
    return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
  }

  isVideo(url: any): boolean {
    return url.match(/\.(webm|ogg|mp4|wave|wav)$/) != null;
  }

  isAudio(url: any): boolean {
    return url.match(/\.(mp3|wave|wav)$/) != null;
  }

  isPDF(url: any): boolean {
    return url.match(/\.(pdf)$/) != null;
  }

  close(): void {
    this.dialogRef.close();
  }
}
