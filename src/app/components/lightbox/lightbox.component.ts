import { Component, Inject, AfterViewInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
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
    if(this.isBrowser) {
      this.lbHeight = (this.window.innerHeight - this.window.innerHeight*5/100); // remove 15 of height because we are not useing whole viewport
      // for(let d of this.data) {
      //   console.log('constructor');
      //   console.log(d);
      //   if(this.isPDF(d.type)) {
      //     let r = this.getPDFUrl(d.url);
      //     console.log(r);
      //   }
      // }
    }
    // get client dimensions to calculate height lightbox should have
  }

  getHeight(): number {
    //console.log('got height');
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

  getPDFUrl(url: string): any {
    // let headers =  new HttpHeaders();
    // headers.append('Content-Type', 'application/pdf');
    // headers.append('Access-Control-Allow-Origin', '*');
    // this.http.get(environment.API_URL +'getcookie/').subscribe( (success) => {
    //   console.log(success);
    // });
    // headers.append('FM-Data-token', environment.FM_TOKEN);
    // let request = { url: url, withCredentials: true, httpHeaders: headers };
    // return request;
    // let body = {
    //   url: url
    // };
    // return request;
  }

  close(): void {
    this.dialogRef.close();
  }
}
