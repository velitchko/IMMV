import { Component, OnInit, Input, ViewChild, AfterViewInit, Inject, SimpleChanges, OnDestroy } from '@angular/core';
import { Source } from '../../models/source';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { LightboxComponent } from '../lightbox/lightbox.component';
import { DatabaseService } from 'src/app/services/db.service';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss']
})
export class CarouselComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('carouselComponent') carousel;
  @ViewChild('slideContainer') slideContainer;
  @ViewChild('prevArrow') previous;
  @ViewChild('nextArrow') next;
  @Input() source: Source;
  @Input() height: number;
  // @Input() width: number;
  // @Input() height: number;
  // @Input() autoplay: number;
  // @Input() autoplaySpeed: number;

  currentSlide: number;
  loadingContent = true;
  slides: Array<any>;
  paused: boolean = false;
  currentFrame: any = undefined;
  slideOffset: number = 0;
  isBrowser: boolean = false;
  destroyed: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private _platformId: Object,
    @Inject('WINDOW') private window: any,
    public lightbox: MatDialog,
    private db: DatabaseService
  ) {
    this.currentSlide = 0;
    this.slides = new Array<any>();
    this.isBrowser = isPlatformBrowser(this._platformId);
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.paused = true;
    // this.loopSlides.bind(null);
    // this.window.cancelAnimationFrame(this.currentFrame);
    this.window.removeEventListener('resize', this.onResize);
    // this.loopSlides = undefined;
    this.destroyed = true;
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes && changes.source) {
      this.currentSlide = 0;
      this.createSlides();
      this.loadingContent = false;
      // if (this.isBrowser) {
        // if (this.autoplay) this.loopSlides();
        //this.window.addEventListener('resize', this.onResize.bind(this));
      // }
    }
  }

  ngAfterViewInit(): void {
    if (this.slides.length === 0) return;
    this.carousel.nativeElement.style.width = `100%`;

    this.slideOffset = this.carousel.nativeElement.clientWidth;
    this.slideContainer.nativeElement.style.width = `100%`;
    this.slideContainer.nativeElement.style.height = this.height ? `${this.height}px` : `600px`;
    this.previous.nativeElement.style.top = `${this.carousel.nativeElement.clientHeight / 2 - 40}px`;
    this.next.nativeElement.style.top = `${this.carousel.nativeElement.clientHeight / 2 - 40}px`;

    this.next.nativeElement.style.right = `${20}px`;
    this.previous.nativeElement.style.left = `${20}px`;

    // if (!this.autoplaySpeed) this.autoplaySpeed = 5000;
  }

  onResize(): void {
    if (!this.carousel || !this.carousel.nativeElement) return;
    this.slideOffset = this.carousel.nativeElement.scrollWidth;
    // console.log(this.slideOffset);
  }

  getDomain(url: string): string {
    let match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if ( match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0 ) return match[2];

    return '';
  }

  // loopSlides(): any {
  //   if (this.destroyed) return;
  //   setTimeout(() => {
  //     if (!this.paused) {
  //       this.nextSlide();
  //     }
  //     this.currentFrame = this.window.requestAnimationFrame(this.loopSlides.bind(this));
  //   }, this.autoplaySpeed);
  // }

  createSlides(): void {
    this.slides = new Array<any>();
    this.source.identifiers.forEach((i: any) => {
      let safeUrl = this.getUrlIfLocalFile(i);
      if(this.isPDF(safeUrl) && !this.hasDomain(i.url)) {
        this.db.getPDFAsImage(i.url).then((success: any) => {
          console.log(success);
          // TODO: After getting the images 
          // Create a slide per each image?
        });
      }
      let addToSlide = safeUrl !== '' && (!this.isAudio(safeUrl) || !this.isImage(safeUrl) || !this.isPDF(safeUrl) || !this.isVideo(safeUrl));
      // console.log(addToSlide, safeUrl, i.url);
      if (addToSlide) {
        this.slides.push({
          url: safeUrl,
          title: i.title,
          copyright: i.copyright
        });
      }
    });
  }

  // pause(): void {
  //   this.paused = true;
  //   this.window.cancelAnimationFrame(this.currentFrame);
  // }

  // play(): void {
  //   this.paused = false;
  //   this.loopSlides();
  // }

  getUrlIfLocalFile(i: any): string {
    if (i.url.startsWith('uploads/')) {
      return `${environment.API_URL}${i.url}`;
    } else {
      if (i.url.match(/\.(jpeg|jpg|gif|png|webp|webm|ogg|mp4|mp3|wave|wav|pdf)$/) != null) {
        return i.url;
      }
    }

    return '';
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

  nextSlide(): void {
    this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    this.update('next');
  }

  previousSlide(): void {
    this.update('previous');
    this.currentSlide = (this.currentSlide + (this.slides.length - 1)) % this.slides.length;
  }

  update(direction: string): void {
    let slideContainer = this.slideContainer.nativeElement;
    if (direction === 'next') {
      slideContainer.style.transform = `translateX(${-1 * this.currentSlide * this.slideOffset}px)`;
    }
    if (direction === 'previous') {
      if (this.currentSlide === 0) {
        slideContainer.style.transform = `translateX(${-1 * (this.slides.length - 2) * this.slideOffset}px)`
      } else {
        slideContainer.style.transform = `translateX(${-1 * (this.currentSlide - 1) * this.slideOffset}px)`;
      }
    }
  }

  /**
  * Opens a modal (dialog)
  * @param e - event with data that we will display in the modal
  */
  open(e: any, idx: number): void {
    // this.pause();
    let lightboxRef = this.lightbox.open(LightboxComponent, {
      width: '55%',
      data: e,
    });
    lightboxRef.componentInstance.currentIdx = idx;
    lightboxRef.afterClosed().subscribe(() => {
      // this.play();
    });
  }
}
