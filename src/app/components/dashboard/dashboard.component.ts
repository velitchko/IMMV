import { Component, OnInit, Inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EventService } from '../../services/event.service';
import { SourceService } from '../../services/sources.service';
import { Source } from '../../models/source';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: [ './dashboard.component.scss' ]
})

export class DashboardComponent implements OnInit {
  loading: boolean = true;
  sourceLoaded: boolean = false;
  breakpoint: number;
  isBrowser: boolean;
  source: Source;

  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
              @Inject('WINDOW') private window: any,
              private ss: SourceService) {
    this.loading = false;
    this.isBrowser = isPlatformBrowser(this._platformId);
    this.breakpoint = 2;
    if(this.isBrowser) {
      this.window.addEventListener('resize', this.onResize());
    }
    // this.ss.getSource('5bc86b6ce8a0d9011630e271').then((success) => {
    //   this.source = success;
    //   this.sourceLoaded = true;
    // });
  }

  ngOnInit() {
    // TODO
    // get data about events, people/organizations, locations, themes
    // make overview graphs of the dataset we have?
  }

  /**
   * Window resize handler
   */
  onResize(): () =>  void {
    return () => {
        this.breakpoint = (this.window.innerWidth <= 450) ? 1 : 2;
    }
  }
}
