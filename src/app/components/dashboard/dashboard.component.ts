import { Component, OnInit, Inject } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Source } from '../../models/source';
import { Theme } from '../../models/theme';
import { DatabaseService } from '../../services/db.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: [ './dashboard.component.scss' ]
})

export class DashboardComponent implements OnInit {
  loading: boolean = true;
  sourceLoaded: boolean = false;
  isBrowser: boolean;
  source: Source;
  mainThemes: Array<Theme>;

  constructor(@Inject(PLATFORM_ID) private _platformId: Object,
              @Inject('WINDOW') private window: any,
              private db: DatabaseService,
              private ts: ThemeService
              ) {
    this.loading = false;
    this.isBrowser = isPlatformBrowser(this._platformId);
    this.mainThemes = new Array<Theme>();
    this.db.getSource('5bc86b6ce8a0d9011630e271').then((success: any) => {
      this.source = success;
      this.sourceLoaded = true;
    });
  }

  ngOnInit() {
    this.db.getAllMainThemes().then((success: any) => {
      this.mainThemes = success;
    });
  }

  getColorForTheme(theme: Theme): string {
    return this.ts.getColorForTheme(theme.objectId);
  }
}
