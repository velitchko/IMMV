import { Component, OnInit, Input, ViewChild, AfterViewInit, Inject, SimpleChanges } from '@angular/core';
import { Source } from '../../models/source';
import { environment } from '../../../environments/environment';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { LightboxComponent } from '../lightbox/lightbox.component';

@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: [ './carousel.component.scss' ]
})
export class CarouselComponent implements OnInit, AfterViewInit {
  @ViewChild('carouselComponent') carousel;
  @ViewChild('slideContainer') slideContainer;
  @ViewChild('prevArrow') previous;
  @ViewChild('nextArrow') next;
  @Input() source: Source;
  @Input() height: number;
  // @Input() width: number;
  // @Input() height: number;
  @Input() autoplay: number;
  @Input() autoplaySpeed: number;
   
  currentSlide: number;
  loadingContent = true;
  slides: Array<any>;
  paused: boolean = false;
  currentFrame: any = undefined;
  slideOffset: number = 0;
  isBrowser: boolean = false;

  constructor(
    @Inject(PLATFORM_ID) private _platformId: Object,
    @Inject('WINDOW') private window: any,
    public lightbox: MatDialog
  ) {
    this.currentSlide = 0;
    this.slides = new Array<any>();
    this.isBrowser = isPlatformBrowser(this._platformId);
  }
  
  ngOnInit(): void {
    // start carousel // disable loading indicator
    this.createSlides();
    this.loadingContent = false;
    console.log(this.source);
    console.log('carousel init with ' + this.slides.length + ' slides')
    // should probably get the safe resource url by using a sanitizer for each slide
    // also check if each url is a file (e.g. ends in png/jpg/mov/mp4/mp3/pdf etc)
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(changes && changes.source) {
      console.log(changes.source);
      this.createSlides();
    }
  }

  ngAfterViewInit(): void {
    if(this.slides.length === 0) return;
    this.carousel.nativeElement.style.width = `100%`;
    
    this.slideOffset = this.carousel.nativeElement.scrollWidth;
    
    this.slideContainer.nativeElement.style.width = `100%`;
    this.slideContainer.nativeElement.style.height = this.height ? `${this.height}px` : `600px`;

    this.previous.nativeElement.style.top = `${this.carousel.nativeElement.scrollHeight/2 - 40}px`;
    this.next.nativeElement.style.top = `${this.carousel.nativeElement.scrollHeight/2 - 40}px`;

    this.next.nativeElement.style.right = `${20}px`;
    this.previous.nativeElement.style.left = `${20}px`;

    if(!this.autoplaySpeed) this.autoplaySpeed = 2500;
    if(this.isBrowser) {
      if(this.autoplay) this.loopSlides();
      this.window.addEventListener('resize', this.onResize.bind(this));
    }
  }

  onResize(): void {
    if(!this.carousel || !this.carousel.nativeElement) return;
    this.slideOffset = this.carousel.nativeElement.scrollWidth;
    // console.log(this.slideOffset);
  }

  loopSlides(): any {
    setTimeout(() => {
      if(!this.paused) {
        this.nextSlide();
      }
      this.currentFrame = requestAnimationFrame(this.loopSlides.bind(this));
    }, this.autoplaySpeed);
  }

  createSlides(): void {
    this.slides = new Array<any>();
    this.source.identifiers.forEach((i: any) => {
      let safeUrl = this.getUrlIfLocalFile(i);
      let addToSlide = safeUrl !== '' && (!this.isAudio(safeUrl) || !this.isImage(safeUrl) || !this.isPDF(safeUrl) || !this.isVideo(safeUrl)); 
      // console.log(addToSlide, safeUrl, i.url);
      if(addToSlide) {
        this.slides.push({
          url: safeUrl,
          title: i.title,
          copyright: i.copyright
        });
      }
    });
  }

  pause(): void {
    this.paused = true;
    cancelAnimationFrame(this.currentFrame);
  }

  play(): void {
    this.paused = false;
    this.loopSlides();
  }

  getUrlIfLocalFile(i: any): string {
    if(i.url.startsWith('uploads/')) {
      return `${environment.API_URL}${i.url}`;
    } else {
      if(i.url.match(/\.(jpeg|jpg|gif|png|webp|webm|ogg|mp4|mp3|wave|wav|pdf)$/) != null){
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
    // console.log('next slide ' + this.currentSlide);
  }

  previousSlide(): void {
    this.update('previous');
    this.currentSlide = (this.currentSlide + (this.slides.length - 1)) % this.slides.length;
    // console.log('previous slide ' + this.currentSlide);
  }

  update(direction: string): void {
    let childSlides = this.slideContainer.nativeElement.children;

    for(let i = 0; i < childSlides.length; i++) {
      if(direction === 'next') {
        childSlides[i].style.transform = `translateX(${-1*this.currentSlide*this.slideOffset}px)`;
      } 
      if(direction === 'previous') {
        if(this.currentSlide === 0) {
          // special case when we wrap from first to last
          childSlides[i].style.transform = `translateX(${-1*(this.slides.length - 1)*this.slideOffset}px)`
        }  else {
          childSlides[i].style.transform = `translateX(${-1*(this.currentSlide - 1)*this.slideOffset}px)`;
        }
      }
    }
  }

   /**
   * Opens a modal (dialog)
   * @param e - event with data that we will display in the modal
   */
  open(e: any, idx: number): void {
    this.pause();
    let lightboxRef = this.lightbox.open(LightboxComponent, {
      width: '55%',
      data: e,
    });
    lightboxRef.componentInstance.currentIdx = idx;
    lightboxRef.afterClosed().subscribe(() => {
      this.play();
    });
  }
}
 